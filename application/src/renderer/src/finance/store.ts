import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Account, CategoryNode, Entry, LedgerMeta } from './model'
import type { ColumnConfig } from '../lib/columnConfig'
import { parseLedgerCsv, serializeLedgerCsv } from './csv'
import { useNotebookStore } from '../store/notebookStore'

const FINANCE_DIR = 'finance'
const LEDGERS_DIR = `${FINANCE_DIR}/ledgers`

function root(): string {
  const dataRoot = useNotebookStore.getState().dataRoot
  if (!dataRoot) throw new Error('No notebook folder open')
  return dataRoot
}
const join = (...parts: string[]): string => parts.join('/')

async function readJson<T>(path: string, fallback: T): Promise<T> {
  if (!(await window.api.fs.exists(path))) return fallback
  try {
    return JSON.parse(await window.api.fs.readFile(path)) as T
  } catch {
    return fallback
  }
}

interface LedgerState {
  meta: LedgerMeta
  entries: Entry[]
}

interface FinanceState {
  ledgers: Record<string, LedgerState>
  accounts: Account[]
  categories: CategoryNode[]
  loaded: boolean
  loadReferenceData: () => Promise<void>
  loadLedger: (ledgerId: string) => Promise<void>
  createLedger: (name: string, currencySymbol: string) => Promise<string>
  deleteLedger: (ledgerId: string) => Promise<void>
  saveLedgerColumns: (ledgerId: string, columns: Record<string, ColumnConfig>) => Promise<void>
  listLedgers: () => Promise<Array<{ id: string; name: string }>>
  addEntry: (ledgerId: string, entry: Omit<Entry, 'id' | 'pos'>) => Promise<void>
  importEntries: (ledgerId: string, entries: Omit<Entry, 'id' | 'pos'>[]) => Promise<void>
  updateEntry: (ledgerId: string, entry: Entry) => Promise<void>
  deleteEntry: (ledgerId: string, entryId: string) => Promise<void>
  ensureAccounts: (names: string[]) => Promise<Record<string, string>>
  ensureCategories: (paths: string[]) => Promise<void>
  saveAccounts: (accounts: Account[]) => Promise<void>
  saveCategories: (categories: CategoryNode[]) => Promise<void>
}

const ledgerCsvPath = (id: string): string => join(root(), LEDGERS_DIR, `${id}.csv`)
const ledgerMetaPath = (id: string): string => join(root(), LEDGERS_DIR, `${id}.meta.json`)

