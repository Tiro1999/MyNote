import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DirEntry } from '@shared/ipc'
import { flushWrites } from '@renderer/storage'
import { LEDGER_HEADER, serializeLedgerCsv } from './ledgerCsv'
import type { Account, CategoryNode, Entry } from './model'
import { ledgerCsvPath, ledgerMetaPath } from './paths'
import { ledgerOf, mergeAccounts, mergeCategoryPaths, nextPos, useFinanceStore, type LedgerState } from './store'
import { MAX_CATEGORY_DEPTH } from './validate'

const ACCOUNTS = 'finance/accounts.json'
const CATEGORIES = 'finance/categories.json'
const EBUSY = 'EBUSY: resource busy or locked'

type EntryDraft = Omit<Entry, 'id' | 'pos'>

// Disk and call log of the window.api fake; a path in `failing` rejects its writes and leaves the old file
let disk: Map<string, string>
let log: string[]
let failing: Set<string>
let gates: Map<string, PromiseWithResolvers<void>>
let readHolds: Map<string, PromiseWithResolvers<void>>
const usedHolds = new WeakSet<PromiseWithResolvers<void>>()
let latency: number
const files = {
  readText: vi.fn<(path: string) => Promise<string | null>>(),
  writeText: vi.fn<(path: string, text: string) => Promise<void>>(),
  remove: vi.fn<(path: string) => Promise<void>>(),
  list: vi.fn<(dir: string) => Promise<DirEntry[]>>()
}

beforeEach(() => {
  disk = new Map()
  log = []
  failing = new Set()
  gates = new Map()
  readHolds = new Map()
  latency = 0
  files.readText.mockReset().mockImplementation(async (path) => {
    log.push(`read ${path}`)
    if (latency > 0) await sleep(latency)
    const text = disk.get(path) ?? null
    const hold = readHolds.get(path)
    if (hold && !usedHolds.has(hold)) {
      usedHolds.add(hold)
      await hold.promise
    }
    return text
  })
  files.writeText.mockReset().mockImplementation(async (path, text) => {
    log.push(`write ${path}`)
    await gates.get(path)?.promise
    if (latency > 0) await sleep(latency)
    if (failing.has(path)) throw new Error(EBUSY)
    disk.set(path, text)
  })
  files.remove.mockReset().mockImplementation(async (path) => {
    log.push(`remove ${path}`)
    disk.delete(path)
  })
  files.list.mockReset().mockResolvedValue([])
  vi.stubGlobal('window', { api: { files } })
  useFinanceStore.setState(useFinanceStore.getInitialState(), true)
})

afterEach(async () => {
  for (const gate of [...gates.values(), ...readHolds.values()]) gate.resolve()
  await flushWrites()
  // Deleting through the action also clears the meta text the store remembers for the id
  for (const id of Object.keys(state().ledgers)) await state().deleteLedger(id).catch(() => undefined)
  vi.unstubAllGlobals()
})

const state = useFinanceStore.getState

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// A timer fires after all pending microtasks, so every step that could run has run
const settle = (): Promise<void> => sleep(0)

// The next read of this path returns what the file holds now, but only after release
function holdNextRead(path: string): void {
  readHolds.set(path, Promise.withResolvers<void>())
}

function releaseRead(path: string): void {
  readHolds.get(path)?.resolve()
}

function hold(path: string): void {
  gates.set(path, Promise.withResolvers<void>())
}

function release(path: string): void {
  gates.get(path)?.resolve()
}

const writesTo = (path: string): string[] =>
  files.writeText.mock.calls.filter(([written]) => written === path).map(([, text]) => text)

const draft = (over: Partial<EntryDraft> = {}): EntryDraft => ({
  date: '2026-01-15',
  type: 'expense',
  amount: '12.50',
  accountId: 'a1',
  categoryPath: 'Food',
  topic: 'Lunch',
  tags: ['work'],
  referenceLink: '',
  ...over
})

const entry = (id: string, pos: number, over: Partial<EntryDraft> = {}): Entry => ({
  ...draft(over),
  id,
  pos
})

const META = { name: 'Home', currencySymbol: '€' }

function seedLedger(id: string, entries: Entry[] = [], meta: object = META): string {
  const csv = serializeLedgerCsv(entries)
  disk.set(ledgerCsvPath(id), csv)
  disk.set(ledgerMetaPath(id), JSON.stringify(meta, null, 2))
  return csv
}

async function seedAndLoad(id: string, entries: Entry[] = [entry('e1', 1)], meta: object = META): Promise<string> {
  const csv = seedLedger(id, entries, meta)
  await state().loadLedger(id)
  return csv
}

const csvOnDisk = (id: string): string => disk.get(ledgerCsvPath(id)) ?? ''
const ledger = (id: string): LedgerState | undefined => ledgerOf(state().ledgers, id)

const account = (id: string, name: string): Account => ({ id, name, openingBalance: '0' })

describe('nextPos', () => {
  it('is one more than the highest pos', () => {
    expect(nextPos([{ pos: 3 }, { pos: 7 }])).toBe(8)
  })

  it('is 1 for an empty list', () => {
    expect(nextPos([])).toBe(1)
  })

  it('ignores a pos that is not a finite number', () => {
    expect(nextPos([{ pos: NaN }, { pos: 2 }, { pos: Infinity }])).toBe(3)
    expect(nextPos([{ pos: NaN }])).toBe(1)
  })
})

