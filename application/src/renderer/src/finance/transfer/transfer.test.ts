import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushWrites } from '@renderer/storage'
import type { FileFilter } from '@shared/ipc'
import { serializeCsv } from '../csv'
import { LEDGER_HEADER, serializeLedgerCsv } from '../ledgerCsv'
import type { Account, CategoryNode, Entry } from '../model'
import { ACCOUNTS_PATH, CATEGORIES_PATH, ledgerCsvPath, ledgerMetaPath } from '../paths'
import { ledgerOf, useFinanceStore, type LedgerState } from '../store'
import { exportLedgerCsv, importLedgerCsv, importMoneyManager } from './transfer'

const EBUSY = 'EBUSY: resource busy or locked'
const NOT_SAVED = new RegExp(
  `^Entries were added but could not be saved \\(${EBUSY}\\)\\. Do not import again: close the program that holds the file, then change any entry to save\\.$`
)
const CSV_FILTER: FileFilter[] = [{ name: 'CSV', extensions: ['csv'] }]

// Disk of the window.api fake; a path in `failing` rejects its writes and keeps the old file
let disk: Map<string, string>
let failing: Set<string>
const files = {
  readText: vi.fn<(path: string) => Promise<string | null>>(),
  writeText: vi.fn<(path: string, text: string) => Promise<void>>(),
  remove: vi.fn<(path: string) => Promise<void>>(),
  list: vi.fn<(dir: string) => Promise<never[]>>(),
  importText: vi.fn<(filters: FileFilter[]) => Promise<string | null>>(),
  exportText: vi.fn<(name: string, filters: FileFilter[], text: string) => Promise<boolean>>()
}
const xlsx = { importSheet: vi.fn<() => Promise<string[][] | null>>() }

beforeEach(() => {
  disk = new Map()
  failing = new Set()
  files.readText.mockReset().mockImplementation(async (path) => disk.get(path) ?? null)
  files.writeText.mockReset().mockImplementation(async (path, text) => {
    if (failing.has(path)) throw new Error(EBUSY)
    disk.set(path, text)
  })
  files.remove.mockReset().mockImplementation(async (path) => void disk.delete(path))
  files.list.mockReset().mockResolvedValue([])
  files.importText.mockReset().mockResolvedValue(null)
  files.exportText.mockReset().mockResolvedValue(true)
  xlsx.importSheet.mockReset().mockResolvedValue(null)
  vi.stubGlobal('window', { api: { files, xlsx } })
  useFinanceStore.setState(useFinanceStore.getInitialState(), true)
})

afterEach(async () => {
  await flushWrites()
  for (const id of Object.keys(state().ledgers)) await state().deleteLedger(id).catch(() => undefined)
  vi.unstubAllGlobals()
})

const state = useFinanceStore.getState
const ledger = (id: string): LedgerState | undefined => ledgerOf(state().ledgers, id)
const csvOnDisk = (id: string): string => disk.get(ledgerCsvPath(id)) ?? ''
const jsonOnDisk = (path: string): unknown => JSON.parse(disk.get(path) ?? 'null')

