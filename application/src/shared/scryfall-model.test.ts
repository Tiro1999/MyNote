import { describe, it, expect } from 'vitest'
import {
  LEGALITY_FORMATS,
  encodeLegalities,
  decodeLegality,
  decodeAllLegalities,
  toOracleCard,
  toPrintingCard,
  type RawCard
} from './scryfall-model'

describe('legality encoding', () => {
  it('round-trips every legality value', () => {
    const legalities = {
      standard: 'not_legal',
      pioneer: 'legal',
      legacy: 'banned',
      vintage: 'restricted',
      commander: 'legal'
    }
    const encoded = encodeLegalities(legalities)
    expect(encoded).toHaveLength(LEGALITY_FORMATS.length)
    expect(decodeLegality(encoded, 'standard')).toBe('not_legal')
    expect(decodeLegality(encoded, 'pioneer')).toBe('legal')
    expect(decodeLegality(encoded, 'legacy')).toBe('banned')
    expect(decodeLegality(encoded, 'vintage')).toBe('restricted')
    expect(decodeLegality(encoded, 'commander')).toBe('legal')
  })

  it('treats formats absent from the payload as not_legal', () => {
    const encoded = encodeLegalities({ commander: 'legal' })
    expect(decodeLegality(encoded, 'pauper')).toBe('not_legal')
    expect(decodeLegality(encoded, 'commander')).toBe('legal')
  })

  it('is dramatically smaller than the raw object', () => {
    const raw: Record<string, string> = {}
    for (const format of LEGALITY_FORMATS) raw[format] = 'not_legal'
    expect(encodeLegalities(raw).length).toBeLessThan(JSON.stringify(raw).length / 20)
  })

  it('handles a missing legalities object without throwing', () => {
    const encoded = encodeLegalities(undefined)
    expect(encoded).toHaveLength(LEGALITY_FORMATS.length)
    expect(decodeLegality(encoded, 'modern')).toBe('not_legal')
  })

  it('expands into a full record covering every known format', () => {
    const all = decodeAllLegalities(encodeLegalities({ modern: 'legal' }))
    expect(Object.keys(all)).toHaveLength(LEGALITY_FORMATS.length)
    expect(all.modern).toBe('legal')
    expect(all.standard).toBe('not_legal')
  })
})

