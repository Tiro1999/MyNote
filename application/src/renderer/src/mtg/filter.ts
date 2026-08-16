/**
 * Filtering and aggregation over the collection.
 *
 * Two ways in, because a collection manager needs both: structured controls for
 * the things you browse by (colour, type, rarity, set, condition), and a text
 * query with a Scryfall-like operator subset for the things you look up
 * (`t:creature cmc<=3 c:g`). Both compile to the same predicate list.
 *
 * Performance shape: one linear pass with cheap predicates. At 50k stacks that
 * is a few milliseconds — no index structures needed, and none that could go
 * stale against the collection.
 */
import { decodeLegality, type OracleCard, type PrintingCard } from '../../../shared/scryfall-model'
import type { LegalityFormat } from '../../../shared/scryfall-model'
import { parsePriceToCents, type CollectionEntry, type Condition, type Finish } from './model'

/** A collection stack joined with whatever Scryfall data is cached for it. */
export interface EnrichedCard {
  entry: CollectionEntry
  printing: PrintingCard | null
  oracle: OracleCard | null
}

export function enrich(
  collection: CollectionEntry[],
  printingById: Map<string, PrintingCard>,
  oracleById: Map<string, OracleCard>,
  oracleByName: Map<string, OracleCard>
): EnrichedCard[] {
  return collection.map((entry) => {
    const printing = printingById.get(entry.scryfallId) ?? null
    // Prefer the printing's oracle id; fall back to a name lookup so cards
    // work even before the printing cache has been filled.
    const oracle =
      (printing ? oracleById.get(printing.oracleId) : null) ??
      oracleByName.get(entry.name.toLowerCase()) ??
      oracleByName.get(entry.name.split(' // ')[0].toLowerCase()) ??
      null
    return { entry, printing, oracle }
  })
}

// ─── Filter model ─────────────────────────────────────────────────────────────

export type ColorMode = 'includes' | 'exact' | 'atMost'

export interface CardFilter {
  /** Free text plus Scryfall-style operators. */
  text: string
  /** WUBRG plus C for colourless. Matched against colour identity. */
  colors: string[]
  colorMode: ColorMode
  /** Type-line fragments, all of which must appear (e.g. legendary + creature). */
  types: string[]
  rarities: string[]
  sets: string[]
  finishes: Finish[]
  conditions: Condition[]
  languages: string[]
  storageLocations: string[]
  cmcMin: number | null
  cmcMax: number | null
  /** Per-copy price bounds in cents. */
  priceMinCents: number | null
  priceMaxCents: number | null
  /** Only cards legal in this format (banned/restricted excluded). */
  legalIn: LegalityFormat | null
  minQuantity: number | null
}

export const EMPTY_FILTER: CardFilter = {
  text: '',
  colors: [],
  colorMode: 'includes',
  types: [],
  rarities: [],
  sets: [],
  finishes: [],
  conditions: [],
  languages: [],
  storageLocations: [],
  cmcMin: null,
  cmcMax: null,
  priceMinCents: null,
  priceMaxCents: null,
  legalIn: null,
  minQuantity: null
}

export function isFilterActive(filter: CardFilter): boolean {
  return JSON.stringify(filter) !== JSON.stringify(EMPTY_FILTER)
}

// ─── Text query ───────────────────────────────────────────────────────────────

export type Comparator = ':' | '=' | '>' | '<' | '>=' | '<='

export interface QueryTerm {
  /** '' for a bare word (free text over name and rules text). */
  field: string
  comparator: Comparator
  value: string
  negated: boolean
}

/**
 * Split a query into terms. Supports `field:value`, comparators for numeric
 * fields, `-` negation, and quoted values so `t:"legendary creature"` works.
 */
export function parseQuery(query: string): QueryTerm[] {
  const terms: QueryTerm[] = []
  // field(:|>=|<=|>|<|=)value, where value is quoted or unquoted
  const pattern = /(-?)(?:([a-z]+)(>=|<=|>|<|=|:))?("([^"]*)"|[^\s]+)/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(query)) !== null) {
    const [, negation, field, comparator, rawValue, quotedValue] = match
    const value = (quotedValue ?? rawValue ?? '').replace(/^"|"$/g, '')
    if (value.length === 0) continue
    terms.push({
      field: (field ?? '').toLowerCase(),
      comparator: (comparator ?? ':') as Comparator,
      value,
      negated: negation === '-'
    })
  }
  return terms
}

