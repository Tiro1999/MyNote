import { describe, it, expect } from 'vitest'
import {
  serializeCollectionCsv,
  parseCollectionCsv,
  serializeWishlistCsv,
  parseWishlistCsv,
  totalCards,
  distinctPrintings,
  COLLECTION_HEADER
} from './csv'
import type { CollectionEntry, WishlistEntry } from './model'

const makeEntry = (over: Partial<CollectionEntry> = {}): CollectionEntry => ({
  scryfallId: 'id-1',
  finish: 'normal',
  condition: 'near_mint',
  language: 'en',
  misprint: false,
  altered: false,
  quantity: 1,
  name: 'Sol Ring',
  setCode: 'cmr',
  collectorNumber: '472',
  storageLocation: '',
  note: '',
  purchasePrice: '',
  purchaseCurrency: '',
  addedAt: '2026-08-14',
  ...over
})

describe('collection csv', () => {
  it('round-trips every field', () => {
    const entries = [
      makeEntry({
        scryfallId: 'abc-123',
        finish: 'etched',
        condition: 'light_played',
        language: 'zh_TW',
        misprint: true,
        altered: true,
        quantity: 7,
        name: 'Millicent, Restless Revenant',
        storageLocation: 'Tresor, Fach 3',
        note: 'Sagt "nein"',
        purchasePrice: '40.0',
        purchaseCurrency: 'USD'
      })
    ]
    expect(parseCollectionCsv(serializeCollectionCsv(entries))).toEqual(entries)
  })

  // The whole point of the fixed column and row order: the nightly git diff
  // must show real changes only.
  it('serialises identically regardless of input order', () => {
    const a = [makeEntry({ scryfallId: 'z' }), makeEntry({ scryfallId: 'a' })]
    const b = [makeEntry({ scryfallId: 'a' }), makeEntry({ scryfallId: 'z' })]
    expect(serializeCollectionCsv(a)).toBe(serializeCollectionCsv(b))
  })

  it('changes exactly one line when one quantity changes', () => {
    const before = serializeCollectionCsv([
      makeEntry({ scryfallId: 'a' }),
      makeEntry({ scryfallId: 'b' }),
      makeEntry({ scryfallId: 'c' })
    ]).split('\r\n')
    const after = serializeCollectionCsv([
      makeEntry({ scryfallId: 'a' }),
      makeEntry({ scryfallId: 'b', quantity: 4 }),
      makeEntry({ scryfallId: 'c' })
    ]).split('\r\n')

    const changed = before.filter((line, i) => line !== after[i])
    expect(changed).toHaveLength(1)
  })

  it('ends with a newline so git does not flag the last line', () => {
    expect(serializeCollectionCsv([makeEntry()]).endsWith('\r\n')).toBe(true)
  })

  it('reads columns by name, so a reordered file still parses', () => {
    const csv = ['quantity,scryfallId,name', '3,xyz,Black Lotus'].join('\r\n')
    const [entry] = parseCollectionCsv(csv)
    expect(entry.scryfallId).toBe('xyz')
    expect(entry.quantity).toBe(3)
    expect(entry.name).toBe('Black Lotus')
    // Absent columns fall back to sane defaults rather than undefined.
    expect(entry.finish).toBe('normal')
    expect(entry.condition).toBe('near_mint')
  })

  it('returns an empty list for an empty or header-only file', () => {
    expect(parseCollectionCsv('')).toEqual([])
    expect(parseCollectionCsv(COLLECTION_HEADER.join(','))).toEqual([])
  })
})

describe('wishlist csv', () => {
  it('round-trips and normalises an unknown priority', () => {
    const entries: WishlistEntry[] = [
      {
        scryfallId: 'p1',
        oracleId: 'o1',
        name: 'Mana Crypt',
        quantity: 1,
        reason: 'Fehlt in Deck: Edgar Markov',
        deckId: 'deck-1',
        priority: 'high',
        note: '',
        addedAt: '2026-08-14'
      }
    ]
    expect(parseWishlistCsv(serializeWishlistCsv(entries))).toEqual(entries)

    const odd = parseWishlistCsv(['name,priority,quantity', 'X,urgent,1'].join('\r\n'))
    expect(odd[0].priority).toBe('normal')
  })
})

describe('aggregates', () => {
  it('counts physical cards separately from distinct printings', () => {
    const entries = [
      makeEntry({ scryfallId: 'a', quantity: 4 }),
      makeEntry({ scryfallId: 'b', quantity: 2 }),
      // Same printing, different finish — a distinct stack.
      makeEntry({ scryfallId: 'b', finish: 'foil', quantity: 1 })
    ]
    expect(totalCards(entries)).toBe(7)
    expect(distinctPrintings(entries)).toBe(3)
  })
})