describe('mergeAccounts', () => {
  const ids = (): (() => string) => {
    let n = 0
    return () => `n${++n}`
  }

  it('keeps existing ids and adds only new names', () => {
    const existing = [account('a1', 'Cash')]
    const merged = mergeAccounts(existing, ['Cash', 'Bank', 'Bank', 'Card'], ids())
    expect(merged.accounts).toEqual([account('a1', 'Cash'), account('n1', 'Bank'), account('n2', 'Card')])
    expect([...merged.ids]).toEqual([
      ['Cash', 'a1'],
      ['Bank', 'n1'],
      ['Card', 'n2']
    ])
    expect(existing).toEqual([account('a1', 'Cash')])
  })

  it('returns the same list when every name is known', () => {
    const existing = [account('a1', 'Cash')]
    const merged = mergeAccounts(existing, ['Cash'], ids())
    expect(merged.accounts).toBe(existing)
    expect(merged.ids.get('Cash')).toBe('a1')
  })

  it('skips names that are empty after trimming and trims the others', () => {
    const merged = mergeAccounts([], ['', '   ', ' Bank '], ids())
    expect(merged.accounts).toEqual([account('n1', 'Bank')])
    expect([...merged.ids.keys()]).toEqual(['Bank'])
  })

  it('does not list an existing account without a name', () => {
    const merged = mergeAccounts([account('a1', '')], [''], ids())
    expect(merged.ids.size).toBe(0)
  })

  it('handles names that are special on a plain object', () => {
    const merged = mergeAccounts([], ['constructor', '__proto__', 'toString'], ids())
    expect(merged.accounts.map((a) => a.name)).toEqual(['constructor', '__proto__', 'toString'])
    expect(merged.ids.get('constructor')).toBe('n1')
    expect(merged.ids.get('__proto__')).toBe('n2')
    expect(merged.ids.get('toString')).toBe('n3')
  })

  it('keeps the first account of a name that two accounts share', () => {
    const merged = mergeAccounts([account('a1', 'Cash'), account('a2', 'Cash')], ['Cash'], ids())
    expect(merged.ids.get('Cash')).toBe('a1')
  })
})

describe('mergeCategoryPaths', () => {
  it('builds the tree of a path', () => {
    expect(mergeCategoryPaths([], ['A/B'])).toEqual([
      { name: 'A', children: [{ name: 'B', children: [] }] }
    ])
  })

  it('adds to an existing tree without a repeat and without changing the input', () => {
    const tree: CategoryNode[] = [{ name: 'A', children: [{ name: 'B', children: [] }] }]
    const before = structuredClone(tree)
    expect(mergeCategoryPaths(tree, ['A/B', 'A/C', 'D', 'D'])).toEqual([
      { name: 'A', children: [{ name: 'B', children: [] }, { name: 'C', children: [] }] },
      { name: 'D', children: [] }
    ])
    expect(tree).toEqual(before)
  })

  it('returns the same tree when every path is known', () => {
    const tree: CategoryNode[] = [{ name: 'A', children: [{ name: 'B', children: [] }] }]
    expect(mergeCategoryPaths(tree, ['A', 'A/B'])).toBe(tree)
    expect(mergeCategoryPaths(tree, [])).toBe(tree)
  })

  it('ignores empty segments', () => {
    expect(mergeCategoryPaths([], ['A//B', '/C/', ' ', '', ' D / E '])).toEqual([
      { name: 'A', children: [{ name: 'B', children: [] }] },
      { name: 'C', children: [] },
      { name: 'D', children: [{ name: 'E', children: [] }] }
    ])
  })

  it('handles names that are special on a plain object', () => {
    expect(mergeCategoryPaths([], ['__proto__/constructor'])).toEqual([
      { name: '__proto__', children: [{ name: 'constructor', children: [] }] }
    ])
  })

  it('stops at the depth that a stored tree may have', () => {
    const path = Array.from({ length: MAX_CATEGORY_DEPTH + 8 }, (_, i) => `n${i}`).join('/')
    let depth = 0
    for (let level = mergeCategoryPaths([], [path]); level.length > 0; level = level[0].children) depth++
    expect(depth).toBe(MAX_CATEGORY_DEPTH)
  })
})

describe('loadReferenceData', () => {
  it('reads accounts and categories', async () => {
    disk.set(ACCOUNTS, JSON.stringify([account('a1', 'Cash')]))
    disk.set(CATEGORIES, JSON.stringify([{ name: 'Food', children: [] }]))
    await state().loadReferenceData()
    expect(state().accounts).toEqual([account('a1', 'Cash')])
    expect(state().categories).toEqual([{ name: 'Food', children: [] }])
    expect(state().referenceError).toBeNull()
  })

  it('starts empty when the files are missing', async () => {
    await state().loadReferenceData()
    expect(state().accounts).toEqual([])
    expect(state().categories).toEqual([])
    expect(state().referenceError).toBeNull()
  })

  it.each([
    ['bad JSON', '{not json'],
    ['an object instead of a list', '{"id":"a1"}'],
    ['an account with a number as name', '[{"id":"a1","name":5,"openingBalance":"0"}]']
  ])('shows an error for accounts.json with %s, keeps what was loaded and writes nothing', async (_label, text) => {
    disk.set(ACCOUNTS, JSON.stringify([account('a1', 'Cash')]))
    await state().loadReferenceData()
    disk.set(ACCOUNTS, text)
    await expect(state().loadReferenceData()).resolves.toBeUndefined()
    expect(state().referenceError).toContain(ACCOUNTS)
    expect(state().accounts).toEqual([account('a1', 'Cash')])
    expect(files.writeText).not.toHaveBeenCalled()
    expect(disk.get(ACCOUNTS)).toBe(text)
  })

  it('shows an error for a categories.json that is not a tree', async () => {
    disk.set(CATEGORIES, '[{"name":"A"}]')
    await state().loadReferenceData()
    expect(state().referenceError).toContain(CATEGORIES)
  })

  it('clears the error once the file is readable', async () => {
    disk.set(ACCOUNTS, '{not json')
    await state().loadReferenceData()
    expect(state().referenceError).not.toBeNull()
    disk.set(ACCOUNTS, JSON.stringify([account('a1', 'Cash')]))
    await state().loadReferenceData()
    expect(state().referenceError).toBeNull()
    expect(state().accounts).toEqual([account('a1', 'Cash')])
  })

  it('shows an error when a file cannot be read', async () => {
    files.readText.mockRejectedValueOnce(new Error('EACCES: permission denied'))
    await expect(state().loadReferenceData()).resolves.toBeUndefined()
    expect(state().referenceError).toContain('EACCES')
  })
})

