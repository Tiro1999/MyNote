/**
 * Legality change tracking.
 *
 * Scryfall's legality data is a *moving* value: banned lists change on
 * announcement days, Standard rotates, Vintage restricts. The card in the binder
 * does not change — its legality does. So this module keeps a snapshot of what
 * Scryfall last said, and after every index refresh diffs the new answer against
 * it. A change only becomes an event if it actually touches something the user
 * owns, wants, or plays.
 *
 * Deliberately NOT stored on the collection rows. Legality belongs to the card
 * (the oracle identity), not to the physical copy — writing it onto every
 * `CollectionEntry` would duplicate one fact across every printing, finish and
 * condition of that card, and would rewrite thousands of collection.csv lines on
 * every Scryfall refresh. The collection file is destined for a git repo with a
 * nightly diff; that churn would bury the signal it exists to show.
 *
 * The snapshot keeps all 23 Scryfall formats so it stays a lossless record and
 * adding a deck format later needs no migration. Events are raised only for
 * `DECK_FORMATS` — an Alchemy rebalance is not actionable for a paper binder.
 */
import {
  LEGALITY_FORMATS,
  decodeLegality,
  type LegalityFormat,
  type LegalityValue,
  type OracleCard,
  type PrintingCard
} from '../../../shared/scryfall-model'
import {
  DECK_FORMAT_LABELS,
  DECK_FORMATS,
  type CollectionEntry,
  type Deck,
  type DeckFormat,
  type DeckZone,
  type WishlistEntry
} from './model'

// Every deck format must be a real Scryfall legality key, or `decodeLegality`
// would silently answer 'not_legal' for it and the tracker would report a
// phantom rotation for every card. Enforced at compile time.
const _formatsAreLegalityKeys: readonly LegalityFormat[] = DECK_FORMATS
void _formatsAreLegalityKeys

// ─── Snapshot ─────────────────────────────────────────────────────────────────

/**
 * One card's legality as of the last check.
 *
 * Carries no timestamp on purpose: a `checkedAt` per row would rewrite every
 * line on every check, so an unchanged collection would produce a full-file diff
 * every single night.
 */
export interface LegalitySnapshotRow {
  oracleId: string
  name: string
  /** Packed one-char-per-format string, as on `OracleCard.legalities`. */
  legalities: string
}

/**
 * The oracle ids worth tracking — cards the user owns, wants, or plays.
 *
 * Tracking all ~38k oracle cards would work but would report bans on cards the
 * user has never heard of. Collection entries store a *printing* id, so they
 * resolve through the printing cache; unresolved ones are skipped (the card
 * library surfaces those separately via `is:unknown`).
 */
export function relevantOracleIds(input: {
  collection: CollectionEntry[]
  wishlist: WishlistEntry[]
  decks: Deck[]
  printingById: Map<string, PrintingCard>
}): Set<string> {
  const ids = new Set<string>()
  for (const entry of input.collection) {
    const oracleId = input.printingById.get(entry.scryfallId)?.oracleId
    if (oracleId) ids.add(oracleId)
  }
  for (const entry of input.wishlist) {
    if (entry.oracleId) ids.add(entry.oracleId)
  }
  for (const deck of input.decks) {
    for (const card of deck.cards) {
      if (card.oracleId) ids.add(card.oracleId)
    }
  }
  return ids
}

/** Build the current snapshot for the tracked cards, sorted for a stable diff. */
export function buildSnapshot(
  oracleIds: Set<string>,
  oracleById: Map<string, OracleCard>
): LegalitySnapshotRow[] {
  const rows: LegalitySnapshotRow[] = []
  for (const oracleId of oracleIds) {
    const oracle = oracleById.get(oracleId)
    if (!oracle) continue
    rows.push({ oracleId, name: oracle.name, legalities: oracle.legalities })
  }
  return sortSnapshot(rows)
}

/**
 * Canonical order: by oracle id, which is stable across errata and reprints.
 * Sorting by name would move a row whenever a card is renamed, turning a
 * one-line diff into a delete plus an insert.
 */