describe('toOracleCard', () => {
  const single: RawCard = {
    id: 'p1',
    oracle_id: 'o1',
    name: 'Llanowar Elves',
    mana_cost: '{G}',
    cmc: 1,
    type_line: 'Creature — Elf Druid',
    oracle_text: '{T}: Add {G}.',
    colors: ['G'],
    color_identity: ['G'],
    layout: 'normal',
    legalities: { commander: 'legal', modern: 'legal' }
  }

  it('maps a straightforward single-faced card', () => {
    const card = toOracleCard(single)!
    expect(card.name).toBe('Llanowar Elves')
    expect(card.manaCost).toBe('{G}')
    expect(card.cmc).toBe(1)
    expect(card.colorIdentity).toEqual(['G'])
    expect(card.faces).toEqual([])
    expect(decodeLegality(card.legalities, 'commander')).toBe('legal')
  })

  it('rejects rows without an oracle id or name', () => {
    expect(toOracleCard({ name: 'No oracle id' })).toBeNull()
    expect(toOracleCard({ oracle_id: 'o1' })).toBeNull()
  })

  // A transform card has no card-level mana_cost, colors or type_line — they
  // live on each face. Reading them naively yields an empty cost and a 0-drop.
  it('derives cost, colours and type from the front face of a transform card', () => {
    const werewolf: RawCard = {
      id: 'p2',
      oracle_id: 'o2',
      name: 'Delver of Secrets // Insectile Aberration',
      cmc: 1,
      color_identity: ['U'],
      layout: 'transform',
      legalities: { modern: 'legal' },
      card_faces: [
        {
          name: 'Delver of Secrets',
          mana_cost: '{U}',
          type_line: 'Creature — Human Wizard',
          oracle_text: 'At the beginning of your upkeep, look at the top card…',
          colors: ['U']
        },
        {
          name: 'Insectile Aberration',
          mana_cost: '',
          type_line: 'Creature — Human Insect',
          oracle_text: 'Flying',
          colors: ['U']
        }
      ]
    }
    const card = toOracleCard(werewolf)!
    expect(card.manaCost).toBe('{U}')
    expect(card.cmc).toBe(1)
    expect(card.colors).toEqual(['U'])
    expect(card.typeLine).toContain('Human Wizard')
    expect(card.faces).toHaveLength(2)
    expect(card.faces[1].name).toBe('Insectile Aberration')
  })

  it('keeps both halves of a split card addressable', () => {
    const split: RawCard = {
      id: 'p3',
      oracle_id: 'o3',
      name: 'Fire // Ice',
      mana_cost: '{1}{R} // {1}{U}',
      cmc: 4,
      type_line: 'Instant // Instant',
      color_identity: ['R', 'U'],
      layout: 'split',
      legalities: { modern: 'legal' },
      card_faces: [
        { name: 'Fire', mana_cost: '{1}{R}', type_line: 'Instant', colors: ['R'] },
        { name: 'Ice', mana_cost: '{1}{U}', type_line: 'Instant', colors: ['U'] }
      ]
    }
    const card = toOracleCard(split)!
    expect(card.faces.map((f) => f.name)).toEqual(['Fire', 'Ice'])
    expect(card.colorIdentity).toEqual(['R', 'U'])
  })

  // Verified against live Scryfall data: split cards are not always two-faced.
  // "Who // What // When // Where // Why" has five, so no index may be assumed.
  it('handles a five-faced split card', () => {
    const fiveFace: RawCard = {
      id: 'p5',
      oracle_id: 'o5',
      name: 'Who // What // When // Where // Why',
      mana_cost: '{X}{W} // {2}{R} // {2}{U} // {3}{B} // {1}{G}',
      cmc: 13,
      type_line: 'Instant',
      colors: ['B', 'G', 'R', 'U', 'W'],
      color_identity: ['B', 'G', 'R', 'U', 'W'],
      layout: 'split',
      card_faces: ['Who', 'What', 'When', 'Where', 'Why'].map((name) => ({
        name,
        mana_cost: '{1}{G}',
        type_line: 'Instant',
        oracle_text: `${name} text`,
        colors: ['G']
      }))
    }
    const card = toOracleCard(fiveFace)!
    expect(card.faces).toHaveLength(5)
    expect(card.cmc).toBe(13)
    // Card-level cost wins; it already encodes all five halves.
    expect(card.manaCost).toContain('//')
    // Every face's rules text survives, not just the first two.
    for (const name of ['Who', 'What', 'When', 'Where', 'Why']) {
      expect(card.oracleText).toContain(`${name} text`)
    }
  })

  // Split and adventure cards carry no card-level oracle_text — it lives on the
  // faces. Reading only the card level yields an empty, unsearchable card.
  it('falls back to face text when the card level has none', () => {
    const adventure: RawCard = {
      id: 'p6',
      oracle_id: 'o6',
      name: 'Bonecrusher Giant // Stomp',
      mana_cost: '{2}{R} // {1}{R}',
      cmc: 3,
      type_line: 'Creature — Giant // Instant — Adventure',
      colors: ['R'],
      layout: 'adventure',
      card_faces: [
        { name: 'Bonecrusher Giant', oracle_text: 'Whenever Bonecrusher Giant becomes the target…' },
        { name: 'Stomp', oracle_text: 'Damage cannot be prevented this turn.' }
      ]
    }
    const card = toOracleCard(adventure)!
    expect(card.oracleText).toContain('Bonecrusher Giant becomes the target')
    expect(card.oracleText).toContain('Damage cannot be prevented')
  })

  it('unions face colours when the card level omits them', () => {
    const mdfc: RawCard = {
      oracle_id: 'o4',
      name: 'Agadeem\'s Awakening // Agadeem, the Undercrypt',
      cmc: 6,
      color_identity: ['B'],
      layout: 'modal_dfc',
      card_faces: [
        { name: "Agadeem's Awakening", mana_cost: '{X}{B}{B}{B}', type_line: 'Sorcery', colors: ['B'] },
        { name: 'Agadeem, the Undercrypt', mana_cost: '', type_line: 'Land', colors: [] }
      ]
    }
    const card = toOracleCard(mdfc)!
    expect(card.colors).toEqual(['B'])
    expect(card.manaCost).toBe('{X}{B}{B}{B}')
  })
})

describe('toPrintingCard', () => {
  it('maps set-specific fields and prices', () => {
    const raw: RawCard = {
      id: 'p1',
      oracle_id: 'o1',
      name: 'Sol Ring',
      set: 'cmr',
      set_name: 'Commander Legends',
      collector_number: '472',
      rarity: 'uncommon',
      released_at: '2020-11-20',
      finishes: ['nonfoil', 'foil'],
      lang: 'en',
      prices: { eur: '1.50', eur_foil: '4.20', usd: '1.53', usd_foil: null },
      image_uris: { small: 'https://cards.scryfall.io/small/x.jpg', normal: 'https://cards.scryfall.io/normal/x.jpg' }
    }
    const printing = toPrintingCard(raw)!
    expect(printing.set).toBe('cmr')
    expect(printing.collectorNumber).toBe('472')
    expect(printing.prices.eur).toBe('1.50')
    expect(printing.prices.eurFoil).toBe('4.20')
    expect(printing.prices.usdFoil).toBeNull()
    expect(printing.imageSmall).toContain('small')
  })

  it('falls back to the front face image for double-faced printings', () => {
    const raw: RawCard = {
      id: 'p2',
      oracle_id: 'o2',
      name: 'Delver of Secrets // Insectile Aberration',
      layout: 'transform',
      card_faces: [
        { name: 'Delver of Secrets', image_uris: { normal: 'https://cards.scryfall.io/normal/front.jpg' } },
        { name: 'Insectile Aberration', image_uris: { normal: 'https://cards.scryfall.io/normal/back.jpg' } }
      ]
    }
    const printing = toPrintingCard(raw)!
    expect(printing.imageNormal).toContain('front.jpg')
  })

  it('rejects rows without an id or oracle id', () => {
    expect(toPrintingCard({ oracle_id: 'o1' })).toBeNull()
    expect(toPrintingCard({ id: 'p1' })).toBeNull()
  })
})