describe('ensureAccounts', () => {
  it('rejects for a corrupt accounts.json, writes nothing and keeps the file', async () => {
    disk.set(ACCOUNTS, '{not json')
    await expect(state().ensureAccounts(['A'])).rejects.toThrow(ACCOUNTS)
    expect(files.writeText).not.toHaveBeenCalled()
    expect(disk.get(ACCOUNTS)).toBe('{not json')
  })

  it('rejects for a corrupt accounts.json after the data was loaded, too', async () => {
    disk.set(ACCOUNTS, '[]]')
    await state().loadReferenceData()
    await expect(state().ensureAccounts(['A'])).rejects.toThrow(ACCOUNTS)
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('does not replace accounts that were never loaded', async () => {
    disk.set(ACCOUNTS, JSON.stringify([account('a1', 'Cash')]))
    const ids = await state().ensureAccounts(['Cash', 'Bank'])
    expect(ids.get('Cash')).toBe('a1')
    const stored = JSON.parse(disk.get(ACCOUNTS) ?? '[]') as Account[]
    expect(stored.map((a) => a.name)).toEqual(['Cash', 'Bank'])
    expect(stored[0].id).toBe('a1')
  })

  it('returns a map from name to id and writes the new accounts once', async () => {
    const ids = await state().ensureAccounts(['Bank', 'constructor', '__proto__', '  ', 'Bank'])
    expect(ids).toBeInstanceOf(Map)
    expect([...ids.keys()]).toEqual(['Bank', 'constructor', '__proto__'])
    expect(writesTo(ACCOUNTS)).toHaveLength(1)
    const stored = JSON.parse(disk.get(ACCOUNTS) ?? '[]') as Account[]
    expect(stored).toEqual(state().accounts)
    expect(stored.map((a) => [a.name, a.id])).toEqual([...ids])
    expect(stored.every((a) => a.openingBalance === '0')).toBe(true)
  })

  it('writes nothing when every name is known', async () => {
    disk.set(ACCOUNTS, JSON.stringify([account('a1', 'Cash')]))
    const ids = await state().ensureAccounts(['Cash'])
    expect(ids.get('Cash')).toBe('a1')
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('rejects when the write fails', async () => {
    failing.add(ACCOUNTS)
    await expect(state().ensureAccounts(['A'])).rejects.toThrow('EBUSY')
    expect(disk.has(ACCOUNTS)).toBe(false)
  })
})

describe('ensureCategories', () => {
  it('rejects for a corrupt categories.json, writes nothing and keeps the file', async () => {
    disk.set(CATEGORIES, '{"name":"A"}')
    await expect(state().ensureCategories(['A/B'])).rejects.toThrow(CATEGORIES)
    expect(files.writeText).not.toHaveBeenCalled()
    expect(disk.get(CATEGORIES)).toBe('{"name":"A"}')
  })

  it('rejects for a corrupt accounts.json, because that blocks all reference data writes', async () => {
    disk.set(ACCOUNTS, 'oops')
    await expect(state().ensureCategories(['A'])).rejects.toThrow(ACCOUNTS)
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('merges the paths into the stored tree', async () => {
    disk.set(CATEGORIES, JSON.stringify([{ name: 'A', children: [] }]))
    await state().ensureCategories(['A/B', 'C'])
    const expected = [
      { name: 'A', children: [{ name: 'B', children: [] }] },
      { name: 'C', children: [] }
    ]
    expect(state().categories).toEqual(expected)
    expect(JSON.parse(disk.get(CATEGORIES) ?? '')).toEqual(expected)
  })

  it('writes nothing when the tree has every path', async () => {
    disk.set(CATEGORIES, JSON.stringify([{ name: 'A', children: [] }]))
    await state().ensureCategories(['A'])
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('rejects when the write fails', async () => {
    failing.add(CATEGORIES)
    await expect(state().ensureCategories(['A'])).rejects.toThrow('EBUSY')
  })
})

describe('saveAccounts and saveCategories', () => {
  it('write the data and set the state', async () => {
    await state().saveAccounts([account('a1', 'Cash')])
    await state().saveCategories([{ name: 'A', children: [] }])
    expect(JSON.parse(disk.get(ACCOUNTS) ?? '')).toEqual([account('a1', 'Cash')])
    expect(JSON.parse(disk.get(CATEGORIES) ?? '')).toEqual([{ name: 'A', children: [] }])
    expect(state().accounts).toEqual([account('a1', 'Cash')])
    expect(state().categories).toEqual([{ name: 'A', children: [] }])
  })

  it('reject without a write while the reference data is corrupt', async () => {
    disk.set(CATEGORIES, 'garbage')
    await state().loadReferenceData()
    await expect(state().saveAccounts([account('a1', 'Cash')])).rejects.toThrow(CATEGORIES)
    await expect(state().saveCategories([])).rejects.toThrow(CATEGORIES)
    expect(files.writeText).not.toHaveBeenCalled()
    expect(disk.get(CATEGORIES)).toBe('garbage')
  })

  it('reject data that a load would reject, change nothing and write nothing', async () => {
    await state().saveAccounts([account('a1', 'Cash')])
    files.writeText.mockClear()
    await expect(state().saveAccounts([account('a1', 'Cash'), account('a1', 'Bank')])).rejects.toThrow('Duplicate')
    expect(files.writeText).not.toHaveBeenCalled()
    expect(state().accounts).toEqual([account('a1', 'Cash')])
    expect(JSON.parse(disk.get(ACCOUNTS) ?? '')).toEqual([account('a1', 'Cash')])
  })

  it('reject when the write fails', async () => {
    failing.add(ACCOUNTS)
    await expect(state().saveAccounts([account('a1', 'Cash')])).rejects.toThrow('EBUSY')
  })

  it('work again once the file is repaired', async () => {
    disk.set(ACCOUNTS, 'garbage')
    await expect(state().saveAccounts([])).rejects.toThrow(ACCOUNTS)
    disk.set(ACCOUNTS, '[]')
    await state().saveAccounts([account('a1', 'Cash')])
    expect(state().referenceError).toBeNull()
    expect(JSON.parse(disk.get(ACCOUNTS) ?? '')).toEqual([account('a1', 'Cash')])
  })
})

describe('reference data operations that overlap', () => {
  const names = (): string[] => (JSON.parse(disk.get(ACCOUNTS) ?? '[]') as Account[]).map((a) => a.name)

  it('keep both accounts of two ensureAccounts started together, with valid id maps', async () => {
    latency = 3
    const [first, second] = await Promise.all([state().ensureAccounts(['A']), state().ensureAccounts(['B'])])
    const stored = JSON.parse(disk.get(ACCOUNTS) ?? '[]') as Account[]
    expect(stored.map((a) => a.name)).toEqual(['A', 'B'])
    expect(first.get('A')).toBe(stored[0].id)
    expect(second.get('B')).toBe(stored[1].id)
    expect(state().accounts).toEqual(stored)
  })

  it('keep the saved account and the ensured one when a save is followed by an ensure', async () => {
    latency = 3
    const saved = state().saveAccounts([account('x1', 'X')])
    const ensured = state().ensureAccounts(['N'])
    await Promise.all([saved, ensured])
    expect(names()).toEqual(['X', 'N'])
    expect(JSON.parse(disk.get(ACCOUNTS) ?? '')[0].id).toBe('x1')
  })

  it('leave the state equal to the disk when a public load overlaps an ensure', async () => {
    holdNextRead(ACCOUNTS)
    const load = state().loadReferenceData()
    const ensure = state().ensureAccounts(['A'])
    await settle()
    releaseRead(ACCOUNTS)
    await Promise.all([load, ensure])
    expect(names()).toEqual(['A'])
    expect(state().accounts.map((a) => a.name)).toEqual(['A'])
  })

  it('go on after one of them failed', async () => {
    failing.add(ACCOUNTS)
    const failed = state().ensureAccounts(['A'])
    const next = state().ensureCategories(['C'])
    await expect(failed).rejects.toThrow('EBUSY')
    await expect(next).resolves.toBeUndefined()
    expect(JSON.parse(disk.get(CATEGORIES) ?? '')).toEqual([{ name: 'C', children: [] }])
  })
})

describe('loadLedger', () => {
  it('reads the meta and the entries', async () => {
    await seedAndLoad('l1', [entry('e1', 1), entry('e2', 2)], { ...META, columns: { amount: { align: 'right' } } })
    expect(ledger('l1')).toMatchObject({
      meta: { name: 'Home', currencySymbol: '€', columns: { amount: { align: 'right' } } },
      saveError: null,
      loadError: null
    })
    expect(ledger('l1')?.entries.map((e) => e.id)).toEqual(['e1', 'e2'])
  })

  it('opens a ledger without files as empty, named by its id', async () => {
    await state().loadLedger('l1')
    expect(ledger('l1')).toEqual({
      meta: { name: 'l1', currencySymbol: '€' },
      entries: [],
      saveError: null,
      loadError: null
    })
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('reads a ledger once', async () => {
    await seedAndLoad('l1')
    files.readText.mockClear()
    await state().loadLedger('l1')
    expect(files.readText).not.toHaveBeenCalled()
  })

  it('opens a v0.1.x meta whose decimals are out of range and does not rewrite it', async () => {
    const format = { thousands: true, currencySymbol: '', symbolPosition: 'after' }
    await seedAndLoad('l1', [], { ...META, columns: { amount: { number: { ...format, decimals: 99 } } } })
    expect(ledger('l1')?.loadError).toBeNull()
    expect(ledger('l1')?.meta.columns?.amount.number?.decimals).toBe(20)
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('opens a v0.1.x meta with stale column keys', async () => {
    await seedAndLoad('l1', [], {
      ...META,
      columns: { date: { type: 'date', date: { pattern: 'dd.MM.yyyy' } }, amount: { type: 'number', width: 90 } }
    })
    expect(ledger('l1')?.loadError).toBeNull()
    expect(ledger('l1')?.meta.columns).toEqual({ date: {}, amount: { width: 90 } })
  })

  it.each([
    ['bad JSON', '{not json'],
    ['a name that is a number', '{"name":1,"currencySymbol":"€"}'],
    ['decimals as text', JSON.stringify({ ...META, columns: { amount: { number: { decimals: '2', thousands: true, currencySymbol: '', symbolPosition: 'after' } } } })]
  ])('sets loadError for a meta.json with %s and keeps the files', async (_label, text) => {
    const csv = seedLedger('l1', [entry('e1', 1)])
    disk.set(ledgerMetaPath('l1'), text)
    await expect(state().loadLedger('l1')).resolves.toBeUndefined()
    expect(ledger('l1')?.loadError).toContain(ledgerMetaPath('l1'))
    expect(ledger('l1')?.entries).toEqual([])
    expect(files.writeText).not.toHaveBeenCalled()
    expect(disk.get(ledgerMetaPath('l1'))).toBe(text)
    expect(csvOnDisk('l1')).toBe(csv)
  })

  it('sets loadError when a file cannot be read', async () => {
    seedLedger('l1')
    files.readText.mockImplementation(async (path) => {
      if (path === ledgerCsvPath('l1')) throw new Error('EACCES: permission denied')
      return disk.get(path) ?? null
    })
    await state().loadLedger('l1')
    expect(ledger('l1')?.loadError).toContain('EACCES')
  })

  it('loads a v0.1.x CSV with amounts as typed and does not rewrite it', async () => {
    const csv = `${LEDGER_HEADER.join(',')}\r\ne1,1,2025-03-01,expense,"1.234,56",a1,Food,Lunch,,\r\ne2,2,2025-03-02,income,"12,5",a1,,,x;y,`
    disk.set(ledgerCsvPath('l1'), csv)
    await state().loadLedger('l1')
    expect(ledger('l1')?.loadError).toBeNull()
    expect(ledger('l1')?.entries.map((e) => e.amount)).toEqual(['1.234,56', '12,5'])
    expect(files.writeText).not.toHaveBeenCalled()
    expect(csvOnDisk('l1')).toBe(csv)
  })

  it('loads a stored CSV with a BOM, CRLF line ends and a trailing newline without a loadError', async () => {
    const csv = `\uFEFF${serializeLedgerCsv([entry('e1', 1), entry('e2', 2, { topic: 'a\r\nb "q", c' })])}\r\n`
    disk.set(ledgerCsvPath('l1'), csv)
    await state().loadLedger('l1')
    expect(ledger('l1')?.loadError).toBeNull()
    expect(ledger('l1')?.entries.map((e) => e.topic)).toEqual(['Lunch', 'a\r\nb "q", c'])
    expect(files.writeText).not.toHaveBeenCalled()
    expect(csvOnDisk('l1')).toBe(csv)
  })

  it.each([
    ['a header that is not the ledger header', 'name,value\r\nx,1'],
    ['a row with 9 cells', `${LEDGER_HEADER.join(',')}\r\ne1,1,2025-03-01,expense,5.00,a1,Food,Lunch,`]
  ])('sets loadError for a CSV with %s, refuses writes and keeps the file', async (_label, csv) => {
    disk.set(ledgerCsvPath('l1'), csv)
    await expect(state().loadLedger('l1')).resolves.toBeUndefined()
    expect(ledger('l1')?.loadError).toContain(ledgerCsvPath('l1'))
    expect(ledger('l1')?.entries).toEqual([])
    await expect(state().addEntry('l1', draft())).rejects.toThrow('could not be read')
    expect(files.writeText).not.toHaveBeenCalled()
    expect(csvOnDisk('l1')).toBe(csv)

    disk.set(ledgerCsvPath('l1'), serializeLedgerCsv([entry('e1', 1)]))
    await state().loadLedger('l1')
    expect(ledger('l1')).toMatchObject({ loadError: null })
    expect(ledger('l1')?.entries).toHaveLength(1)
  })

  it.each(['../x', 'a/b', '', '..', 'a\\b'])('never lets the id %j reach a file', async (id) => {
    await expect(state().loadLedger(id)).resolves.toBeUndefined()
    expect(ledger(id)?.loadError).toContain('Invalid ledger id')
    expect(files.readText).not.toHaveBeenCalled()
    expect(files.writeText).not.toHaveBeenCalled()
    await expect(state().addEntry(id, draft())).rejects.toThrow('Invalid ledger id')
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('tries again for a ledger whose load failed and clears the error', async () => {
    seedLedger('l1', [entry('e1', 1)])
    disk.set(ledgerMetaPath('l1'), '{not json')
    await state().loadLedger('l1')
    expect(ledger('l1')?.loadError).not.toBeNull()
    disk.set(ledgerMetaPath('l1'), JSON.stringify(META))
    await state().loadLedger('l1')
    expect(ledger('l1')).toMatchObject({ loadError: null })
    expect(ledger('l1')?.entries).toHaveLength(1)
  })

  it.each(['constructor', '__proto__', 'toString'])('loads and edits the ledger %s', async (id) => {
    expect(ledger(id)).toBeUndefined()
    await expect(state().addEntry(id, draft())).rejects.toThrow('not loaded')
    await seedAndLoad(id, [entry('e1', 1)])
    expect(ledger(id)?.entries).toHaveLength(1)
    await state().addEntry(id, draft())
    expect(ledger(id)?.entries).toHaveLength(2)
    expect(csvOnDisk(id)).toContain('e1')
    expect(files.writeText).toHaveBeenCalledWith(`finance/ledgers/${id}.csv`, expect.any(String))
  })
})

describe('entry actions', () => {
  it('addEntry appends one entry with a new id and the next pos, and writes the CSV only', async () => {
    await seedAndLoad('l1', [entry('e1', 3), entry('e2', 7)])
    await state().addEntry('l1', draft({ topic: 'New' }))
    const added = ledger('l1')?.entries[2]
    expect(added).toMatchObject({ pos: 8, topic: 'New' })
    expect(added?.id).toBeTruthy()
    expect(ledger('l1')?.entries.map((e) => e.id)).toEqual(['e1', 'e2', added?.id])
    expect(csvOnDisk('l1')).toBe(serializeLedgerCsv(ledger('l1')?.entries ?? []))
    expect(files.writeText.mock.calls.map(([path]) => path)).toEqual([ledgerCsvPath('l1')])
  })

  it('addEntry is importEntries with one entry', async () => {
    await seedAndLoad('l1', [])
    await state().addEntry('l1', draft())
    expect(ledger('l1')?.entries.map((e) => e.pos)).toEqual([1])
  })

  it('importEntries appends the entries in order with consecutive pos and new ids', async () => {
    await seedAndLoad('l1', [entry('e1', 2)])
    await state().importEntries('l1', [draft({ topic: 'a' }), draft({ topic: 'b' }), draft({ topic: 'c' })])
    const entries = ledger('l1')?.entries ?? []
    expect(entries.map((e) => [e.pos, e.topic])).toEqual([
      [2, 'Lunch'],
      [3, 'a'],
      [4, 'b'],
      [5, 'c']
    ])
    expect(new Set(entries.map((e) => e.id)).size).toBe(4)
    expect(writesTo(ledgerCsvPath('l1'))).toHaveLength(1)
  })

  it('updateEntry replaces the entry with that id', async () => {
    await seedAndLoad('l1', [entry('e1', 1), entry('e2', 2)])
    await state().updateEntry('l1', entry('e2', 2, { topic: 'Changed' }))
    expect(ledger('l1')?.entries.map((e) => e.topic)).toEqual(['Lunch', 'Changed'])
    expect(csvOnDisk('l1')).toContain('Changed')
  })

  it('deleteEntry removes the entry with that id', async () => {
    await seedAndLoad('l1', [entry('e1', 1), entry('e2', 2)])
    await state().deleteEntry('l1', 'e1')
    expect(ledger('l1')?.entries.map((e) => e.id)).toEqual(['e2'])
    expect(csvOnDisk('l1')).not.toContain('e1')
  })

  it('does not write the meta file', async () => {
    await seedAndLoad('l1')
    await state().addEntry('l1', draft())
    await state().updateEntry('l1', entry('e1', 1, { topic: 'x' }))
    await state().deleteEntry('l1', 'e1')
    expect(writesTo(ledgerMetaPath('l1'))).toEqual([])
  })

  it('rejects for a ledger that is not loaded, with no write', async () => {
    seedLedger('l1')
    await expect(state().addEntry('l1', draft())).rejects.toThrow('not loaded')
    await expect(state().importEntries('l1', [draft()])).rejects.toThrow('not loaded')
    await expect(state().updateEntry('l1', entry('e1', 1))).rejects.toThrow('not loaded')
    await expect(state().deleteEntry('l1', 'e1')).rejects.toThrow('not loaded')
    await expect(state().saveLedgerColumns('l1', {})).rejects.toThrow('not loaded')
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('rejects for an id that is not a valid id, with no write', async () => {
    await expect(state().addEntry('../x', draft())).rejects.toThrow('Invalid ledger id: ../x')
    await expect(state().saveLedgerColumns('a/b', {})).rejects.toThrow('Invalid ledger id: a/b')
    expect(files.writeText).not.toHaveBeenCalled()
    expect(state().ledgers).toEqual({})
  })
})

describe('a ledger that could not be read', () => {
  it('refuses every write and leaves the files as they are', async () => {
    const csv = seedLedger('l1', [entry('e1', 1)])
    disk.set(ledgerMetaPath('l1'), '{not json')
    await state().loadLedger('l1')
    await expect(state().addEntry('l1', draft())).rejects.toThrow('could not be read')
    await expect(state().importEntries('l1', [draft()])).rejects.toThrow('could not be read')
    await expect(state().updateEntry('l1', entry('e1', 1))).rejects.toThrow('could not be read')
    await expect(state().deleteEntry('l1', 'e1')).rejects.toThrow('could not be read')
    await expect(state().saveLedgerColumns('l1', {})).rejects.toThrow('could not be read')
    expect(files.writeText).not.toHaveBeenCalled()
    expect(disk.get(ledgerMetaPath('l1'))).toBe('{not json')
    expect(csvOnDisk('l1')).toBe(csv)
    expect(ledger('l1')).toMatchObject({ entries: [], saveError: null })
  })
})

describe('failed writes', () => {
  it('records saveError, keeps the old file and clears the error on the next successful write', async () => {
    const oldCsv = await seedAndLoad('l1', [entry('e1', 1)])
    failing.add(ledgerCsvPath('l1'))
    await expect(state().addEntry('l1', draft({ topic: 'Second' }))).resolves.toBeUndefined()
    expect(ledger('l1')?.saveError).toContain('EBUSY')
    expect(ledger('l1')?.entries).toHaveLength(2)
    expect(csvOnDisk('l1')).toBe(oldCsv)

    failing.clear()
    await state().addEntry('l1', draft({ topic: 'Third' }))
    expect(ledger('l1')?.saveError).toBeNull()
    expect(csvOnDisk('l1')).toContain('Second')
    expect(csvOnDisk('l1')).toContain('Third')
  })

  it('records saveError when the bridge throws before it returns a promise', async () => {
    await seedAndLoad('l1')
    files.writeText.mockImplementationOnce(() => {
      throw new Error('bridge down')
    })
    await state().addEntry('l1', draft())
    expect(ledger('l1')?.saveError).toContain('bridge down')
  })

  it('does not show an error as saved when only the meta write failed, and retries the meta', async () => {
    await seedAndLoad('l1')
    failing.add(ledgerMetaPath('l1'))
    await state().saveLedgerColumns('l1', { amount: { width: 90 } })
    expect(ledger('l1')?.saveError).toContain('EBUSY')
    expect(ledger('l1')?.meta.columns).toEqual({ amount: { width: 90 } })
    expect(csvOnDisk('l1')).not.toBe('')

    failing.clear()
    await state().addEntry('l1', draft())
    expect(ledger('l1')?.saveError).toBeNull()
    expect(JSON.parse(disk.get(ledgerMetaPath('l1')) ?? '')).toMatchObject({ columns: { amount: { width: 90 } } })
  })
})

describe('serialized writes', () => {
  it('ends with the newest CSV after two quick updateEntry calls', async () => {
    await seedAndLoad('l1', [entry('e1', 1)])
    hold(ledgerCsvPath('l1'))
    const results = [
      state().updateEntry('l1', entry('e1', 1, { topic: 'v1' })),
      state().updateEntry('l1', entry('e1', 1, { topic: 'v2' })),
      state().updateEntry('l1', entry('e1', 1, { topic: 'v3' }))
    ]
    release(ledgerCsvPath('l1'))
    await Promise.all(results)
    expect(csvOnDisk('l1')).toContain('v3')
    expect(csvOnDisk('l1')).not.toContain('v2')
    expect(writesTo(ledgerCsvPath('l1'))).toHaveLength(2)
    expect(ledger('l1')?.entries[0].topic).toBe('v3')
    expect(ledger('l1')?.saveError).toBeNull()
  })

  it('sets the state before the write is done', async () => {
    await seedAndLoad('l1', [entry('e1', 1)])
    hold(ledgerCsvPath('l1'))
    const pending = state().updateEntry('l1', entry('e1', 1, { topic: 'now' }))
    expect(ledger('l1')?.entries[0].topic).toBe('now')
    release(ledgerCsvPath('l1'))
    await pending
  })
})

describe('saveLedgerColumns', () => {
  it('writes the meta and the CSV and keeps the new columns in the state', async () => {
    await seedAndLoad('l1')
    await state().saveLedgerColumns('l1', { amount: { align: 'right', width: 90 } })
    expect(ledger('l1')?.meta.columns).toEqual({ amount: { align: 'right', width: 90 } })
    expect(JSON.parse(disk.get(ledgerMetaPath('l1')) ?? '')).toEqual({
      ...META,
      columns: { amount: { align: 'right', width: 90 } }
    })
    expect(writesTo(ledgerCsvPath('l1'))).toHaveLength(1)
  })

  it('writes the meta again only when it changed', async () => {
    await seedAndLoad('l1')
    await state().saveLedgerColumns('l1', { amount: { width: 90 } })
    await state().saveLedgerColumns('l1', { amount: { width: 90 } })
    expect(writesTo(ledgerMetaPath('l1'))).toHaveLength(1)
    await state().saveLedgerColumns('l1', { amount: { width: 91 } })
    expect(writesTo(ledgerMetaPath('l1'))).toHaveLength(2)
  })

  it('rejects columns that a load would reject, changes nothing and writes nothing', async () => {
    await seedAndLoad('l1')
    await expect(state().saveLedgerColumns('l1', { amount: { width: 0 } })).rejects.toThrow('width must be')
    expect(ledger('l1')?.meta.columns).toBeUndefined()
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('cuts decimals to 0..20 before it stores and writes them', async () => {
    await seedAndLoad('l1')
    const format = { thousands: true, currencySymbol: '', symbolPosition: 'after' as const }
    await state().saveLedgerColumns('l1', { amount: { number: { ...format, decimals: 99 } } })
    expect(ledger('l1')?.meta.columns?.amount.number?.decimals).toBe(20)
    expect(JSON.parse(disk.get(ledgerMetaPath('l1')) ?? '').columns.amount.number.decimals).toBe(20)
  })

  it('accepts a column without a width, which is how Auto width saves it', async () => {
    await seedAndLoad('l1', [], { ...META, columns: { amount: { align: 'right', width: 90 } } })
    await state().saveLedgerColumns('l1', { amount: { align: 'right' } })
    expect(ledger('l1')?.meta.columns).toEqual({ amount: { align: 'right' } })
    expect(JSON.parse(disk.get(ledgerMetaPath('l1')) ?? '').columns).toEqual({ amount: { align: 'right' } })
    expect(ledger('l1')?.saveError).toBeNull()
  })

  it('drops a width that is set to undefined, so no key reaches the file', async () => {
    await seedAndLoad('l1', [], { ...META, columns: { amount: { width: 90 } } })
    await state().saveLedgerColumns('l1', { amount: { align: 'center', width: undefined } })
    expect(Object.keys(ledger('l1')?.meta.columns?.amount ?? {})).toEqual(['align'])
    expect(disk.get(ledgerMetaPath('l1'))).not.toContain('width')
  })

  it('writes the last width when it is changed back while the first write is in flight', async () => {
    await seedAndLoad('l1', [], { ...META, columns: { amount: { width: 80 } } })
    hold(ledgerMetaPath('l1'))
    const first = state().saveLedgerColumns('l1', { amount: { width: 90 } })
    const second = state().saveLedgerColumns('l1', { amount: { width: 80 } })
    release(ledgerMetaPath('l1'))
    await Promise.all([first, second])
    expect(JSON.parse(disk.get(ledgerMetaPath('l1')) ?? '').columns).toEqual({ amount: { width: 80 } })
    expect(ledger('l1')?.meta.columns).toEqual({ amount: { width: 80 } })
    expect(ledger('l1')?.saveError).toBeNull()
  })

  it('retries the meta when the write of an older text fails but a newer one is queued', async () => {
    await seedAndLoad('l1', [], { ...META, columns: { amount: { width: 80 } } })
    hold(ledgerMetaPath('l1'))
    failing.add(ledgerMetaPath('l1'))
    const first = state().saveLedgerColumns('l1', { amount: { width: 90 } })
    const second = state().saveLedgerColumns('l1', { amount: { width: 100 } })
    release(ledgerMetaPath('l1'))
    await Promise.all([first, second])
    expect(ledger('l1')?.saveError).toContain('EBUSY')
    failing.clear()
    await state().saveLedgerColumns('l1', { amount: { width: 100 } })
    expect(ledger('l1')?.saveError).toBeNull()
    expect(JSON.parse(disk.get(ledgerMetaPath('l1')) ?? '').columns).toEqual({ amount: { width: 100 } })
  })
})

describe('createLedger', () => {
  it('sets the ledger state at once and writes the meta and the CSV header', async () => {
    const created = state().createLedger('l1', 'Home')
    expect(ledger('l1')).toEqual({
      meta: { name: 'Home', currencySymbol: '€' },
      entries: [],
      saveError: null,
      loadError: null
    })
    await created
    expect(JSON.parse(disk.get(ledgerMetaPath('l1')) ?? '')).toEqual(META)
    expect(csvOnDisk('l1')).toBe(serializeLedgerCsv([]))
    expect(csvOnDisk('l1')).toContain('id,pos,date,type,amount,accountId,categoryPath,topic,tags,referenceLink')
  })

  it('can be used for entries right away', async () => {
    await state().createLedger('l1', 'Home')
    await state().addEntry('l1', draft())
    expect(ledger('l1')?.entries).toHaveLength(1)
    expect(writesTo(ledgerMetaPath('l1'))).toHaveLength(1)
  })

  it.each([['meta', ledgerMetaPath('l1')], ['CSV', ledgerCsvPath('l1')]])(
    'rejects when the %s write fails and records saveError',
    async (_label, path) => {
      failing.add(path)
      await expect(state().createLedger('l1', 'Home')).rejects.toThrow('EBUSY')
      expect(ledger('l1')?.saveError).toContain('EBUSY')
    }
  )

  it('retries the meta with the next write after a failed create', async () => {
    failing.add(ledgerMetaPath('l1'))
    await expect(state().createLedger('l1', 'Home')).rejects.toThrow('EBUSY')
    failing.clear()
    await state().addEntry('l1', draft())
    expect(JSON.parse(disk.get(ledgerMetaPath('l1')) ?? '')).toEqual(META)
    expect(ledger('l1')?.saveError).toBeNull()
  })

  it.each(['../x', 'a/b', ''])('rejects the id %j before any state or file', async (id) => {
    await expect(state().createLedger(id, 'Home')).rejects.toThrow('Invalid ledger id')
    expect(state().ledgers).toEqual({})
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('does not replace a ledger that is loaded', async () => {
    await seedAndLoad('l1', [entry('e1', 1)])
    await expect(state().createLedger('l1', 'Other')).rejects.toThrow('already exists')
    expect(files.writeText).not.toHaveBeenCalled()
    expect(ledger('l1')?.entries).toHaveLength(1)
  })
})

describe('deleteLedger', () => {
  it('removes both files and drops the state', async () => {
    await seedAndLoad('l1')
    await state().deleteLedger('l1')
    expect(files.remove.mock.calls.map(([path]) => path)).toEqual([ledgerCsvPath('l1'), ledgerMetaPath('l1')])
    expect(ledger('l1')).toBeUndefined()
    expect(disk.has(ledgerCsvPath('l1'))).toBe(false)
  })

  it.each(['../x', 'a/b', '..', ''])('rejects the id %j before any remove', async (id) => {
    await expect(state().deleteLedger(id)).rejects.toThrow('Invalid ledger id')
    expect(files.remove).not.toHaveBeenCalled()
  })

  it('waits for a queued write, so the write cannot bring the file back', async () => {
    await seedAndLoad('l1')
    hold(ledgerCsvPath('l1'))
    const written = state().addEntry('l1', draft())
    const deleted = state().deleteLedger('l1')
    await settle()
    expect(files.remove).not.toHaveBeenCalled()
    release(ledgerCsvPath('l1'))
    await Promise.all([written, deleted])
    expect(log.filter((line) => !line.startsWith('read'))).toEqual([
      `write ${ledgerCsvPath('l1')}`,
      `remove ${ledgerCsvPath('l1')}`,
      `remove ${ledgerMetaPath('l1')}`
    ])
    expect(disk.has(ledgerCsvPath('l1'))).toBe(false)
    expect(ledger('l1')).toBeUndefined()
  })

  it('refuses an update that starts during the delete, so no file comes back', async () => {
    await seedAndLoad('l1')
    hold(ledgerCsvPath('l1'))
    const deleted = state().deleteLedger('l1')
    const added = state().addEntry('l1', draft()).then(
      () => 'accepted',
      (error: Error) => error.message
    )
    await expect(added).resolves.toContain('being deleted')
    await deleted
    release(ledgerCsvPath('l1'))
    await flushWrites()
    expect(writesTo(ledgerCsvPath('l1'))).toEqual([])
    expect(disk.has(ledgerCsvPath('l1'))).toBe(false)
    expect(ledger('l1')).toBeUndefined()
  })

  it('lets a ledger be changed again when the delete failed', async () => {
    await seedAndLoad('l1')
    files.remove.mockRejectedValueOnce(new Error('EPERM: operation not permitted'))
    await expect(state().deleteLedger('l1')).rejects.toThrow('EPERM')
    await expect(state().addEntry('l1', draft())).resolves.toBeUndefined()
  })

  it('rejects when a remove fails and keeps the state', async () => {
    await seedAndLoad('l1')
    files.remove.mockRejectedValueOnce(new Error('EPERM: operation not permitted'))
    await expect(state().deleteLedger('l1')).rejects.toThrow('EPERM')
    expect(ledger('l1')).toBeDefined()
  })

  it('can delete a ledger that is not loaded', async () => {
    seedLedger('l1')
    await state().deleteLedger('l1')
    expect(disk.has(ledgerMetaPath('l1'))).toBe(false)
  })
})

describe('listLedgers', () => {
  it('lists the ledgers by the names in their meta files', async () => {
    disk.set(ledgerMetaPath('l1'), JSON.stringify({ name: 'Home', currencySymbol: '€' }))
    disk.set(ledgerMetaPath('l2'), JSON.stringify({ name: 'Work', currencySymbol: '$' }))
    files.list.mockResolvedValue([
      { name: 'l1.meta.json', isDirectory: false },
      { name: 'l1.csv', isDirectory: false },
      { name: 'l2.meta.json', isDirectory: false }
    ])
    await expect(state().listLedgers()).resolves.toEqual([
      { id: 'l1', name: 'Home' },
      { id: 'l2', name: 'Work' }
    ])
    expect(files.list).toHaveBeenCalledWith('finance/ledgers')
  })

  it('lists a ledger whose meta cannot be read by its id', async () => {
    disk.set(ledgerMetaPath('l1'), '{not json')
    files.list.mockResolvedValue([{ name: 'l1.meta.json', isDirectory: false }])
    await expect(state().listLedgers()).resolves.toEqual([{ id: 'l1', name: 'l1' }])
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('skips names that are not a valid id and folders', async () => {
    files.list.mockResolvedValue([
      { name: 'a b.meta.json', isDirectory: false },
      { name: '..meta.json', isDirectory: false },
      { name: '.meta.json', isDirectory: false },
      { name: 'x.y.meta.json', isDirectory: false },
      { name: `${'x'.repeat(65)}.meta.json`, isDirectory: false },
      { name: 'dir.meta.json', isDirectory: true },
      { name: 'ok.meta.json', isDirectory: false }
    ])
    await expect(state().listLedgers()).resolves.toEqual([{ id: 'ok', name: 'ok' }])
    expect(files.readText).toHaveBeenCalledTimes(1)
  })

  it('is empty when the folder is missing', async () => {
    await expect(state().listLedgers()).resolves.toEqual([])
  })
})

describe('ledgerOf', () => {
  it('finds own ledgers only', () => {
    const own = { meta: META, entries: [], saveError: null, loadError: null }
    expect(ledgerOf({ l1: own }, 'l1')).toBe(own)
    expect(ledgerOf({}, 'constructor')).toBeUndefined()
    expect(ledgerOf({}, '__proto__')).toBeUndefined()
  })
})