async function persistLedger(id: string, state: LedgerState): Promise<void> {
  await window.api.fs.mkdir(join(root(), LEDGERS_DIR))
  await window.api.fs.writeFile(ledgerMetaPath(id), JSON.stringify(state.meta, null, 2))
  await window.api.fs.writeFile(ledgerCsvPath(id), serializeLedgerCsv(state.entries))
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  ledgers: {},
  accounts: [],
  categories: [],
  loaded: false,

  loadReferenceData: async () => {
    const accounts = await readJson<Account[]>(join(root(), FINANCE_DIR, 'accounts.json'), [])
    const categories = await readJson<CategoryNode[]>(
      join(root(), FINANCE_DIR, 'categories.json'),
      []
    )
    set({ accounts, categories, loaded: true })
  },

  loadLedger: async (ledgerId) => {
    if (get().ledgers[ledgerId]) return
    const meta = await readJson<LedgerMeta>(ledgerMetaPath(ledgerId), {
      name: ledgerId,
      currencySymbol: '€'
    })
    const csv = (await window.api.fs.exists(ledgerCsvPath(ledgerId)))
      ? await window.api.fs.readFile(ledgerCsvPath(ledgerId))
      : ''
    set((s) => ({
      ledgers: { ...s.ledgers, [ledgerId]: { meta, entries: parseLedgerCsv(csv) } }
    }))
  },

  createLedger: async (name, currencySymbol) => {
    const id = nanoid(6)
    const state: LedgerState = { meta: { name, currencySymbol }, entries: [] }
    await persistLedger(id, state)
    set((s) => ({ ledgers: { ...s.ledgers, [id]: state } }))
    return id
  },

  deleteLedger: async (ledgerId) => {
    await window.api.fs.remove(ledgerCsvPath(ledgerId))
    await window.api.fs.remove(ledgerMetaPath(ledgerId))
    set((s) => {
      const next = { ...s.ledgers }
      delete next[ledgerId]
      return { ledgers: next }
    })
  },

  listLedgers: async () => {
    const dir = join(root(), LEDGERS_DIR)
    if (!(await window.api.fs.exists(dir))) return []
    const files = await window.api.fs.readDir(dir)
    const metas = files.filter((f) => f.name.endsWith('.meta.json'))
    const result: Array<{ id: string; name: string }> = []
    for (const f of metas) {
      const id = f.name.replace(/\.meta\.json$/, '')
      const meta = await readJson<LedgerMeta>(join(dir, f.name), { name: id, currencySymbol: '€' })
      result.push({ id, name: meta.name })
    }
    return result
  },

  addEntry: async (ledgerId, entry) => {
    const ledger = get().ledgers[ledgerId]
    if (!ledger) return
    const pos = ledger.entries.reduce((max, e) => Math.max(max, e.pos), 0) + 1
    const next: LedgerState = {
      ...ledger,
      entries: [...ledger.entries, { ...entry, id: nanoid(), pos }]
    }
    set((s) => ({ ledgers: { ...s.ledgers, [ledgerId]: next } }))
    await persistLedger(ledgerId, next)
  },

  saveLedgerColumns: async (ledgerId, columns) => {
    const ledger = get().ledgers[ledgerId]
    if (!ledger) return
    const next: LedgerState = { ...ledger, meta: { ...ledger.meta, columns } }
    set((s) => ({ ledgers: { ...s.ledgers, [ledgerId]: next } }))
    await persistLedger(ledgerId, next)
  },

  importEntries: async (ledgerId, entries) => {
    const ledger = get().ledgers[ledgerId]
    if (!ledger) return
    let pos = ledger.entries.reduce((max, e) => Math.max(max, e.pos), 0)
    const added = entries.map((e) => ({ ...e, id: nanoid(), pos: ++pos }))
    const next: LedgerState = { ...ledger, entries: [...ledger.entries, ...added] }
    set((s) => ({ ledgers: { ...s.ledgers, [ledgerId]: next } }))
    await persistLedger(ledgerId, next)
  },

  ensureAccounts: async (names) => {
    const existing = get().accounts
    const map: Record<string, string> = {}
    for (const acc of existing) map[acc.name] = acc.id
    const toAdd: Account[] = []
    for (const name of names) {
      if (map[name]) continue
      const id = nanoid(6)
      map[name] = id
      toAdd.push({ id, name, openingBalance: '0' })
    }
    if (toAdd.length > 0) {
      const nextAccounts = [...existing, ...toAdd]
      set({ accounts: nextAccounts })
      await window.api.fs.mkdir(join(root(), FINANCE_DIR))
      await window.api.fs.writeFile(
        join(root(), FINANCE_DIR, 'accounts.json'),
        JSON.stringify(nextAccounts, null, 2)
      )
    }
    return map
  },

  ensureCategories: async (paths) => {
    const tree: CategoryNode[] = structuredClone(get().categories)
    for (const path of paths) {
      let level = tree
      for (const seg of path.split('/')) {
        let child = level.find((n) => n.name === seg)
        if (!child) {
          child = { name: seg, children: [] }
          level.push(child)
        }
        level = child.children
      }
    }
    set({ categories: tree })
    await window.api.fs.mkdir(join(root(), FINANCE_DIR))
    await window.api.fs.writeFile(
      join(root(), FINANCE_DIR, 'categories.json'),
      JSON.stringify(tree, null, 2)
    )
  },

  updateEntry: async (ledgerId, entry) => {
    const ledger = get().ledgers[ledgerId]
    if (!ledger) return
    const next: LedgerState = {
      ...ledger,
      entries: ledger.entries.map((e) => (e.id === entry.id ? entry : e))
    }
    set((s) => ({ ledgers: { ...s.ledgers, [ledgerId]: next } }))
    await persistLedger(ledgerId, next)
  },

  deleteEntry: async (ledgerId, entryId) => {
    const ledger = get().ledgers[ledgerId]
    if (!ledger) return
    const next: LedgerState = {
      ...ledger,
      entries: ledger.entries.filter((e) => e.id !== entryId)
    }
    set((s) => ({ ledgers: { ...s.ledgers, [ledgerId]: next } }))
    await persistLedger(ledgerId, next)
  },

  saveAccounts: async (accounts) => {
    set({ accounts })
    await window.api.fs.mkdir(join(root(), FINANCE_DIR))
    await window.api.fs.writeFile(
      join(root(), FINANCE_DIR, 'accounts.json'),
      JSON.stringify(accounts, null, 2)
    )
  },

  saveCategories: async (categories) => {
    set({ categories })
    await window.api.fs.mkdir(join(root(), FINANCE_DIR))
    await window.api.fs.writeFile(
      join(root(), FINANCE_DIR, 'categories.json'),
      JSON.stringify(categories, null, 2)
    )
  }
}))