const entry = (id: string, pos: number, over: Partial<Entry> = {}): Entry => ({
  id,
  pos,
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

async function loadWith(id: string, entries: Entry[] = [entry('e1', 1)]): Promise<string> {
  const csv = serializeLedgerCsv(entries)
  disk.set(ledgerCsvPath(id), csv)
  disk.set(ledgerMetaPath(id), JSON.stringify({ name: 'Home', currencySymbol: '€' }))
  await state().loadLedger(id)
  files.writeText.mockClear()
  return csv
}

const writtenPaths = (): string[] => files.writeText.mock.calls.map(([path]) => path)

const csvRow = (over: Record<string, string> = {}): string[] => {
  const base: Record<string, string> = {
    id: 'x',
    pos: '9',
    date: '2026-03-01',
    type: 'income',
    amount: '5,5',
    accountId: 'foreign',
    categoryPath: ' Work / Pay ',
    topic: 'Salary',
    tags: 'a, b',
    referenceLink: '',
    ...over
  }
  return LEDGER_HEADER.map((name) => base[name] ?? '')
}
const csvFile = (...rows: string[][]): string => serializeCsv([LEDGER_HEADER, ...rows])

const MM_HEADER = ['Datum', 'Konto', 'Kategorie', 'Unterkategorie', 'Notiz', 'EUR', 'Einnahmen/Ausgaben']
const mmRow = (over: Record<number, string> = {}): string[] => {
  const row = ['45658', 'Konto A', 'Freizeit', 'Kino', 'Beispiel', '5.0', 'Ausgabe']
  Object.entries(over).forEach(([index, value]) => (row[Number(index)] = value))
  return row
}

describe('importLedgerCsv', () => {
  it('asks for a CSV file and returns null when the user cancels', async () => {
    await loadWith('l1')
    await expect(importLedgerCsv('l1')).resolves.toBeNull()
    expect(files.importText).toHaveBeenCalledWith(CSV_FILTER)
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('adds the valid rows, counts the skipped ones and creates no accounts or categories', async () => {
    await loadWith('l1', [entry('e1', 4)])
    files.importText.mockResolvedValue(csvFile(csvRow(), csvRow({ amount: 'abc' }), csvRow({ date: '2026-02-31' })))
    await expect(importLedgerCsv('l1')).resolves.toEqual({
      imported: 1,
      skipped: 2,
      createdAccounts: 0,
      createdCategories: 0
    })
    expect(ledger('l1')?.entries).toHaveLength(2)
    expect(ledger('l1')?.entries[1]).toMatchObject({
      pos: 5,
      amount: '5.50',
      categoryPath: 'Work/Pay',
      tags: ['a', 'b'],
      accountId: 'foreign'
    })
    expect(csvOnDisk('l1')).toContain('5.50')
    expect(writtenPaths()).toEqual([ledgerCsvPath('l1')])
  })

  it('throws for a file that is not a ledger CSV and writes nothing', async () => {
    const csv = await loadWith('l1')
    files.importText.mockResolvedValue('name,value\r\nx,1')
    await expect(importLedgerCsv('l1')).rejects.toThrow('This is not a MyNote ledger CSV')
    expect(files.writeText).not.toHaveBeenCalled()
    expect(csvOnDisk('l1')).toBe(csv)
  })

  it('reports a file without valid rows and writes nothing', async () => {
    await loadWith('l1')
    files.importText.mockResolvedValue(csvFile(csvRow({ amount: 'abc' })))
    await expect(importLedgerCsv('l1')).resolves.toMatchObject({ imported: 0, skipped: 1 })
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('throws the write error when the CSV is held open, instead of reporting success', async () => {
    const csv = await loadWith('l1')
    failing.add(ledgerCsvPath('l1'))
    files.importText.mockResolvedValue(csvFile(csvRow()))
    await expect(importLedgerCsv('l1')).rejects.toThrow(NOT_SAVED)
    expect(ledger('l1')?.saveError).toContain('EBUSY')
    expect(csvOnDisk('l1')).toBe(csv)
  })

  it('throws for a ledger that could not be read and leaves its files alone', async () => {
    const garbled = 'name,value\r\nx,1'
    disk.set(ledgerCsvPath('l1'), garbled)
    await state().loadLedger('l1')
    files.importText.mockResolvedValue(csvFile(csvRow()))
    await expect(importLedgerCsv('l1')).rejects.toThrow('could not be read')
    expect(files.writeText).not.toHaveBeenCalled()
    expect(csvOnDisk('l1')).toBe(garbled)
  })

  it('throws for a ledger that is not loaded and writes nothing', async () => {
    files.importText.mockResolvedValue(csvFile(csvRow()))
    await expect(importLedgerCsv('l1')).rejects.toThrow('not loaded')
    expect(files.writeText).not.toHaveBeenCalled()
  })
})

describe('importMoneyManager', () => {
  const stored = (accounts: Account[], categories: CategoryNode[]): void => {
    disk.set(ACCOUNTS_PATH, JSON.stringify(accounts))
    disk.set(CATEGORIES_PATH, JSON.stringify(categories))
  }

  it('reads a sheet and returns null when the user cancels', async () => {
    await loadWith('l1')
    await expect(importMoneyManager('l1')).resolves.toBeNull()
    expect(xlsx.importSheet).toHaveBeenCalledTimes(1)
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('creates the accounts and categories it needs and counts only the new ones', async () => {
    stored([{ id: 'a1', name: 'Konto A', openingBalance: '0' }], [{ name: 'Freizeit', children: [] }])
    await loadWith('l1')
    xlsx.importSheet.mockResolvedValue([
      MM_HEADER,
      mmRow(),
      mmRow({ 1: 'Konto B', 2: 'Arbeit', 3: 'Gehalt', 6: 'Einkommen' }),
      mmRow({ 6: 'Ausgehender Transfer' }),
      mmRow({ 5: 'abc' })
    ])
    await expect(importMoneyManager('l1')).resolves.toEqual({
      imported: 2,
      skipped: 2,
      createdAccounts: 1,
      createdCategories: 3
    })
    const accounts = state().accounts
    expect(accounts.map((a) => a.name)).toEqual(['Konto A', 'Konto B'])
    expect(jsonOnDisk(ACCOUNTS_PATH)).toEqual(accounts)
    expect(jsonOnDisk(CATEGORIES_PATH)).toEqual([
      { name: 'Freizeit', children: [{ name: 'Kino', children: [] }] },
      { name: 'Arbeit', children: [{ name: 'Gehalt', children: [] }] }
    ])
    expect(ledger('l1')?.entries.slice(1)).toMatchObject([
      { amount: '5.00', date: '2025-01-01', categoryPath: 'Freizeit/Kino', accountId: 'a1' },
      { type: 'income', accountId: accounts[1].id }
    ])
  })

  it('counts nothing as created when everything exists', async () => {
    stored([{ id: 'a1', name: 'Konto A', openingBalance: '0' }], [{ name: 'Freizeit', children: [{ name: 'Kino', children: [] }] }])
    await loadWith('l1')
    xlsx.importSheet.mockResolvedValue([MM_HEADER, mmRow()])
    await expect(importMoneyManager('l1')).resolves.toMatchObject({ createdAccounts: 0, createdCategories: 0 })
    expect(writtenPaths()).toEqual([ledgerCsvPath('l1')])
  })

  it('counts against the files, not against a state that was never loaded', async () => {
    stored([{ id: 'a1', name: 'Konto A', openingBalance: '0' }], [])
    await loadWith('l1')
    expect(state().accounts).toEqual([])
    xlsx.importSheet.mockResolvedValue([MM_HEADER, mmRow()])
    await expect(importMoneyManager('l1')).resolves.toMatchObject({ createdAccounts: 0, createdCategories: 2 })
  })

  it('gives an entry without an account the account id ""', async () => {
    await loadWith('l1')
    xlsx.importSheet.mockResolvedValue([MM_HEADER, mmRow({ 1: '' })])
    await importMoneyManager('l1')
    expect(ledger('l1')?.entries.at(-1)?.accountId).toBe('')
    expect(state().accounts).toEqual([])
  })

  it('maps names such as __proto__ and constructor to their own accounts', async () => {
    await loadWith('l1')
    xlsx.importSheet.mockResolvedValue([MM_HEADER, mmRow({ 1: '__proto__' }), mmRow({ 1: 'constructor' })])
    await importMoneyManager('l1')
    const ids = Object.fromEntries(state().accounts.map((a) => [a.name, a.id]))
    expect(ledger('l1')?.entries.slice(1).map((e) => e.accountId)).toEqual([ids['__proto__'], ids['constructor']])
  })

  it('throws for a sheet that is not a Money Manager export before anything is written', async () => {
    const csv = await loadWith('l1')
    xlsx.importSheet.mockResolvedValue([['a', 'b'], ['1', '2']])
    await expect(importMoneyManager('l1')).rejects.toThrow('This is not a Money Manager export')
    expect(files.writeText).not.toHaveBeenCalled()
    expect(csvOnDisk('l1')).toBe(csv)
  })

  it('throws the write error when the CSV is held open, instead of reporting success', async () => {
    const csv = await loadWith('l1')
    failing.add(ledgerCsvPath('l1'))
    xlsx.importSheet.mockResolvedValue([MM_HEADER, mmRow()])
    await expect(importMoneyManager('l1')).rejects.toThrow(NOT_SAVED)
    expect(csvOnDisk('l1')).toBe(csv)
  })

  it('throws for a ledger that could not be read before it creates any account', async () => {
    disk.set(ledgerCsvPath('l1'), 'name,value\r\nx,1')
    await state().loadLedger('l1')
    xlsx.importSheet.mockResolvedValue([MM_HEADER, mmRow()])
    await expect(importMoneyManager('l1')).rejects.toThrow('could not be read')
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('throws for a ledger that is not loaded before it creates any account', async () => {
    xlsx.importSheet.mockResolvedValue([MM_HEADER, mmRow()])
    await expect(importMoneyManager('l1')).rejects.toThrow('not loaded')
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('throws for a corrupt accounts.json, keeps it and imports nothing', async () => {
    const csv = await loadWith('l1')
    disk.set(ACCOUNTS_PATH, '{not json')
    xlsx.importSheet.mockResolvedValue([MM_HEADER, mmRow()])
    await expect(importMoneyManager('l1')).rejects.toThrow(ACCOUNTS_PATH)
    expect(files.writeText).not.toHaveBeenCalled()
    expect(disk.get(ACCOUNTS_PATH)).toBe('{not json')
    expect(csvOnDisk('l1')).toBe(csv)
  })

  it('reports a sheet without valid rows and creates nothing', async () => {
    await loadWith('l1')
    xlsx.importSheet.mockResolvedValue([MM_HEADER, mmRow({ 6: 'Ausgehender Transfer' })])
    await expect(importMoneyManager('l1')).resolves.toEqual({
      imported: 0,
      skipped: 1,
      createdAccounts: 0,
      createdCategories: 0
    })
    expect(files.writeText).not.toHaveBeenCalled()
  })
})

describe('exportLedgerCsv', () => {
  it('offers <ledger name>-<id>.csv and the CSV text, and gives true when saved', async () => {
    const entries = [entry('e1', 1), entry('e2', 2, { topic: 'Dinner, late' })]
    await loadWith('l1', entries)
    await expect(exportLedgerCsv('l1')).resolves.toBe(true)
    expect(files.exportText).toHaveBeenCalledWith('Home-l1.csv', CSV_FILTER, serializeLedgerCsv(entries))
  })

  it('gives false when the user cancels', async () => {
    await loadWith('l1')
    files.exportText.mockResolvedValue(false)
    await expect(exportLedgerCsv('l1')).resolves.toBe(false)
  })

  it('writes the cells unchanged, so the export imports exactly', async () => {
    const entries = [
      entry('e1', 1, { topic: '=SUM(A1:A2)', referenceLink: 'C:\\inv\\1.pdf', tags: ['x', 'y'], categoryPath: 'A/B' }),
      entry('e2', 2, { type: 'income', amount: '1000.00', topic: 'say "hi", ok\nnext' })
    ]
    await loadWith('l1', entries)
    await exportLedgerCsv('l1')
    const text = files.exportText.mock.calls[0][2]
    expect(text).toContain('=SUM(A1:A2)')

    await loadWith('l2', [])
    files.importText.mockResolvedValue(text)
    await importLedgerCsv('l2')
    expect(ledger('l2')?.entries).toEqual(
      entries.map((e) => ({ ...e, id: expect.any(String), pos: expect.any(Number) }))
    )
  })

  it('rejects with the write error', async () => {
    await loadWith('l1')
    files.exportText.mockRejectedValue(new Error(EBUSY))
    await expect(exportLedgerCsv('l1')).rejects.toThrow(EBUSY)
  })

  it('rejects for a ledger that is not loaded or could not be read, and opens no dialog', async () => {
    await expect(exportLedgerCsv('l1')).rejects.toThrow('not loaded')
    disk.set(ledgerCsvPath('l2'), 'name,value\r\nx,1')
    await state().loadLedger('l2')
    await expect(exportLedgerCsv('l2')).rejects.toThrow('could not be read')
    expect(files.exportText).not.toHaveBeenCalled()
  })
})
