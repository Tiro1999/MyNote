import { describe, it, expect } from 'vitest'
import {
  buildSnapshot,
  classifyChange,
  diffSnapshots,
  legalityTags,
  relevantOracleIds,
  scopeChanges,
  sortSnapshot,
  type LegalitySnapshotRow
} from './legality'
import { serializeLegalitySnapshotCsv, parseLegalitySnapshotCsv } from './csv'
import {
  encodeLegalities,
  decodeLegality,
  type OracleCard,
  type PrintingCard
} from '../../../shared/scryfall-model'
import type { CollectionEntry, Deck, WishlistEntry } from './model'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const snapshot = (
  oracleId: string,
  name: string,
  legalities: Record<string, string>
): LegalitySnapshotRow => ({ oracleId, name, legalities: encodeLegalities(legalities) })

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
  addedAt: '2026-08-16',
  ...over
})

const printing = (id: string, oracleId: string): PrintingCard => ({
  id,
  oracleId,
  name: 'Card',
  set: 'xxx',
  setName: 'Set',
  collectorNumber: '1',
  rarity: 'rare',
  releasedAt: '2020-01-01',
  finishes: ['nonfoil'],
  lang: 'en',
  prices: { eur: '', eurFoil: '', usd: '', usdFoil: '' },
  imageNormal: '',
  imageSmall: '',
  scryfallUri: ''
})

const deck = (over: Partial<Deck> = {}): Deck => ({
  id: 'd-1',
  name: 'Mein Deck',
  format: 'modern',
  cards: [],
  note: '',
  createdAt: '2026-08-16',
  updatedAt: '2026-08-16',
  ...over
})

const deckCard = (
  oracleId: string,
  quantity = 1
): Deck['cards'][number] => ({
  oracleId,
  name: 'Card',
  quantity,
  zone: 'main',
  scryfallId: '',
  note: ''
})

// ─── Classification ───────────────────────────────────────────────────────────

describe('classifyChange', () => {
  it('reports nothing when the value is unchanged', () => {
    expect(classifyChange('legal', 'legal')).toBeNull()
    expect(classifyChange('banned', 'banned')).toBeNull()
  })

  it('stays quiet when a card was unplayable before and after', () => {
    // Banning a card that was never in the format's pool changes nothing the
    // user can act on, and unbanning it does not make it playable either.
    expect(classifyChange('not_legal', 'banned')).toBeNull()
    expect(classifyChange('banned', 'not_legal')).toBeNull()
  })

  it('names each transition', () => {
    expect(classifyChange('legal', 'banned')).toBe('banned')
    expect(classifyChange('legal', 'restricted')).toBe('restricted')
    expect(classifyChange('legal', 'not_legal')).toBe('rotated')
    expect(classifyChange('banned', 'legal')).toBe('unbanned')
    expect(classifyChange('restricted', 'legal')).toBe('unrestricted')
    expect(classifyChange('not_legal', 'legal')).toBe('newly_legal')
  })
})

// ─── Diff ─────────────────────────────────────────────────────────────────────

describe('diffSnapshots', () => {
  it('finds a new ban', () => {
    const before = [snapshot('o-1', 'Sol Ring', { modern: 'legal', commander: 'legal' })]
    const after = [snapshot('o-1', 'Sol Ring', { modern: 'banned', commander: 'legal' })]

    const changes = diffSnapshots(before, after)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      oracleId: 'o-1',
      format: 'modern',
      from: 'legal',
      to: 'banned',
      kind: 'banned'
    })
  })

  it('reports nothing when nothing moved', () => {
    const rows = [snapshot('o-1', 'Sol Ring', { modern: 'legal' })]
    expect(diffSnapshots(rows, rows)).toEqual([])
  })

  it('treats unknown cards as new rather than as changes', () => {
    // First run, or a card just added to the collection — not a legality event.
    const after = [snapshot('o-1', 'Sol Ring', { modern: 'legal' })]
    expect(diffSnapshots([], after)).toEqual([])
  })

  it('ignores formats the module does not manage', () => {
    // An Alchemy rebalance must not wake a paper collection up.
    const before = [snapshot('o-1', 'Card', { alchemy: 'legal', historic: 'legal' })]
    const after = [snapshot('o-1', 'Card', { alchemy: 'banned', historic: 'banned' })]
    expect(diffSnapshots(before, after)).toEqual([])
  })

  it('reports every affected format for one card', () => {
    const before = [snapshot('o-1', 'Card', { modern: 'legal', legacy: 'legal', pauper: 'legal' })]
    const after = [snapshot('o-1', 'Card', { modern: 'banned', legacy: 'banned', pauper: 'legal' })]
    expect(diffSnapshots(before, after).map((c) => c.format).sort()).toEqual(['legacy', 'modern'])
  })
})

// ─── Scoping ──────────────────────────────────────────────────────────────────

