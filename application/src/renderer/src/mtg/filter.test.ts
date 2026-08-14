import { describe, it, expect } from 'vitest'
import {
  parseQuery,
  filterCards,
  computeStats,
  facets,
  enrich,
  unitPriceCents,
  EMPTY_FILTER,
  isFilterActive,
  type EnrichedCard
} from './filter'
import { encodeLegalities, type OracleCard, type PrintingCard } from '../../../shared/scryfall-model'
import type { CollectionEntry } from './model'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const entry = (over: Partial<CollectionEntry> = {}): CollectionEntry => ({
  scryfallId: 'p-1',
  finish: 'normal',
  condition: 'near_mint',
  language: 'en',
  misprint: false,
  altered: false,
  quantity: 1,
  name: 'Card',
  setCode: 'xxx',
  collectorNumber: '1',
  storageLocation: '',
  note: '',
  purchasePrice: '',
  purchaseCurrency: '',
  addedAt: '2026-08-14',
  ...over
})

const oracle = (over: Partial<OracleCard> = {}): OracleCard => ({
  oracleId: 'o-1',
  name: 'Card',
  manaCost: '{G}',
  cmc: 1,
  typeLine: 'Creature — Elf',
  oracleText: '',
  colors: ['G'],
  colorIdentity: ['G'],
  keywords: [],
  layout: 'normal',
  legalities: encodeLegalities({ commander: 'legal', modern: 'legal' }),
  reserved: false,
  edhrecRank: null,
  faces: [],
  defaultPrintingId: 'p-1',
  ...over
})

const printing = (over: Partial<PrintingCard> = {}): PrintingCard => ({
  id: 'p-1',
  oracleId: 'o-1',
  name: 'Card',
  set: 'xxx',
  setName: 'Test Set',
  collectorNumber: '1',
  rarity: 'common',
  releasedAt: '2020-01-01',
  finishes: ['nonfoil'],
  lang: 'en',
  prices: { eur: '1.00', eurFoil: '5.00', usd: null, usdFoil: null },
  imageNormal: '',
  imageSmall: '',
  scryfallUri: '',
  ...over
})

const card = (
  e: Partial<CollectionEntry> = {},
  o: Partial<OracleCard> | null = {},
  p: Partial<PrintingCard> | null = {}
): EnrichedCard => ({
  entry: entry(e),
  oracle: o === null ? null : oracle(o),
  printing: p === null ? null : printing(p)
})

// ─── Query parsing ────────────────────────────────────────────────────────────

describe('parseQuery', () => {
  it('splits fields, comparators and bare words', () => {
    expect(parseQuery('t:creature cmc>=3 goblin')).toEqual([
      { field: 't', comparator: ':', value: 'creature', negated: false },
      { field: 'cmc', comparator: '>=', value: '3', negated: false },
      { field: '', comparator: ':', value: 'goblin', negated: false }
    ])
  })

  it('supports negation and quoted values', () => {
    const terms = parseQuery('-t:land t:"legendary creature"')
    expect(terms[0]).toMatchObject({ field: 't', value: 'land', negated: true })
    expect(terms[1]).toMatchObject({ field: 't', value: 'legendary creature' })
  })

  it('returns nothing for an empty query', () => {
    expect(parseQuery('   ')).toEqual([])
  })
})

// ─── Filtering ────────────────────────────────────────────────────────────────