const COLOR_LETTERS = new Set(['w', 'u', 'b', 'r', 'g', 'c'])

/** Expand colour shorthand (`gw`, `azorius`) into letters. */
function parseColors(value: string): string[] {
  const guilds: Record<string, string> = {
    azorius: 'wu',
    dimir: 'ub',
    rakdos: 'br',
    gruul: 'rg',
    selesnya: 'gw',
    orzhov: 'wb',
    izzet: 'ur',
    golgari: 'bg',
    boros: 'rw',
    simic: 'gu',
    colorless: 'c',
    white: 'w',
    blue: 'u',
    black: 'b',
    red: 'r',
    green: 'g'
  }
  const lower = value.toLowerCase()
  const expanded = guilds[lower] ?? lower
  return [...expanded].filter((char) => COLOR_LETTERS.has(char))
}

/**
 * Scryfall's rarity ordering, so `r>=rare` works. Verified against the live API:
 * `special` sits BELOW `mythic`, which is not the intuitive order.
 */
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'special', 'mythic', 'bonus']

function compareNumber(actual: number, comparator: Comparator, expected: number): boolean {
  switch (comparator) {
    case '>':
      return actual > expected
    case '<':
      return actual < expected
    case '>=':
      return actual >= expected
    case '<=':
      return actual <= expected
    default:
      return actual === expected
  }
}

/** Colour-identity comparison shared by the text query and the colour buttons. */
function matchesColors(identity: string[], wanted: string[], mode: ColorMode): boolean {
  const cardColors = new Set(identity.map((color) => color.toLowerCase()))
  const wantColorless = wanted.includes('c')
  const wantedColors = wanted.filter((color) => color !== 'c')

  if (wantColorless && wantedColors.length === 0) {
    return mode === 'atMost' ? cardColors.size === 0 : cardColors.size === 0
  }

  switch (mode) {
    case 'exact':
      return (
        cardColors.size === wantedColors.length &&
        wantedColors.every((color) => cardColors.has(color))
      )
    case 'atMost':
      return [...cardColors].every((color) => wantedColors.includes(color))
    default:
      return wantedColors.every((color) => cardColors.has(color))
  }
}

/** Evaluate one query term against a card. */
function matchesTerm(card: EnrichedCard, term: QueryTerm): boolean {
  const { entry, printing, oracle } = card
  const value = term.value.toLowerCase()

  switch (term.field) {
    case '': {
      // Bare word: name, type line and rules text.
      const haystack = [entry.name, oracle?.typeLine ?? '', oracle?.oracleText ?? '']
        .join(' ')
        .toLowerCase()
      return haystack.includes(value)
    }
    case 'name':
    case 'n':
      return entry.name.toLowerCase().includes(value)
    case 'type':
    case 't':
      return (oracle?.typeLine ?? '').toLowerCase().includes(value)
    case 'oracle':
    case 'o':
      return (oracle?.oracleText ?? '').toLowerCase().includes(value)
    case 'color':
    case 'c':
      return matchesColors(oracle?.colors ?? [], parseColors(value), 'includes')
    case 'identity':
    case 'ci':
    case 'id':
      return matchesColors(oracle?.colorIdentity ?? [], parseColors(value), 'atMost')
    case 'cmc':
    case 'mv':
      return compareNumber(oracle?.cmc ?? 0, term.comparator, Number(value))
    case 'rarity':
    case 'r': {
      const actual = (printing?.rarity ?? '').toLowerCase()
      if (term.comparator === ':' || term.comparator === '=') return actual === value
      const actualRank = RARITY_ORDER.indexOf(actual)
      const wantedRank = RARITY_ORDER.indexOf(value)
      // An unknown rarity on either side can't be ordered — don't guess.
      if (actualRank < 0 || wantedRank < 0) return false
      return compareNumber(actualRank, term.comparator, wantedRank)
    }
    case 'keyword':
    case 'kw':
      return (oracle?.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(value))
    case 'set':
    case 's':
    case 'e':
      return entry.setCode.toLowerCase() === value
    case 'quantity':
    case 'qty':
      return compareNumber(entry.quantity, term.comparator, Number(value))
    case 'lang':
      return entry.language.toLowerCase() === value
    case 'condition':
    case 'cond':
      return entry.condition.toLowerCase().startsWith(value)
    case 'finish':
      return entry.finish === value
    case 'loc':
    case 'storage':
      return entry.storageLocation.toLowerCase().includes(value)
    case 'note':
      return entry.note.toLowerCase().includes(value)
    case 'format':
    case 'f':
      return oracle ? decodeLegality(oracle.legalities, value as LegalityFormat) === 'legal' : false
    case 'banned':
      return oracle
        ? decodeLegality(oracle.legalities, value as LegalityFormat) === 'banned'
        : false
    case 'restricted':
      // Vintage's one-copy list (and digital Timeless). Not a ban — the card is
      // legal, capped at a single copy, so it needs its own operator.
      return oracle
        ? decodeLegality(oracle.legalities, value as LegalityFormat) === 'restricted'
        : false
    case 'is':
      switch (value) {
        case 'foil':
          return entry.finish === 'foil' || entry.finish === 'etched'
        case 'etched':
          return entry.finish === 'etched'
        case 'altered':
          return entry.altered
        case 'misprint':
          return entry.misprint
        case 'reserved':
          return oracle?.reserved ?? false
        case 'unknown':
          // Cards Scryfall data has not resolved for — worth finding.
          return oracle === null
        default:
          return false
      }
    default:
      // Unknown field: treat the whole token as free text rather than
      // silently dropping the term (which would widen the result set).
      return entry.name.toLowerCase().includes(`${term.field}${term.comparator}${value}`)
  }
}

