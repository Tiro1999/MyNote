import { describe, it, expect } from 'vitest'
import {
  mapHeaders,
  parseManaboxCsv,
  planImport,
  applyImport,
  DEFAULT_APPLY_OPTIONS
} from './manabox'
import { entryKey, type CollectionEntry } from './model'

const AT = '2026-08-14'

/**
 * Real ManaBox export rows (whole-collection form, 17 columns). Note the
 * deliberate final two rows: the same printing/finish/condition/language on two
 * separate lines — ManaBox does not deduplicate, and this is where naive
 * importers lose cards.
 */
const FULL_EXPORT = [
  'Binder Name,Binder Type,Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency',
  'my list,list,"Millicent, Restless Revenant",VOC,Crimson Vow Commander,1,normal,mythic,1,64142,2b86b538-0766-440d-a2cd-f5d5bfcfb010,0.47,false,false,near_mint,de,USD',
  'Test-2023-09-12,binder,Jin-Gitaxias // The Great Synthesis,MOM,March of the Machine,65,normal,mythic,1,80444,41c83142-b948-4ee5-a486-41306d2bb411,4.06,false,false,near_mint,en,USD',
  'Import,binder,Demonic Tutor,CMM,Commander Masters,509,etched,mythic,1,84587,89153e75-2333-42e8-bc28-1b3d1e4726dd,40.0,false,false,near_mint,en,USD',
  'Import,binder,Merfolk Windrobber,ZNR,Zendikar Rising,70,normal,common,1,54448,112077b8-1514-4320-a70f-b23f3c7ce18a,0.05,false,false,near_mint,de,USD',
  // No trailing newline — ManaBox files end mid-record.
  'Import,binder,Merfolk Windrobber,ZNR,Zendikar Rising,70,normal,common,4,54448,112077b8-1514-4320-a70f-b23f3c7ce18a,0.05,false,false,near_mint,de,USD'
].join('\n')

/** The slimmer single-binder export: same data, no Binder columns. */
const SLIM_EXPORT = [
  'Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency',
  'Sol Ring,CMR,Commander Legends,472,normal,uncommon,2,12345,aaaa1111-0000-0000-0000-000000000001,1.5,false,false,near_mint,en,EUR'
].join('\n')

describe('mapHeaders', () => {
  it('resolves both export shapes by name', () => {
    const full = mapHeaders(FULL_EXPORT.split('\n')[0].split(','))
    expect(full.binderName).toBe(0)
    expect(full.binderType).toBe(1)
    expect(full.name).toBe(2)
    expect(full.scryfallId).toBe(10)

    const slim = mapHeaders(SLIM_EXPORT.split('\n')[0].split(','))
    expect(slim.binderName).toBeUndefined()
    expect(slim.name).toBe(0)
    // Same field, eight columns earlier — proof that position is never assumed.
    expect(slim.scryfallId).toBe(8)
  })

  it('accepts the aliases ManaBox\'s own importer documents', () => {
    const map = mapHeaders(['Card name', 'Card number', 'Purchase currency', 'Qty'])
    expect(map.name).toBe(0)
    expect(map.collectorNumber).toBe(1)
    expect(map.purchaseCurrency).toBe(2)
    expect(map.quantity).toBe(3)
  })

  it('is case- and punctuation-insensitive and ignores unknown columns', () => {
    const map = mapHeaders(['  SET CODE ', 'Scryfall_ID', 'Some Future Column'])
    expect(map.setCode).toBe(0)
    expect(map.scryfallId).toBe(1)
    expect(Object.values(map)).not.toContain(2)
  })
})