describe('filterCards', () => {
  const cards = [
    card({ name: 'Llanowar Elves', quantity: 4 }, { typeLine: 'Creature — Elf Druid', cmc: 1 }),
    card(
      { name: 'Wrath of God', setCode: 'ltr', quantity: 1, finish: 'foil' },
      { typeLine: 'Sorcery', cmc: 4, colorIdentity: ['W'], colors: ['W'] },
      { rarity: 'rare' }
    ),
    card(
      { name: 'Sol Ring', quantity: 2 },
      {
        typeLine: 'Artifact',
        cmc: 1,
        colorIdentity: [],
        colors: [],
        legalities: encodeLegalities({ commander: 'legal', modern: 'banned' })
      },
      { rarity: 'uncommon' }
    )
  ]

  it('returns everything for an empty filter', () => {
    expect(filterCards(cards, EMPTY_FILTER)).toHaveLength(3)
    expect(isFilterActive(EMPTY_FILTER)).toBe(false)
  })

  it('filters by type via the text query', () => {
    const result = filterCards(cards, { ...EMPTY_FILTER, text: 't:creature' })
    expect(result.map((c) => c.entry.name)).toEqual(['Llanowar Elves'])
  })

  it('applies numeric comparators', () => {
    expect(filterCards(cards, { ...EMPTY_FILTER, text: 'cmc>=4' })).toHaveLength(1)
    expect(filterCards(cards, { ...EMPTY_FILTER, text: 'cmc<=1' })).toHaveLength(2)
  })

  it('honours negation', () => {
    const result = filterCards(cards, { ...EMPTY_FILTER, text: '-t:creature' })
    expect(result.map((c) => c.entry.name).sort()).toEqual(['Sol Ring', 'Wrath of God'])
  })

  it('combines terms with AND', () => {
    expect(filterCards(cards, { ...EMPTY_FILTER, text: 't:artifact cmc:1' })).toHaveLength(1)
    expect(filterCards(cards, { ...EMPTY_FILTER, text: 't:artifact cmc:4' })).toHaveLength(0)
  })

  it('finds colourless cards with c:c and colour identity with ci:', () => {
    expect(filterCards(cards, { ...EMPTY_FILTER, text: 'ci:c' }).map((c) => c.entry.name)).toEqual([
      'Sol Ring'
    ])
    expect(filterCards(cards, { ...EMPTY_FILTER, text: 'c:w' }).map((c) => c.entry.name)).toEqual([
      'Wrath of God'
    ])
  })

  it('filters on format legality and excludes banned cards', () => {
    // Sol Ring is banned in modern — "legal in modern" must not return it.
    const modern = filterCards(cards, { ...EMPTY_FILTER, legalIn: 'modern' })
    expect(modern.map((c) => c.entry.name).sort()).toEqual(['Llanowar Elves', 'Wrath of God'])

    const commander = filterCards(cards, { ...EMPTY_FILTER, legalIn: 'commander' })
    expect(commander).toHaveLength(3)
  })

  it('finds banned cards explicitly', () => {
    const result = filterCards(cards, { ...EMPTY_FILTER, text: 'banned:modern' })
    expect(result.map((c) => c.entry.name)).toEqual(['Sol Ring'])
  })

  it('filters by structured controls', () => {
    expect(filterCards(cards, { ...EMPTY_FILTER, sets: ['ltr'] })).toHaveLength(1)
    expect(filterCards(cards, { ...EMPTY_FILTER, rarities: ['rare'] })).toHaveLength(1)
    expect(filterCards(cards, { ...EMPTY_FILTER, finishes: ['foil'] })).toHaveLength(1)
    expect(filterCards(cards, { ...EMPTY_FILTER, minQuantity: 2 })).toHaveLength(2)
    expect(filterCards(cards, { ...EMPTY_FILTER, cmcMin: 2, cmcMax: 5 })).toHaveLength(1)
  })

  it('matches colour identity exactly and at-most', () => {
    const exact = filterCards(cards, { ...EMPTY_FILTER, colors: ['w'], colorMode: 'exact' })
    expect(exact.map((c) => c.entry.name)).toEqual(['Wrath of God'])

    // "at most green" includes colourless cards, which fit in any deck.
    const atMost = filterCards(cards, { ...EMPTY_FILTER, colors: ['g'], colorMode: 'atMost' })
    expect(atMost.map((c) => c.entry.name).sort()).toEqual(['Llanowar Elves', 'Sol Ring'])
  })

  it('finds cards Scryfall has not resolved yet', () => {
    const withUnknown = [...cards, card({ name: 'Mystery Card' }, null, null)]
    const result = filterCards(withUnknown, { ...EMPTY_FILTER, text: 'is:unknown' })
    expect(result.map((c) => c.entry.name)).toEqual(['Mystery Card'])
  })

  it('searches storage location, so "where is this card" works', () => {
    const stored = [card({ name: 'A', storageLocation: 'Tresor, Fach 3' }), ...cards]
    expect(filterCards(stored, { ...EMPTY_FILTER, text: 'loc:tresor' })).toHaveLength(1)
    expect(filterCards(stored, { ...EMPTY_FILTER, storageLocations: ['fach 3'] })).toHaveLength(1)
  })

  it('does not crash on cards without Scryfall data', () => {
    const unresolved = [card({ name: 'Unknown' }, null, null)]
    expect(() => filterCards(unresolved, { ...EMPTY_FILTER, text: 't:creature' })).not.toThrow()
    expect(filterCards(unresolved, { ...EMPTY_FILTER, text: 't:creature' })).toHaveLength(0)
    // A name search still finds it, since the name lives on the entry.
    expect(filterCards(unresolved, { ...EMPTY_FILTER, text: 'unknown' })).toHaveLength(1)
  })
})

// ─── Pricing ──────────────────────────────────────────────────────────────────

describe('unitPriceCents', () => {
  it('uses the foil price for foil and etched stacks', () => {
    expect(unitPriceCents(card({ finish: 'normal' }))).toBe(100)
    expect(unitPriceCents(card({ finish: 'foil' }))).toBe(500)
    expect(unitPriceCents(card({ finish: 'etched' }))).toBe(500)
  })

  it('falls back to the non-foil price when no foil price exists', () => {
    const noFoil = card({ finish: 'foil' }, {}, { prices: { eur: '2.00', eurFoil: null, usd: null, usdFoil: null } })
    expect(unitPriceCents(noFoil)).toBe(200)
  })

  it('is zero for cards with no cached printing', () => {
    expect(unitPriceCents(card({}, {}, null))).toBe(0)
  })
})