// ─── Filtering ────────────────────────────────────────────────────────────────

export function filterCards(cards: EnrichedCard[], filter: CardFilter): EnrichedCard[] {
  const terms = parseQuery(filter.text)
  const sets = new Set(filter.sets.map((set) => set.toLowerCase()))
  const rarities = new Set(filter.rarities.map((rarity) => rarity.toLowerCase()))
  const languages = new Set(filter.languages.map((lang) => lang.toLowerCase()))
  const locations = filter.storageLocations.map((location) => location.toLowerCase())
  const types = filter.types.map((type) => type.toLowerCase())

  return cards.filter((card) => {
    const { entry, printing, oracle } = card

    for (const term of terms) {
      if (matchesTerm(card, term) === term.negated) return false
    }

    if (filter.colors.length > 0) {
      if (!matchesColors(oracle?.colorIdentity ?? [], filter.colors, filter.colorMode)) return false
    }

    if (types.length > 0) {
      const typeLine = (oracle?.typeLine ?? '').toLowerCase()
      if (!types.every((type) => typeLine.includes(type))) return false
    }

    if (rarities.size > 0 && !rarities.has((printing?.rarity ?? '').toLowerCase())) return false
    if (sets.size > 0 && !sets.has(entry.setCode.toLowerCase())) return false
    if (filter.finishes.length > 0 && !filter.finishes.includes(entry.finish)) return false
    if (filter.conditions.length > 0 && !filter.conditions.includes(entry.condition)) return false
    if (languages.size > 0 && !languages.has(entry.language.toLowerCase())) return false

    if (locations.length > 0) {
      const location = entry.storageLocation.toLowerCase()
      if (!locations.some((wanted) => location.includes(wanted))) return false
    }

    if (filter.cmcMin !== null && (oracle?.cmc ?? 0) < filter.cmcMin) return false
    if (filter.cmcMax !== null && (oracle?.cmc ?? 0) > filter.cmcMax) return false

    if (filter.priceMinCents !== null || filter.priceMaxCents !== null) {
      const cents = unitPriceCents(card)
      if (filter.priceMinCents !== null && cents < filter.priceMinCents) return false
      if (filter.priceMaxCents !== null && cents > filter.priceMaxCents) return false
    }

    if (filter.legalIn && oracle) {
      if (decodeLegality(oracle.legalities, filter.legalIn) !== 'legal') return false
    }

    if (filter.minQuantity !== null && entry.quantity < filter.minQuantity) return false

    return true
  })
}

// ─── Aggregates ───────────────────────────────────────────────────────────────

/** Current market price per copy, in cents, honouring the stack's finish. */
export function unitPriceCents(card: EnrichedCard): number {
  const prices = card.printing?.prices
  if (!prices) return 0
  const foil = card.entry.finish !== 'normal'
  const price = foil ? (prices.eurFoil ?? prices.eur) : (prices.eur ?? prices.eurFoil)
  return parsePriceToCents(price ?? '')
}