export function sortSnapshot(rows: LegalitySnapshotRow[]): LegalitySnapshotRow[] {
  return [...rows].sort((a, b) => a.oracleId.localeCompare(b.oracleId))
}

// ─── Diff ─────────────────────────────────────────────────────────────────────

export type LegalityChangeKind =
  | 'banned'
  | 'restricted'
  | 'rotated'
  | 'unbanned'
  | 'unrestricted'
  | 'newly_legal'

export interface LegalityChange {
  oracleId: string
  name: string
  format: DeckFormat
  from: LegalityValue
  to: LegalityValue
  kind: LegalityChangeKind
}

/** Whether a card in this state can actually be put in a deck of that format. */
const PLAYABLE: Record<LegalityValue, boolean> = {
  legal: true,
  restricted: true, // capped at one copy, but playable
  banned: false,
  not_legal: false
}

/** Name the transition, or null when it is not a change worth reporting. */
export function classifyChange(
  from: LegalityValue,
  to: LegalityValue
): LegalityChangeKind | null {
  if (from === to) return null
  // A card that was already unplayable becoming unplayable a different way
  // (out of the pool → banned) demands nothing of the user. The snapshot still
  // records it; only the alert is suppressed.
  if (!PLAYABLE[from] && !PLAYABLE[to]) return null

  switch (to) {
    case 'banned':
      return 'banned'
    case 'restricted':
      return 'restricted'
    case 'not_legal':
      return 'rotated'
    case 'legal':
      if (from === 'banned') return 'unbanned'
      if (from === 'restricted') return 'unrestricted'
      return 'newly_legal'
  }
}

/**
 * Diff two snapshots.
 *
 * Cards absent from `previous` produce no changes — on the very first run every
 * card would otherwise look "newly legal" everywhere, and a card newly added to
 * the collection is not a legality event.
 */
export function diffSnapshots(
  previous: LegalitySnapshotRow[],
  current: LegalitySnapshotRow[]
): LegalityChange[] {
  const before = new Map(previous.map((row) => [row.oracleId, row]))
  const changes: LegalityChange[] = []

  for (const row of current) {
    const old = before.get(row.oracleId)
    if (!old || old.legalities === row.legalities) continue

    for (const format of DECK_FORMATS) {
      const from = decodeLegality(old.legalities, format)
      const to = decodeLegality(row.legalities, format)
      const kind = classifyChange(from, to)
      if (kind) changes.push({ oracleId: row.oracleId, name: row.name, format, from, to, kind })
    }
  }

  return changes.sort(
    (a, b) => a.name.localeCompare(b.name) || a.format.localeCompare(b.format)
  )
}

// ─── Scoping to what the user actually holds ──────────────────────────────────

export type LegalitySeverity = 'error' | 'warning' | 'info'

export interface DeckImpact {
  deckId: string
  deckName: string
  quantity: number
  zone: DeckZone
}

export interface LegalityEvent {
  change: LegalityChange
  severity: LegalitySeverity
  /** Decks *of that format* holding the card — the reason this is urgent. */
  affectedDecks: DeckImpact[]
  /** Copies in the binder, for changes that only affect what a card is worth. */
  ownedQuantity: number
  onWishlist: boolean
  /** Ready-to-show German sentence. */
  message: string
}

const SEVERITY_RANK: Record<LegalitySeverity, number> = { error: 0, warning: 1, info: 2 }

