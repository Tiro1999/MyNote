/**
 * The MTG collection model.
 *
 * Shaped around one hard-won constraint: a ManaBox export is *not* a stable
 * mirror of the collection. Its derived columns (Name, Set name, Rarity,
 * Purchase price) get rewritten by ManaBox against Scryfall between exports even
 * when nothing was bought or sold, and its row order is arbitrary. So a card
 * stack is identified by the physical facts only, everything else is refreshable
 * payload, and rows are re-sorted on write.
 */

/** ManaBox models finish as a three-value enum, not a boolean. Collapsing
 *  `etched` into `foil` loses a genuinely distinct printing. */
export const FINISHES = ['normal', 'foil', 'etched'] as const
export type Finish = (typeof FINISHES)[number]

/** Note the irregular `light_played` — not `lightly_played`. */
export const CONDITIONS = [
  'mint',
  'near_mint',
  'excellent',
  'good',
  'light_played',
  'played',
  'poor'
] as const
export type Condition = (typeof CONDITIONS)[number]

export const CONDITION_LABELS: Record<Condition, string> = {
  mint: 'Mint',
  near_mint: 'Near Mint',
  excellent: 'Excellent',
  good: 'Good',
  light_played: 'Light Played',
  played: 'Played',
  poor: 'Poor'
}

export const FINISH_LABELS: Record<Finish, string> = {
  normal: 'Normal',
  foil: 'Foil',
  etched: 'Etched'
}

/**
 * ManaBox emits mostly ISO-639-1, but uses `zh_CN`/`zh_TW` where Scryfall uses
 * `zhs`/`zht`. Mapped explicitly so Scryfall lookups resolve.
 */
export const MANABOX_TO_SCRYFALL_LANG: Record<string, string> = {
  en: 'en',
  es: 'es',
  fr: 'fr',
  de: 'de',
  it: 'it',
  pt: 'pt',
  ja: 'ja',
  ko: 'ko',
  ru: 'ru',
  zh_CN: 'zhs',
  zh_TW: 'zht'
}

export function toScryfallLang(manaboxLang: string): string {
  return MANABOX_TO_SCRYFALL_LANG[manaboxLang] ?? manaboxLang.toLowerCase()
}

/**
 * One stack of physically identical cards.
 *
 * The first six fields form the identity key — they are the properties that
 * make two cards genuinely interchangeable in a binder. Everything below
 * `quantity` is payload: either refreshable from Scryfall, or user-owned
 * annotation that an import must never clobber.
 */
export interface CollectionEntry {
  /** Scryfall printing UUID — pins set, collector number, artwork and rarity. */
  scryfallId: string
  finish: Finish
  condition: Condition
  /** ManaBox spelling (e.g. `zh_TW`); convert with `toScryfallLang` for lookups. */
  language: string
  misprint: boolean
  altered: boolean

  /** Total copies held. Summed across duplicate rows during import. */
  quantity: number

  // ── Refreshable payload (kept for offline display; Scryfall is the source of truth) ──
  name: string
  setCode: string
  collectorNumber: string

  // ── User-owned data. An import merges into these, never overwrites them. ──
  /** Where the card physically lives — seeded from ManaBox's binder name. */
  storageLocation: string
  /** Free-text note the user attached to this stack. */
  note: string
  /** Per-copy acquisition price, dot-decimal, '' when unknown. */
  purchasePrice: string
  purchaseCurrency: string
  /** ISO date this stack first entered the collection. */
  addedAt: string
}

/**
 * The identity of a card stack, as a single string.
 *
 * Deliberately excludes quantity (that is the measured value) and every derived
 * column. Including `name` or `rarity` here would make an unchanged collection
 * diff as a full rewrite the moment ManaBox re-canonicalised them.
 */
export function entryKey(entry: {
  scryfallId: string
  finish: Finish
  condition: Condition
  language: string
  misprint: boolean
  altered: boolean
}): string {
  return [
    entry.scryfallId,
    entry.finish,
    entry.condition,
    entry.language,
    entry.misprint ? '1' : '0',
    entry.altered ? '1' : '0'
  ].join('|')
}

