/**
 * ManaBox CSV import.
 *
 * A ManaBox export is a full snapshot of the collection, but a messy one:
 *
 *  - Two header shapes exist — the whole-collection export prefixes
 *    `Binder Name,Binder Type`, a single-binder export does not. Columns are
 *    therefore resolved by header name, never by position.
 *  - The same physical stack legitimately appears on several rows (in one real
 *    3743-row export, 251 keys spanned 535 rows). Quantities must be SUMMED;
 *    a naive key→row map silently loses cards.
 *  - `Binder Type = list` means the user does NOT own those cards — those are
 *    wishlist rows and must not inflate the collection.
 *  - Derived columns (Name, Set name, Rarity, Purchase price) are rewritten by
 *    ManaBox between exports even when nothing changed, so the diff runs on the
 *    identity key plus summed quantity only.
 *  - Files are LF-only with no trailing newline, and may have gone through
 *    Excel, which adds a BOM and mangles collector numbers.
 */
import { parseCsv, detectDelimiter, stripBom } from '../lib/csv'
import {
  CONDITIONS,
  FINISHES,
  entryKey,
  type CollectionEntry,
  type Condition,
  type Finish,
  type WishlistEntry
} from './model'

// ─── Header mapping ───────────────────────────────────────────────────────────

/** Canonical field ids the importer understands. */
export type ManaboxField =
  | 'binderName'
  | 'binderType'
  | 'name'
  | 'setCode'
  | 'setName'
  | 'collectorNumber'
  | 'finish'
  | 'rarity'
  | 'quantity'
  | 'manaboxId'
  | 'scryfallId'
  | 'purchasePrice'
  | 'misprint'
  | 'altered'
  | 'condition'
  | 'language'
  | 'purchaseCurrency'

/**
 * Header aliases, lowercased and stripped of non-alphanumerics before lookup.
 * ManaBox's own importer accepts names its exporter never emits (`Card number`,
 * `Purchase currency`), and users re-save exports through Excel — so matching is
 * alias-tolerant rather than exact.
 */
const HEADER_ALIASES: Record<string, ManaboxField> = {
  bindername: 'binderName',
  binder: 'binderName',
  bindertype: 'binderType',
  name: 'name',
  cardname: 'name',
  setcode: 'setCode',
  set: 'setCode',
  setname: 'setName',
  collectornumber: 'collectorNumber',
  cardnumber: 'collectorNumber',
  number: 'collectorNumber',
  foil: 'finish',
  finish: 'finish',
  rarity: 'rarity',
  quantity: 'quantity',
  qty: 'quantity',
  count: 'quantity',
  manaboxid: 'manaboxId',
  scryfallid: 'scryfallId',
  purchaseprice: 'purchasePrice',
  price: 'purchasePrice',
  misprint: 'misprint',
  altered: 'altered',
  condition: 'condition',
  language: 'language',
  lang: 'language',
  purchasepricecurrency: 'purchaseCurrency',
  purchasecurrency: 'purchaseCurrency',
  currency: 'purchaseCurrency'
}

const normalizeHeader = (header: string): string =>
  header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/** Resolve a header row into field → column index. Unknown columns are ignored. */
export function mapHeaders(header: string[]): Partial<Record<ManaboxField, number>> {
  const map: Partial<Record<ManaboxField, number>> = {}
  header.forEach((raw, index) => {
    const field = HEADER_ALIASES[normalizeHeader(raw)]
    // First occurrence wins, so a stray duplicate column cannot shadow the real one.
    if (field && map[field] === undefined) map[field] = index
  })
  return map
}

// ─── Value coercion ───────────────────────────────────────────────────────────

/** ManaBox writes lowercase `true`/`false`; hand-made CSVs use anything. */
function parseBool(value: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes' || v === 'ja'
}

function parseFinish(value: string | undefined): Finish {
  const v = (value ?? '').trim().toLowerCase()
  if ((FINISHES as readonly string[]).includes(v)) return v as Finish
  // Some exporters write a boolean here; treat truthy as foil rather than
  // dropping the distinction entirely.
  if (v === 'true' || v === '1' || v === 'yes') return 'foil'
  return 'normal'
}