describe('scopeChanges', () => {
  const printingById = new Map([['p-1', printing('p-1', 'o-1')]])
  const before = [snapshot('o-1', 'Sol Ring', { modern: 'legal', commander: 'legal' })]

  const context = (over: Partial<Parameters<typeof scopeChanges>[1]> = {}) => ({
    decks: [] as Deck[],
    collection: [] as CollectionEntry[],
    wishlist: [] as WishlistEntry[],
    printingById,
    ...over
  })

  it('drops changes on cards the user has no stake in', () => {
    const after = [snapshot('o-1', 'Sol Ring', { modern: 'banned', commander: 'legal' })]
    expect(scopeChanges(diffSnapshots(before, after), context())).toEqual([])
  })

  it('raises an error when a deck of that format holds the card', () => {
    const after = [snapshot('o-1', 'Sol Ring', { modern: 'banned', commander: 'legal' })]
    const events = scopeChanges(diffSnapshots(before, after), {
      ...context({ decks: [deck({ cards: [deckCard('o-1')] })] })
    })

    expect(events).toHaveLength(1)
    expect(events[0].severity).toBe('error')
    expect(events[0].affectedDecks[0].deckName).toBe('Mein Deck')
    expect(events[0].message).toContain('Mein Deck')
  })

  it('does not blame a deck of a different format', () => {
    const after = [snapshot('o-1', 'Sol Ring', { modern: 'banned', commander: 'legal' })]
    const commanderDeck = deck({ format: 'commander', cards: [deckCard('o-1')] })
    const events = scopeChanges(diffSnapshots(before, after), context({ decks: [commanderDeck] }))
    // The card is owned nowhere and only in a Commander deck, so a Modern ban
    // is not this user's problem at all.
    expect(events).toEqual([])
  })

  it('downgrades a ban on an owned card with no deck to information', () => {
    const after = [snapshot('o-1', 'Sol Ring', { modern: 'banned', commander: 'legal' })]
    const events = scopeChanges(
      diffSnapshots(before, after),
      context({ collection: [entry({ quantity: 3 })] })
    )
    expect(events).toHaveLength(1)
    expect(events[0].severity).toBe('info')
    expect(events[0].ownedQuantity).toBe(3)
  })

  it('separates a restriction that breaks a deck from one that does not', () => {
    const after = [snapshot('o-1', 'Sol Ring', { modern: 'restricted', commander: 'legal' })]
    const changes = diffSnapshots(before, after)

    const oneCopy = scopeChanges(changes, context({ decks: [deck({ cards: [deckCard('o-1', 1)] })] }))
    expect(oneCopy[0].severity).toBe('warning')

    const fourCopies = scopeChanges(
      changes,
      context({ decks: [deck({ cards: [deckCard('o-1', 4)] })] })
    )
    expect(fourCopies[0].severity).toBe('error')
    expect(fourCopies[0].message).toContain('du spielst 4')
  })

  it('surfaces an unban on a card the user owns', () => {
    const banned = [snapshot('o-1', 'Sol Ring', { modern: 'banned' })]
    const freed = [snapshot('o-1', 'Sol Ring', { modern: 'legal' })]
    const events = scopeChanges(
      diffSnapshots(banned, freed),
      context({ collection: [entry({ quantity: 2 })] })
    )
    expect(events[0].change.kind).toBe('unbanned')
    expect(events[0].message).toContain('du besitzt 2')
  })

  it('surfaces an unban on a wishlisted card the user does not own', () => {
    const banned = [snapshot('o-1', 'Sol Ring', { modern: 'banned' })]
    const freed = [snapshot('o-1', 'Sol Ring', { modern: 'legal' })]
    const wishlist: WishlistEntry[] = [
      {
        scryfallId: '',
        oracleId: 'o-1',
        name: 'Sol Ring',
        quantity: 1,
        reason: '',
        deckId: '',
        priority: 'normal',
        note: '',
        addedAt: '2026-08-16'
      }
    ]
    const events = scopeChanges(diffSnapshots(banned, freed), context({ wishlist }))
    expect(events[0].onWishlist).toBe(true)
    expect(events[0].message).toContain('Wishlist')
  })

  it('sorts the most urgent event first', () => {
    const beforeTwo = [
      snapshot('o-1', 'Aaa Card', { modern: 'banned' }),
      snapshot('o-2', 'Zzz Card', { modern: 'legal' })
    ]
    const afterTwo = [
      snapshot('o-1', 'Aaa Card', { modern: 'legal' }),
      snapshot('o-2', 'Zzz Card', { modern: 'banned' })
    ]
    const decks = [deck({ cards: [deckCard('o-1'), deckCard('o-2')] })]
    const events = scopeChanges(diffSnapshots(beforeTwo, afterTwo), context({ decks }))
    // The ban outranks the unban despite sorting later alphabetically.
    expect(events.map((e) => e.change.kind)).toEqual(['banned', 'unbanned'])
  })
})