describe('parseManaboxCsv', () => {
  it('sums duplicate rows of the same stack instead of overwriting', () => {
    const result = parseManaboxCsv(FULL_EXPORT, AT)
    const windrobber = result.owned.find((e) => e.name === 'Merfolk Windrobber')!
    // 1 + 4 — the bug this guards against would yield 4 (last row wins) or 1.
    expect(windrobber.quantity).toBe(5)
    expect(result.duplicateRowsMerged).toBe(1)
  })

  it('routes `list` binders to the wishlist, not the collection', () => {
    const result = parseManaboxCsv(FULL_EXPORT, AT)
    expect(result.owned.map((e) => e.name)).not.toContain('Millicent, Restless Revenant')
    expect(result.wishlist).toHaveLength(1)
    expect(result.wishlist[0].name).toBe('Millicent, Restless Revenant')
    expect(result.wishlist[0].reason).toContain('my list')
  })

  it('preserves etched as a distinct finish', () => {
    const result = parseManaboxCsv(FULL_EXPORT, AT)
    const tutor = result.owned.find((e) => e.name === 'Demonic Tutor')!
    expect(tutor.finish).toBe('etched')
  })

  it('parses quoted names containing commas', () => {
    const result = parseManaboxCsv(FULL_EXPORT, AT)
    expect(result.wishlist[0].name).toBe('Millicent, Restless Revenant')
  })

  it('lowercases set codes for Scryfall while keeping collector numbers verbatim', () => {
    const result = parseManaboxCsv(SLIM_EXPORT, AT)
    expect(result.owned[0].setCode).toBe('cmr')
    expect(result.owned[0].collectorNumber).toBe('472')
  })

  it('keeps non-numeric collector numbers intact', () => {
    const csv = [
      'Name,Set code,Collector number,Foil,Quantity,Scryfall ID,Condition,Language',
      'Aragorn,LTR,741z,normal,1,bbbb-1,near_mint,en',
      'Box Topper,LTR,U8,foil,1,bbbb-2,near_mint,en',
      'The List Card,PLST,CN2-22,normal,1,bbbb-3,near_mint,en'
    ].join('\n')
    const result = parseManaboxCsv(csv, AT)
    expect(result.owned.map((e) => e.collectorNumber).sort()).toEqual(['741z', 'CN2-22', 'U8'])
  })

  it('reads the last row of a file with no trailing newline', () => {
    const result = parseManaboxCsv(FULL_EXPORT, AT)
    expect(result.owned.some((e) => e.name === 'Merfolk Windrobber')).toBe(true)
  })

  it('tolerates a BOM left by Excel', () => {
    const result = parseManaboxCsv(`﻿${SLIM_EXPORT}`, AT)
    expect(result.owned).toHaveLength(1)
    expect(result.owned[0].name).toBe('Sol Ring')
  })

  it('normalises the condition spelling other apps use', () => {
    const csv = [
      'Name,Quantity,Scryfall ID,Condition',
      'A,1,id-a,Lightly Played',
      'B,1,id-b,light_played',
      'C,1,id-c,heavily_played'
    ].join('\n')
    const result = parseManaboxCsv(csv, AT)
    const byName = new Map(result.owned.map((e) => [e.name, e.condition]))
    expect(byName.get('A')).toBe('light_played')
    expect(byName.get('B')).toBe('light_played')
    expect(byName.get('C')).toBe('poor')
  })

  it('treats stacks differing only in finish or condition as distinct', () => {
    const csv = [
      'Name,Quantity,Scryfall ID,Foil,Condition,Language',
      'Sol Ring,1,same-id,normal,near_mint,en',
      'Sol Ring,1,same-id,foil,near_mint,en',
      'Sol Ring,1,same-id,normal,played,en',
      'Sol Ring,1,same-id,normal,near_mint,de'
    ].join('\n')
    const result = parseManaboxCsv(csv, AT)
    expect(result.owned).toHaveLength(4)
    expect(result.duplicateRowsMerged).toBe(0)
  })

  it('skips rows with no identity and reports why', () => {
    const csv = ['Name,Quantity,Scryfall ID', ',1,', 'Real Card,1,id-1'].join('\n')
    const result = parseManaboxCsv(csv, AT)
    expect(result.owned).toHaveLength(1)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].line).toBe(2)
  })

  it('warns when Binder Type is absent instead of silently treating lists as owned', () => {
    const result = parseManaboxCsv(SLIM_EXPORT, AT)
    expect(result.warnings.join(' ')).toContain('Binder Type')
  })

  it('handles a semicolon-delimited file saved by a German Excel', () => {
    const csv = [
      'Name;Set code;Quantity;Scryfall ID;Condition',
      'Sol Ring;CMR;2;id-1;near_mint'
    ].join('\n')
    const result = parseManaboxCsv(csv, AT)
    expect(result.owned).toHaveLength(1)
    expect(result.owned[0].quantity).toBe(2)
  })
})

// ─── Diff ─────────────────────────────────────────────────────────────────────

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
  addedAt: AT,
  ...over
})