/**
 * Sort collection entries into a canonical order.
 *
 * On-disk order must not depend on import order: the collection file is
 * destined for a private git repo with a nightly diff, so an unchanged
 * collection has to serialise byte-identically.
 */
export function sortEntries(entries: CollectionEntry[]): CollectionEntry[] {
  return [...entries].sort((a, b) => entryKey(a).localeCompare(entryKey(b)))
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────

/**
 * A card the user wants but does not own. Seeded from ManaBox binders of type
 * `list`, and extendable from deck shortfalls.
 */
export interface WishlistEntry {
  /** Printing id when a specific printing is wanted, '' when any will do. */
  scryfallId: string
  /** Oracle id — the stable "this card" identity across printings. */
  oracleId: string
  name: string
  quantity: number
  /** Why it is wanted, e.g. "Fehlt in Deck: Edgar Markov". */
  reason: string
  /** Deck id this need originated from, '' when added manually. */
  deckId: string
  priority: 'low' | 'normal' | 'high'
  note: string
  addedAt: string
}

// ─── Decks ────────────────────────────────────────────────────────────────────

/** Scryfall legality keys we surface as deck formats, in menu order. */
export const DECK_FORMATS = [
  'commander',
  'pioneer',
  'modern',
  'standard',
  'legacy',
  'vintage',
  'pauper',
  'duel',
  'brawl',
  'paupercommander',
  'oathbreaker',
  'premodern'
] as const
export type DeckFormat = (typeof DECK_FORMATS)[number]

export const DECK_FORMAT_LABELS: Record<DeckFormat, string> = {
  commander: 'Commander',
  pioneer: 'Pioneer',
  modern: 'Modern',
  standard: 'Standard',
  legacy: 'Legacy',
  vintage: 'Vintage',
  pauper: 'Pauper',
  duel: 'Duel Commander',
  brawl: 'Brawl',
  paupercommander: 'Pauper Commander',
  oathbreaker: 'Oathbreaker',
  premodern: 'Premodern'
}

/** Which pile of a deck a card sits in. */
export type DeckZone = 'main' | 'sideboard' | 'commander' | 'maybe'

export interface DeckCard {
  /** Oracle id — a deck wants "a Sol Ring", not one specific printing. */
  oracleId: string
  name: string
  quantity: number
  zone: DeckZone
  /** Pinned printing, when the user cares which one goes in the sleeve. */
  scryfallId: string
  note: string
}

export interface Deck {
  id: string
  name: string
  format: DeckFormat
  cards: DeckCard[]
  /** Free-text notes — the user asked to annotate decks. */
  note: string
  createdAt: string
  updatedAt: string
}

/** Deck files are sorted too, for the same git-diff reason as the collection. */
export function sortDeckCards(cards: DeckCard[]): DeckCard[] {
  const zoneOrder: Record<DeckZone, number> = { commander: 0, main: 1, sideboard: 2, maybe: 3 }
  return [...cards].sort(
    (a, b) => zoneOrder[a.zone] - zoneOrder[b.zone] || a.name.localeCompare(b.name)
  )
}

// ─── Money ────────────────────────────────────────────────────────────────────

/**
 * Parse a dot-decimal price into integer cents. ManaBox writes plain
 * dot-decimals with no thousands separator and trims trailing zeros
 * (`12.00` → `12.0`), even for German-locale users — so locale-aware parsing
 * would be wrong here.
 */
export function parsePriceToCents(input: string): number {
  const match = input.trim().match(/^(-?)(\d*)(?:\.(\d+))?$/)
  if (!match) return 0
  const [, sign, intPart, fracPart = ''] = match
  const whole = Number(intPart || '0')
  const cents = Number((fracPart + '00').slice(0, 2))
  const roundUp = fracPart.length > 2 && Number(fracPart[2]) >= 5 ? 1 : 0
  const total = whole * 100 + cents + roundUp
  return sign === '-' ? -total : total
}

export function formatCents(cents: number, currency = '€'): string {
  const amount = (cents / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return `${amount} ${currency}`
}