// ─── Tracked set ──────────────────────────────────────────────────────────────

describe('relevantOracleIds', () => {
  it('collects owned, wanted and played cards', () => {
    const ids = relevantOracleIds({
      collection: [entry({ scryfallId: 'p-1' })],
      wishlist: [{ ...({} as WishlistEntry), oracleId: 'o-2' }],
      decks: [deck({ cards: [deckCard('o-3')] })],
      printingById: new Map([['p-1', printing('p-1', 'o-1')]])
    })
    expect([...ids].sort()).toEqual(['o-1', 'o-2', 'o-3'])
  })

  it('skips collection entries whose printing is not cached yet', () => {
    const ids = relevantOracleIds({
      collection: [entry({ scryfallId: 'unknown' })],
      wishlist: [],
      decks: [],
      printingById: new Map()
    })
    expect(ids.size).toBe(0)
  })
})

// ─── Snapshot build and persistence ───────────────────────────────────────────

describe('legality snapshot persistence', () => {
  const oracle = (oracleId: string, name: string, legalities: Record<string, string>): OracleCard =>
    ({
      oracleId,
      name,
      manaCost: '',
      cmc: 0,
      typeLine: '',
      oracleText: '',
      colors: [],
      colorIdentity: [],
      keywords: [],
      layout: 'normal',
      legalities: encodeLegalities(legalities),
      reserved: false,
      edhrecRank: null,
      faces: [],
      defaultPrintingId: ''
    }) satisfies OracleCard

  it('round-trips through the readable CSV form', () => {
    const rows = buildSnapshot(
      new Set(['o-1', 'o-2']),
      new Map([
        ['o-1', oracle('o-1', 'Sol Ring', { commander: 'legal', modern: 'banned' })],
        ['o-2', oracle('o-2', 'Black Lotus', { vintage: 'restricted', legacy: 'banned' })]
      ])
    )
    const parsed = parseLegalitySnapshotCsv(serializeLegalitySnapshotCsv(rows))
    expect(parsed).toEqual(rows)

    const lotus = parsed.find((row) => row.name === 'Black Lotus')!
    expect(decodeLegality(lotus.legalities, 'vintage')).toBe('restricted')
    expect(decodeLegality(lotus.legalities, 'legacy')).toBe('banned')
    // Everything not written to the file must come back as not_legal.
    expect(decodeLegality(lotus.legalities, 'modern')).toBe('not_legal')
  })

  it('writes format names, so a diff reads as prose', () => {
    const rows = buildSnapshot(
      new Set(['o-1']),
      new Map([['o-1', oracle('o-1', 'Sol Ring', { commander: 'legal', modern: 'banned' })]])
    )
    const csv = serializeLegalitySnapshotCsv(rows)
    expect(csv).toContain('commander')
    expect(csv).toContain('modern')
  })

  it('changes exactly one line when one card gets banned', () => {
    const index = new Map([
      ['o-1', oracle('o-1', 'A', { modern: 'legal' })],
      ['o-2', oracle('o-2', 'B', { modern: 'legal' })],
      ['o-3', oracle('o-3', 'C', { modern: 'legal' })]
    ])
    const ids = new Set(['o-1', 'o-2', 'o-3'])
    const first = serializeLegalitySnapshotCsv(buildSnapshot(ids, index))

    index.set('o-2', oracle('o-2', 'B', { modern: 'banned' }))
    const second = serializeLegalitySnapshotCsv(buildSnapshot(ids, index))

    const changed = first
      .split('\r\n')
      .filter((line, i) => line !== second.split('\r\n')[i])
    expect(changed).toHaveLength(1)
    expect(changed[0]).toContain('o-2')
  })

  it('skips oracle ids missing from the index', () => {
    expect(buildSnapshot(new Set(['nope']), new Map())).toEqual([])
  })

  it('sorts by oracle id, so a rename stays a one-line diff', () => {
    const rows = sortSnapshot([
      snapshot('o-2', 'Zzz', {}),
      snapshot('o-1', 'Aaa', {})
    ])
    expect(rows.map((r) => r.oracleId)).toEqual(['o-1', 'o-2'])
  })

  it('reads an empty file as no snapshot at all', () => {
    expect(parseLegalitySnapshotCsv('')).toEqual([])
  })
})

// ─── Tags ─────────────────────────────────────────────────────────────────────

describe('legalityTags', () => {
  it('labels every deck format for one card', () => {
    const tags = legalityTags(encodeLegalities({ commander: 'legal', modern: 'banned' }))
    expect(tags.find((tag) => tag.format === 'commander')).toMatchObject({
      label: 'Commander',
      value: 'legal'
    })
    expect(tags.find((tag) => tag.format === 'modern')?.value).toBe('banned')
    expect(tags.find((tag) => tag.format === 'pioneer')?.value).toBe('not_legal')
  })
})