function parseCondition(value: string | undefined): Condition {
  const v = (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if ((CONDITIONS as readonly string[]).includes(v)) return v as Condition
  // Tolerate the spelling every other app uses.
  if (v === 'lightly_played') return 'light_played'
  if (v === 'moderately_played') return 'played'
  if (v === 'heavily_played' || v === 'damaged') return 'poor'
  return 'near_mint'
}

function parseQuantity(value: string | undefined): number {
  const n = Number.parseInt((value ?? '').trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

export interface ManaboxParseResult {
  /** Owned stacks (binder + deck rows), aggregated by identity key. */
  owned: CollectionEntry[]
  /** Rows from `list` binders — the user does not own these. */
  wishlist: WishlistEntry[]
  /** Which fields were found in the header. */
  fields: ManaboxField[]
  /** Rows skipped, with the reason, so the UI can be honest about data loss. */
  skipped: Array<{ line: number; reason: string }>
  /** Non-fatal observations worth surfacing (missing optional columns, …). */
  warnings: string[]
  /** How many raw rows collapsed into `owned` by summing duplicates. */
  duplicateRowsMerged: number
}

/** Rows in binders of this type are wishlist entries, not owned cards. */
const WISHLIST_BINDER_TYPES = new Set(['list'])

/**
 * Parse a ManaBox CSV into aggregated owned stacks and wishlist rows.
 *
 * `importedAt` is passed in rather than read from the clock so the result is
 * deterministic and testable.
 */
export function parseManaboxCsv(text: string, importedAt: string): ManaboxParseResult {
  const clean = stripBom(text)
  const rows = parseCsv(clean, detectDelimiter(clean))
  const skipped: Array<{ line: number; reason: string }> = []
  const warnings: string[] = []

  if (rows.length === 0) {
    return {
      owned: [],
      wishlist: [],
      fields: [],
      skipped: [{ line: 0, reason: 'Datei ist leer' }],
      warnings,
      duplicateRowsMerged: 0
    }
  }

  const columns = mapHeaders(rows[0])
  const fields = Object.keys(columns) as ManaboxField[]

  if (columns.scryfallId === undefined) {
    warnings.push(
      'Spalte "Scryfall ID" fehlt — Karten werden über Set-Code und Sammlernummer zugeordnet, ' +
        'was bei Sonderdrucken ungenauer ist.'
    )
  }
  if (columns.quantity === undefined) {
    warnings.push('Spalte "Quantity" fehlt — jede Zeile wird als eine Karte gezählt.')
  }
  if (columns.binderType === undefined) {
    warnings.push(
      'Spalte "Binder Type" fehlt — es kann nicht zwischen Bestand und Wunschliste unterschieden ' +
        'werden, alle Zeilen gelten als Bestand.'
    )
  }

  const cell = (row: string[], field: ManaboxField): string => {
    const index = columns[field]
    return index === undefined ? '' : (row[index] ?? '').trim()
  }

  // Aggregate by identity key: the same stack legitimately spans several rows.
  const ownedByKey = new Map<string, CollectionEntry>()
  const wishlistByKey = new Map<string, WishlistEntry>()
  let ownedRowCount = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const line = i + 1

    // parseCsv can yield a trailing [''] for stray whitespace; skip quietly.
    if (row.length === 0 || (row.length === 1 && row[0] === '')) continue

    const name = cell(row, 'name')
    const scryfallId = cell(row, 'scryfallId')
    if (!name && !scryfallId) {
      skipped.push({ line, reason: 'Weder Kartenname noch Scryfall-ID vorhanden' })
      continue
    }

    const quantity = columns.quantity === undefined ? 1 : parseQuantity(cell(row, 'quantity'))
    if (quantity <= 0) {
      skipped.push({ line, reason: `Ungültige Menge für "${name || scryfallId}"` })
      continue
    }

    const binderType = cell(row, 'binderType').toLowerCase()

    if (WISHLIST_BINDER_TYPES.has(binderType)) {
      const key = scryfallId || `${cell(row, 'setCode')}|${cell(row, 'collectorNumber')}|${name}`
      const existing = wishlistByKey.get(key)
      if (existing) {
        existing.quantity += quantity
      } else {
        wishlistByKey.set(key, {
          scryfallId,
          oracleId: '',
          name,
          quantity,
          reason: `Aus ManaBox-Liste "${cell(row, 'binderName')}"`,
          deckId: '',
          priority: 'normal',
          note: '',
          addedAt: importedAt
        })
      }
      continue
    }

    const entry: CollectionEntry = {
      scryfallId,
      finish: parseFinish(cell(row, 'finish')),
      condition: parseCondition(cell(row, 'condition')),
      // ManaBox's own spelling is kept; toScryfallLang() converts for lookups.
      language: cell(row, 'language') || 'en',
      misprint: parseBool(cell(row, 'misprint')),
      altered: parseBool(cell(row, 'altered')),
      quantity,
      name,
      // Scryfall serves lowercase set codes; ManaBox uppercases them.
      setCode: cell(row, 'setCode').toLowerCase(),
      collectorNumber: cell(row, 'collectorNumber'),
      storageLocation: cell(row, 'binderName'),
      note: '',
      purchasePrice: cell(row, 'purchasePrice'),
      purchaseCurrency: cell(row, 'purchaseCurrency'),
      addedAt: importedAt
    }

    ownedRowCount++
    const key = entryKey(entry)
    const existing = ownedByKey.get(key)
    if (existing) {
      existing.quantity += quantity
      // Keep the first non-empty storage location; a stack split across two
      // rows of the same binder should not lose its location to a blank row.
      if (!existing.storageLocation) existing.storageLocation = entry.storageLocation
      if (!existing.purchasePrice) {
        existing.purchasePrice = entry.purchasePrice
        existing.purchaseCurrency = entry.purchaseCurrency
      }
    } else {
      ownedByKey.set(key, entry)
    }
  }

  return {
    owned: [...ownedByKey.values()],
    wishlist: [...wishlistByKey.values()],
    fields,
    skipped,
    warnings,
    duplicateRowsMerged: ownedRowCount - ownedByKey.size
  }
}

// ─── Diffing ──────────────────────────────────────────────────────────────────

export interface QuantityChange {
  entry: CollectionEntry
  from: number
  to: number
}

/**
 * What an import would do, computed before anything is written.
 *
 * Surfaced to the user for confirmation rather than applied blindly: a partial
 * export (one binder instead of the whole collection) looks identical to
 * "I sold most of my cards", and only the user can tell those apart.
 */
export interface ImportPlan {
  /** Stacks not currently held. */
  added: CollectionEntry[]
  /** Stacks whose count went up. */
  increased: QuantityChange[]
  /** Stacks whose count went down. */
  decreased: QuantityChange[]
  /** Held stacks absent from the export — sold, or simply not in this export. */
  missing: CollectionEntry[]
  /** Stacks present in both with the same count. */
  unchanged: number
  /** Net change in physical cards if the plan is applied in full. */
  netCardDelta: number
}

/**
 * Compare the stored collection against a freshly parsed export.
 *
 * Runs purely on identity key + quantity. Derived columns are ignored precisely
 * because ManaBox rewrites them between exports.
 */
export function planImport(
  current: CollectionEntry[],
  incoming: CollectionEntry[]
): ImportPlan {
  const currentByKey = new Map(current.map((entry) => [entryKey(entry), entry]))
  const incomingByKey = new Map(incoming.map((entry) => [entryKey(entry), entry]))

  const added: CollectionEntry[] = []
  const increased: QuantityChange[] = []
  const decreased: QuantityChange[] = []
  const missing: CollectionEntry[] = []
  let unchanged = 0
  let netCardDelta = 0

  for (const [key, entry] of incomingByKey) {
    const existing = currentByKey.get(key)
    if (!existing) {
      added.push(entry)
      netCardDelta += entry.quantity
      continue
    }
    if (entry.quantity > existing.quantity) {
      increased.push({ entry, from: existing.quantity, to: entry.quantity })
      netCardDelta += entry.quantity - existing.quantity
    } else if (entry.quantity < existing.quantity) {
      decreased.push({ entry, from: existing.quantity, to: entry.quantity })
      netCardDelta += entry.quantity - existing.quantity
    } else {
      unchanged++
    }
  }

  for (const [key, entry] of currentByKey) {
    if (!incomingByKey.has(key)) missing.push(entry)
  }

  return { added, increased, decreased, missing, unchanged, netCardDelta }
}

export interface ApplyOptions {
  /**
   * Remove stacks that are held but absent from the export. Off by default:
   * importing a single binder must not wipe the rest of the collection.
   */
  removeMissing: boolean
  /** Apply quantity decreases. Off when importing a partial export. */
  applyDecreases: boolean
  /** Refresh name/set/collector number from the export's payload columns. */
  refreshPayload: boolean
}

export const DEFAULT_APPLY_OPTIONS: ApplyOptions = {
  removeMissing: false,
  applyDecreases: true,
  refreshPayload: true
}

/**
 * Produce the merged collection.
 *
 * User-owned fields (`note`, and a `storageLocation` the user edited) survive
 * the merge — an import updates counts and refreshable payload, it does not
 * overwrite annotations.
 */
export function applyImport(
  current: CollectionEntry[],
  incoming: CollectionEntry[],
  options: ApplyOptions = DEFAULT_APPLY_OPTIONS
): CollectionEntry[] {
  const currentByKey = new Map(current.map((entry) => [entryKey(entry), entry]))
  const incomingByKey = new Map(incoming.map((entry) => [entryKey(entry), entry]))
  const result = new Map<string, CollectionEntry>()

  for (const [key, existing] of currentByKey) {
    const update = incomingByKey.get(key)

    if (!update) {
      if (!options.removeMissing) result.set(key, existing)
      continue
    }

    const quantity =
      update.quantity < existing.quantity && !options.applyDecreases
        ? existing.quantity
        : update.quantity

    result.set(key, {
      ...existing,
      quantity,
      ...(options.refreshPayload
        ? {
            name: update.name || existing.name,
            setCode: update.setCode || existing.setCode,
            collectorNumber: update.collectorNumber || existing.collectorNumber
          }
        : {}),
      // Never clobber a note the user wrote.
      note: existing.note,
      // Keep the user's storage location; only fill it if it was empty.
      storageLocation: existing.storageLocation || update.storageLocation,
      // A price the user already recorded wins over ManaBox's auto-filled one.
      purchasePrice: existing.purchasePrice || update.purchasePrice,
      purchaseCurrency: existing.purchaseCurrency || update.purchaseCurrency,
      // Keep the original acquisition date.
      addedAt: existing.addedAt
    })
  }

  for (const [key, entry] of incomingByKey) {
    if (!currentByKey.has(key)) result.set(key, entry)
  }

  return [...result.values()]
}