describe('planImport', () => {
  it('classifies additions, increases, decreases and absences', () => {
    const current = [
      makeEntry({ scryfallId: 'keep', quantity: 2 }),
      makeEntry({ scryfallId: 'grow', quantity: 1 }),
      makeEntry({ scryfallId: 'shrink', quantity: 4 }),
      makeEntry({ scryfallId: 'gone', quantity: 3 })
    ]
    const incoming = [
      makeEntry({ scryfallId: 'keep', quantity: 2 }),
      makeEntry({ scryfallId: 'grow', quantity: 3 }),
      makeEntry({ scryfallId: 'shrink', quantity: 1 }),
      makeEntry({ scryfallId: 'new', quantity: 5 })
    ]

    const plan = planImport(current, incoming)
    expect(plan.unchanged).toBe(1)
    expect(plan.added.map((e) => e.scryfallId)).toEqual(['new'])
    expect(plan.increased).toEqual([
      { entry: expect.objectContaining({ scryfallId: 'grow' }), from: 1, to: 3 }
    ])
    expect(plan.decreased[0]).toMatchObject({ from: 4, to: 1 })
    expect(plan.missing.map((e) => e.scryfallId)).toEqual(['gone'])
    // +2 (grow) -3 (shrink) +5 (new) = +4
    expect(plan.netCardDelta).toBe(4)
  })

  it('reports no change when the same export is imported twice', () => {
    const parsed = parseManaboxCsv(FULL_EXPORT, AT).owned
    const plan = planImport(parsed, parseManaboxCsv(FULL_EXPORT, AT).owned)
    expect(plan.added).toHaveLength(0)
    expect(plan.increased).toHaveLength(0)
    expect(plan.decreased).toHaveLength(0)
    expect(plan.missing).toHaveLength(0)
    expect(plan.netCardDelta).toBe(0)
  })

  // ManaBox rewrites these columns between exports even when nothing changed;
  // if they leaked into the identity key, every import would look like a purge.
  it('ignores mutated derived columns', () => {
    const current = [makeEntry({ name: 'Sol Ring', purchasePrice: '1.5' })]
    const incoming = [
      makeEntry({ name: 'Sol Ring // Something', purchasePrice: '2.75', collectorNumber: '472★' })
    ]
    const plan = planImport(current, incoming)
    expect(plan.unchanged).toBe(1)
    expect(plan.added).toHaveLength(0)
    expect(plan.missing).toHaveLength(0)
  })
})

describe('applyImport', () => {
  it('adds new stacks and updates counts', () => {
    const current = [makeEntry({ scryfallId: 'a', quantity: 1 })]
    const incoming = [
      makeEntry({ scryfallId: 'a', quantity: 4 }),
      makeEntry({ scryfallId: 'b', quantity: 2 })
    ]
    const merged = applyImport(current, incoming)
    const byId = new Map(merged.map((e) => [e.scryfallId, e]))
    expect(byId.get('a')!.quantity).toBe(4)
    expect(byId.get('b')!.quantity).toBe(2)
  })

  it('never clobbers user notes, storage location or original purchase price', () => {
    const current = [
      makeEntry({
        note: 'Signiert von Rebecca Guay',
        storageLocation: 'Tresor, Fach 3',
        purchasePrice: '95.00',
        addedAt: '2024-01-01'
      })
    ]
    const incoming = [
      makeEntry({ storageLocation: 'Import', purchasePrice: '1.50', addedAt: AT, quantity: 2 })
    ]
    const [merged] = applyImport(current, incoming)
    expect(merged.note).toBe('Signiert von Rebecca Guay')
    expect(merged.storageLocation).toBe('Tresor, Fach 3')
    expect(merged.purchasePrice).toBe('95.00')
    expect(merged.addedAt).toBe('2024-01-01')
    // …while still taking the new count.
    expect(merged.quantity).toBe(2)
  })

  it('fills an empty storage location from the export', () => {
    const current = [makeEntry({ storageLocation: '' })]
    const incoming = [makeEntry({ storageLocation: 'Karton A' })]
    expect(applyImport(current, incoming)[0].storageLocation).toBe('Karton A')
  })

  // Importing one binder must not read as "I sold everything else".
  it('keeps absent stacks by default and removes them only on request', () => {
    const current = [makeEntry({ scryfallId: 'a' }), makeEntry({ scryfallId: 'b' })]
    const incoming = [makeEntry({ scryfallId: 'a' })]

    expect(applyImport(current, incoming)).toHaveLength(2)
    expect(
      applyImport(current, incoming, { ...DEFAULT_APPLY_OPTIONS, removeMissing: true })
    ).toHaveLength(1)
  })

  it('can ignore quantity decreases for a partial export', () => {
    const current = [makeEntry({ quantity: 10 })]
    const incoming = [makeEntry({ quantity: 2 })]
    expect(
      applyImport(current, incoming, { ...DEFAULT_APPLY_OPTIONS, applyDecreases: false })[0]
        .quantity
    ).toBe(10)
    expect(applyImport(current, incoming)[0].quantity).toBe(2)
  })

  it('is idempotent — importing the same file twice changes nothing', () => {
    const parsed = parseManaboxCsv(FULL_EXPORT, AT).owned
    const once = applyImport([], parsed)
    const twice = applyImport(once, parseManaboxCsv(FULL_EXPORT, AT).owned)
    expect(twice.map(entryKey).sort()).toEqual(once.map(entryKey).sort())
    expect(twice.reduce((sum, e) => sum + e.quantity, 0)).toBe(
      once.reduce((sum, e) => sum + e.quantity, 0)
    )
  })
})