// ─── Stats ────────────────────────────────────────────────────────────────────

describe('computeStats', () => {
  it('separates stacks, physical cards and distinct oracle cards', () => {
    const cards = [
      card({ scryfallId: 'a', quantity: 4 }, { oracleId: 'same' }),
      // Same card, different printing — one distinct card, more copies.
      card({ scryfallId: 'b', quantity: 2 }, { oracleId: 'same' }),
      card({ scryfallId: 'c', quantity: 1 }, { oracleId: 'other' })
    ]
    const stats = computeStats(cards)
    expect(stats.stacks).toBe(3)
    expect(stats.cards).toBe(7)
    expect(stats.distinctCards).toBe(2)
  })

  it('multiplies value by quantity and tracks what was paid separately', () => {
    const cards = [card({ quantity: 3, purchasePrice: '0.50' })]
    const stats = computeStats(cards)
    expect(stats.valueCents).toBe(300)
    expect(stats.purchaseCents).toBe(150)
  })

  it('excludes lands from the mana curve', () => {
    const cards = [
      card({ quantity: 4 }, { cmc: 0, typeLine: 'Basic Land — Forest' }),
      card({ quantity: 2 }, { cmc: 2, typeLine: 'Creature — Bear' })
    ]
    const curve = computeStats(cards).manaCurve
    expect(curve.find((b) => b.cmc === '0')!.count).toBe(0)
    expect(curve.find((b) => b.cmc === '2')!.count).toBe(2)
  })

  it('buckets everything at 7 and above together', () => {
    const cards = [card({ quantity: 1 }, { cmc: 12, typeLine: 'Creature — Eldrazi' })]
    expect(computeStats(cards).manaCurve.find((b) => b.cmc === '7+')!.count).toBe(1)
  })

  it('counts multicoloured cards under each of their colours', () => {
    const cards = [card({ quantity: 1 }, { colorIdentity: ['W', 'U'] })]
    const breakdown = computeStats(cards).colorBreakdown
    expect(breakdown.find((b) => b.color === 'Weiß')!.count).toBe(1)
    expect(breakdown.find((b) => b.color === 'Blau')!.count).toBe(1)
  })

  it('reports unresolved cards instead of hiding them', () => {
    const stats = computeStats([card({ quantity: 1 }, null, null), card({ quantity: 1 })])
    expect(stats.unresolved).toBe(1)
    // Unresolved cards still count as owned cards.
    expect(stats.cards).toBe(2)
  })
})

describe('facets', () => {
  it('lists sets, locations and languages present in the collection', () => {
    const cards = [
      card({ setCode: 'ltr', storageLocation: 'Box A', language: 'de', quantity: 2 }, {}, { setName: 'Lord of the Rings' }),
      card({ setCode: 'cmr', storageLocation: 'Box B', language: 'en' }, {}, { setName: 'Commander Legends' })
    ]
    const result = facets(cards)
    expect(result.sets.map((s) => s.code).sort()).toEqual(['cmr', 'ltr'])
    expect(result.sets.find((s) => s.code === 'ltr')!.count).toBe(2)
    expect(result.locations).toEqual(['Box A', 'Box B'])
    expect(result.languages).toEqual(['de', 'en'])
  })
})

// ─── Enrichment ───────────────────────────────────────────────────────────────

describe('enrich', () => {
  it('joins collection entries to printing and oracle data', () => {
    const collection = [entry({ scryfallId: 'p-1', name: 'Card' })]
    const result = enrich(
      collection,
      new Map([['p-1', printing()]]),
      new Map([['o-1', oracle()]]),
      new Map([['card', oracle()]])
    )
    expect(result[0].printing?.setName).toBe('Test Set')
    expect(result[0].oracle?.oracleId).toBe('o-1')
  })

  it('falls back to a name lookup before the printing cache is filled', () => {
    const collection = [entry({ scryfallId: 'not-cached', name: 'Llanowar Elves' })]
    const result = enrich(
      collection,
      new Map(),
      new Map(),
      new Map([['llanowar elves', oracle({ name: 'Llanowar Elves' })]])
    )
    expect(result[0].printing).toBeNull()
    expect(result[0].oracle?.name).toBe('Llanowar Elves')
  })

  it('resolves a double-faced card stored under its front-face name', () => {
    const collection = [entry({ scryfallId: 'x', name: 'Delver of Secrets' })]
    const dfc = oracle({ name: 'Delver of Secrets // Insectile Aberration' })
    const result = enrich(collection, new Map(), new Map(), new Map([['delver of secrets', dfc]]))
    expect(result[0].oracle?.name).toContain('Insectile Aberration')
  })
})
