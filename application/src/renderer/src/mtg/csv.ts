/**
 * On-disk format for the MTG collection and wishlist.
 *
 * Written deterministically — fixed column order, canonical row order, stable
 * boolean spelling — because this file is destined for a private git repo with a
 * nightly diff job. An unchanged collection must serialise byte-identically, or
 * every night's report drowns in noise.
 */
import { parseCsv, serializeCsv } from '../lib/csv'
import {
  entryKey,
  sortEntries,
  type CollectionEntry,
  type Condition,
  type Finish,
  type WishlistEntry
} from './model'

export const COLLECTION_HEADER = [
  'scryfallId',
  'finish',
  'condition',
  'language',
  'misprint',
  'altered',
  'quantity',
  'name',
  'setCode',
  'collectorNumber',
  'storageLocation',
  'note',
  'purchasePrice',
  'purchaseCurrency',
  'addedAt'
] as const

const bool = (value: boolean): string => (value ? 'true' : 'false')
const parseBool = (value: string | undefined): boolean => value === 'true'

export function serializeCollectionCsv(entries: CollectionEntry[]): string {
  const rows: string[][] = [[...COLLECTION_HEADER]]
  for (const entry of sortEntries(entries)) {
    rows.push([
      entry.scryfallId,
      entry.finish,
      entry.condition,
      entry.language,
      bool(entry.misprint),
      bool(entry.altered),
      String(entry.quantity),
      entry.name,
      entry.setCode,
      entry.collectorNumber,
      entry.storageLocation,
      entry.note,
      entry.purchasePrice,
      entry.purchaseCurrency,
      entry.addedAt
    ])
  }
  // Trailing newline so the file is POSIX-clean and git does not flag
  // "\ No newline at end of file" on every change.
  return `${serializeCsv(rows)}\r\n`
}

export function parseCollectionCsv(text: string): CollectionEntry[] {
  const rows = parseCsv(text)
  if (rows.length <= 1) return []

  // Resolve by header name so a future added column cannot shift the mapping.
  const index = new Map(rows[0].map((header, i) => [header.trim(), i]))
  const at = (cells: string[], column: (typeof COLLECTION_HEADER)[number]): string => {
    const i = index.get(column)
    return i === undefined ? '' : (cells[i] ?? '')
  }

  const entries: CollectionEntry[] = []
  for (const cells of rows.slice(1)) {
    if (cells.length === 0 || (cells.length === 1 && cells[0] === '')) continue
    const quantity = Number.parseInt(at(cells, 'quantity'), 10)
    entries.push({
      scryfallId: at(cells, 'scryfallId'),
      finish: (at(cells, 'finish') || 'normal') as Finish,
      condition: (at(cells, 'condition') || 'near_mint') as Condition,
      language: at(cells, 'language') || 'en',
      misprint: parseBool(at(cells, 'misprint')),
      altered: parseBool(at(cells, 'altered')),
      quantity: Number.isFinite(quantity) ? quantity : 0,
      name: at(cells, 'name'),
      setCode: at(cells, 'setCode'),
      collectorNumber: at(cells, 'collectorNumber'),
      storageLocation: at(cells, 'storageLocation'),
      note: at(cells, 'note'),
      purchasePrice: at(cells, 'purchasePrice'),
      purchaseCurrency: at(cells, 'purchaseCurrency'),
      addedAt: at(cells, 'addedAt')
    })
  }
  return entries
}

export const WISHLIST_HEADER = [
  'scryfallId',
  'oracleId',
  'name',
  'quantity',
  'reason',
  'deckId',
  'priority',
  'note',
  'addedAt'
] as const

export function serializeWishlistCsv(entries: WishlistEntry[]): string {
  const sorted = [...entries].sort(
    (a, b) => a.name.localeCompare(b.name) || a.scryfallId.localeCompare(b.scryfallId)
  )
  const rows: string[][] = [[...WISHLIST_HEADER]]
  for (const entry of sorted) {
    rows.push([
      entry.scryfallId,
      entry.oracleId,
      entry.name,
      String(entry.quantity),
      entry.reason,
      entry.deckId,
      entry.priority,
      entry.note,
      entry.addedAt
    ])
  }
  return `${serializeCsv(rows)}\r\n`
}

export function parseWishlistCsv(text: string): WishlistEntry[] {
  const rows = parseCsv(text)
  if (rows.length <= 1) return []
  const index = new Map(rows[0].map((header, i) => [header.trim(), i]))
  const at = (cells: string[], column: (typeof WISHLIST_HEADER)[number]): string => {
    const i = index.get(column)
    return i === undefined ? '' : (cells[i] ?? '')
  }

  const entries: WishlistEntry[] = []
  for (const cells of rows.slice(1)) {
    if (cells.length === 0 || (cells.length === 1 && cells[0] === '')) continue
    const quantity = Number.parseInt(at(cells, 'quantity'), 10)
    const priority = at(cells, 'priority')
    entries.push({
      scryfallId: at(cells, 'scryfallId'),
      oracleId: at(cells, 'oracleId'),
      name: at(cells, 'name'),
      quantity: Number.isFinite(quantity) ? quantity : 1,
      reason: at(cells, 'reason'),
      deckId: at(cells, 'deckId'),
      priority: priority === 'low' || priority === 'high' ? priority : 'normal',
      note: at(cells, 'note'),
      addedAt: at(cells, 'addedAt')
    })
  }
  return entries
}

/** Total physical cards held, as opposed to the number of distinct stacks. */
export function totalCards(entries: CollectionEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.quantity, 0)
}

/** Distinct printings held — one per identity key. */
export function distinctPrintings(entries: CollectionEntry[]): number {
  return new Set(entries.map(entryKey)).size
}