export interface CollectionStats {
  /** Number of stacks matching. */
  stacks: number
  /** Number of physical cards. */
  cards: number
  /** Distinct oracle cards (a playset of one card counts once). */
  distinctCards: number
  /** Market value of everything matched, in cents. */
  valueCents: number
  /** Amount actually paid, where recorded, in cents. */
  purchaseCents: number
  /** Cards per converted mana cost, capped at 7+. */
  manaCurve: Array<{ cmc: string; count: number }>
  colorBreakdown: Array<{ color: string; count: number }>
  rarityBreakdown: Array<{ rarity: string; count: number }>
  typeBreakdown: Array<{ type: string; count: number }>
  /** Stacks with no Scryfall data yet — the honest "unknown" bucket. */
  unresolved: number
}

const COLOR_NAMES: Record<string, string> = {
  W: 'Weiß',
  U: 'Blau',
  B: 'Schwarz',
  R: 'Rot',
  G: 'Grün'
}

/** The card types worth charting, in the order players think about them. */
const MAJOR_TYPES = [
  'Creature',
  'Instant',
  'Sorcery',
  'Artifact',
  'Enchantment',
  'Planeswalker',
  'Battle',
  'Land'
]

export function computeStats(cards: EnrichedCard[]): CollectionStats {
  const curve = new Map<string, number>()
  const colors = new Map<string, number>()
  const rarities = new Map<string, number>()
  const types = new Map<string, number>()
  const oracleIds = new Set<string>()

  let cardCount = 0
  let valueCents = 0
  let purchaseCents = 0
  let unresolved = 0

  for (const card of cards) {
    const { entry, printing, oracle } = card
    cardCount += entry.quantity
    valueCents += unitPriceCents(card) * entry.quantity
    purchaseCents += parsePriceToCents(entry.purchasePrice) * entry.quantity

    if (!oracle) {
      unresolved++
      continue
    }
    oracleIds.add(oracle.oracleId)

    // Lands have no meaningful mana value; charting them flattens the curve.
    if (!oracle.typeLine.includes('Land')) {
      const bucket = oracle.cmc >= 7 ? '7+' : String(Math.floor(oracle.cmc))
      curve.set(bucket, (curve.get(bucket) ?? 0) + entry.quantity)
    }

    if (oracle.colorIdentity.length === 0) {
      colors.set('Farblos', (colors.get('Farblos') ?? 0) + entry.quantity)
    } else {
      for (const color of oracle.colorIdentity) {
        const name = COLOR_NAMES[color] ?? color
        colors.set(name, (colors.get(name) ?? 0) + entry.quantity)
      }
    }

    if (printing?.rarity) {
      rarities.set(printing.rarity, (rarities.get(printing.rarity) ?? 0) + entry.quantity)
    }

    for (const type of MAJOR_TYPES) {
      if (oracle.typeLine.includes(type)) {
        types.set(type, (types.get(type) ?? 0) + entry.quantity)
      }
    }
  }

  const curveOrder = ['0', '1', '2', '3', '4', '5', '6', '7+']
  return {
    stacks: cards.length,
    cards: cardCount,
    distinctCards: oracleIds.size,
    valueCents,
    purchaseCents,
    manaCurve: curveOrder.map((cmc) => ({ cmc, count: curve.get(cmc) ?? 0 })),
    colorBreakdown: [...colors.entries()]
      .map(([color, count]) => ({ color, count }))
      .sort((a, b) => b.count - a.count),
    rarityBreakdown: [...rarities.entries()]
      .map(([rarity, count]) => ({ rarity, count }))
      .sort((a, b) => b.count - a.count),
    typeBreakdown: [...types.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    unresolved
  }
}

/** Distinct values present in the collection, for populating filter dropdowns. */
export function facets(cards: EnrichedCard[]): {
  sets: Array<{ code: string; name: string; count: number }>
  locations: string[]
  languages: string[]
} {
  const sets = new Map<string, { name: string; count: number }>()
  const locations = new Set<string>()
  const languages = new Set<string>()

  for (const { entry, printing } of cards) {
    if (entry.setCode) {
      const existing = sets.get(entry.setCode)
      sets.set(entry.setCode, {
        name: printing?.setName || existing?.name || entry.setCode.toUpperCase(),
        count: (existing?.count ?? 0) + entry.quantity
      })
    }
    if (entry.storageLocation) locations.add(entry.storageLocation)
    if (entry.language) languages.add(entry.language)
  }

  return {
    sets: [...sets.entries()]
      .map(([code, { name, count }]) => ({ code, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    locations: [...locations].sort((a, b) => a.localeCompare(b)),
    languages: [...languages].sort()
  }
}