function describe(
  change: LegalityChange,
  decks: DeckImpact[],
  ownedQuantity: number,
  onWishlist: boolean
): string {
  const format = DECK_FORMAT_LABELS[change.format]
  const inDecks =
    decks.length > 0 ? ` — betrifft ${decks.map((deck) => deck.deckName).join(', ')}` : ''

  switch (change.kind) {
    case 'banned':
      return `${change.name} ist in ${format} jetzt gebannt${inDecks}`
    case 'rotated':
      return `${change.name} ist in ${format} nicht mehr spielbar${inDecks}`
    case 'restricted': {
      const copies = decks.reduce((sum, deck) => sum + deck.quantity, 0)
      const tooMany = copies > 1 ? ` — du spielst ${copies}` : ''
      return `${change.name} ist in ${format} auf 1 Kopie beschränkt${tooMany}${inDecks}`
    }
    case 'unbanned':
    case 'unrestricted': {
      const owned = ownedQuantity > 0 ? ` — du besitzt ${ownedQuantity}` : ''
      const wanted = ownedQuantity === 0 && onWishlist ? ' — steht auf deiner Wishlist' : ''
      return `${change.name} ist in ${format} wieder erlaubt${owned}${wanted}`
    }
    case 'newly_legal': {
      const owned = ownedQuantity > 0 ? ` — du besitzt ${ownedQuantity}` : ''
      return `${change.name} ist jetzt in ${format} spielbar${owned}`
    }
  }
}

function severityFor(change: LegalityChange, decks: DeckImpact[]): LegalitySeverity {
  if (decks.length === 0) return 'info'
  switch (change.kind) {
    case 'banned':
    case 'rotated':
      return 'error'
    case 'restricted':
      // Restricted is a one-copy cap, not a ban. The deck is only broken if it
      // actually plays more than one.
      return decks.reduce((sum, deck) => sum + deck.quantity, 0) > 1 ? 'error' : 'warning'
    default:
      return 'info'
  }
}

/**
 * Turn raw changes into events, keeping only those that touch the user.
 *
 * A deck counts as affected only when its format matches the format that
 * changed — a Modern ban says nothing about a Commander deck holding the card.
 */
export function scopeChanges(
  changes: LegalityChange[],
  context: {
    decks: Deck[]
    collection: CollectionEntry[]
    wishlist: WishlistEntry[]
    printingById: Map<string, PrintingCard>
  }
): LegalityEvent[] {
  const ownedByOracle = new Map<string, number>()
  for (const entry of context.collection) {
    const oracleId = context.printingById.get(entry.scryfallId)?.oracleId
    if (!oracleId) continue
    ownedByOracle.set(oracleId, (ownedByOracle.get(oracleId) ?? 0) + entry.quantity)
  }
  const wishlistOracles = new Set(context.wishlist.map((entry) => entry.oracleId))

  const events: LegalityEvent[] = []
  for (const change of changes) {
    const affectedDecks: DeckImpact[] = []
    for (const deck of context.decks) {
      if (deck.format !== change.format) continue
      for (const card of deck.cards) {
        if (card.oracleId !== change.oracleId) continue
        affectedDecks.push({
          deckId: deck.id,
          deckName: deck.name,
          quantity: card.quantity,
          zone: card.zone
        })
      }
    }

    const ownedQuantity = ownedByOracle.get(change.oracleId) ?? 0
    const onWishlist = wishlistOracles.has(change.oracleId)
    // Nothing owned, wanted or played — the change is real but not the user's
    // problem, and reporting it is how a tracker trains people to ignore it.
    if (affectedDecks.length === 0 && ownedQuantity === 0 && !onWishlist) continue

    events.push({
      change,
      severity: severityFor(change, affectedDecks),
      affectedDecks,
      ownedQuantity,
      onWishlist,
      message: describe(change, affectedDecks, ownedQuantity, onWishlist)
    })
  }

  return events.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.affectedDecks.length - a.affectedDecks.length ||
      a.change.name.localeCompare(b.change.name)
  )
}

/** Current legality of one card across the deck formats, for a card detail view. */
export function legalityTags(
  encoded: string
): Array<{ format: DeckFormat; label: string; value: LegalityValue }> {
  return DECK_FORMATS.map((format) => ({
    format,
    label: DECK_FORMAT_LABELS[format],
    value: decodeLegality(encoded, format)
  }))
}

export const ALL_LEGALITY_FORMATS = LEGALITY_FORMATS
