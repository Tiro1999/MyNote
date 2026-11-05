import { create } from 'zustand'
import { messageOf } from '@shared/errors'
import {
  CorruptFileError,
  flushWrites,
  list,
  newId,
  readJson,
  readText,
  remove,
  writeJson,
  writeText
} from '@renderer/storage'
import type { ColumnConfig } from './ledger/columns'
import { loadLedgerCsv, serializeLedgerCsv } from './ledgerCsv'
import { DEFAULT_CURRENCY, cleanCategoryPath, splitCategoryPath } from './model'
import type { Account, CategoryNode, Entry, EntryDraft, LedgerMeta } from './model'
import {
  ACCOUNTS_PATH,
  CATEGORIES_PATH,
  LEDGERS_DIR,
  checkLedgerId,
  ledgerCsvPath,
  ledgerIdOfMetaFile,
  ledgerMetaPath
} from './paths'
import { MAX_CATEGORY_DEPTH, parseAccounts, parseCategories, parseLedgerMeta } from './validate'

export interface LedgerState {
  meta: LedgerMeta
  entries: Entry[]
  // The last write failed; the next successful write clears it
  saveError: string | null
  // The files could not be read; every write is refused so they stay as they are
  loadError: string | null
}

interface FinanceState {
  ledgers: Record<string, LedgerState>
  accounts: Account[]
  categories: CategoryNode[]
  referenceError: string | null
  loadReferenceData: () => Promise<void>
  loadLedger: (ledgerId: string) => Promise<void>
  createLedger: (ledgerId: string, name: string) => Promise<void>
  deleteLedger: (ledgerId: string) => Promise<void>
  saveLedgerColumns: (ledgerId: string, columns: Record<string, ColumnConfig>) => Promise<void>
  listLedgers: () => Promise<Array<{ id: string; name: string }>>
  addEntry: (ledgerId: string, entry: EntryDraft) => Promise<void>
  importEntries: (ledgerId: string, entries: EntryDraft[]) => Promise<void>
  updateEntry: (ledgerId: string, entry: Entry) => Promise<void>
  deleteEntry: (ledgerId: string, entryId: string) => Promise<void>
  ensureAccounts: (names: string[]) => Promise<Map<string, string>>
  ensureCategories: (paths: string[]) => Promise<void>
  saveAccounts: (accounts: Account[]) => Promise<void>
  saveCategories: (categories: CategoryNode[]) => Promise<void>
}

export function nextPos(entries: readonly Pick<Entry, 'pos'>[]): number {
  return entries.reduce((max, { pos }) => (Number.isFinite(pos) ? Math.max(max, pos) : max), 0) + 1
}

// An id such as constructor is a valid ledger id, so a plain lookup would find the prototype
export function ledgerOf(ledgers: Record<string, LedgerState>, id: string): LedgerState | undefined {
  return Object.hasOwn(ledgers, id) ? ledgers[id] : undefined
}

// ids maps each trimmed name to its account id; a Map, because names come from Excel files
export function mergeAccounts(
  accounts: Account[],
  names: string[],
  newAccountId: () => string
): { accounts: Account[]; ids: Map<string, string> } {
  const ids = new Map<string, string>()
  for (const account of accounts) {
    const name = account.name.trim()
    if (name !== '' && !ids.has(name)) ids.set(name, account.id)
  }
  const added: Account[] = []
  for (const raw of names) {
    const name = raw.trim()
    if (name === '' || ids.has(name)) continue
    const account: Account = { id: newAccountId(), name, openingBalance: '0' }
    ids.set(name, account.id)
    added.push(account)
  }
  return { accounts: added.length === 0 ? accounts : [...accounts, ...added], ids }
}

function insertPath(nodes: CategoryNode[], segments: string[]): CategoryNode[] {
  const [name, ...rest] = segments
  if (name === undefined) return nodes
  const index = nodes.findIndex((node) => node.name === name)
  if (index === -1) return [...nodes, { name, children: insertPath([], rest) }]
  const children = insertPath(nodes[index].children, rest)
  return children === nodes[index].children ? nodes : nodes.with(index, { ...nodes[index], children })
}

// Empty segments are ignored and a path stops at the depth a stored tree may have; no new paths = same tree
export function mergeCategoryPaths(nodes: CategoryNode[], paths: string[]): CategoryNode[] {
  return paths.reduce(
    (tree, path) => insertPath(tree, splitCategoryPath(cleanCategoryPath(path)).slice(0, MAX_CATEGORY_DEPTH)),
    nodes
  )
}

const metaText = (meta: LedgerMeta): string => JSON.stringify(meta, null, 2)

// The meta text last queued for each ledger; a meta is queued only when its text differs, and a failed write forgets it
const requestedMeta = new Map<string, string>()

// Ledgers being deleted: no update may queue a write that would bring a removed file back
const deleting = new Set<string>()

// A CSV that is not a ledger file counts as corrupt, like a bad meta.json: the ledger stays unreadable and unwritten
async function readEntries(id: string): Promise<Entry[]> {
  const path = ledgerCsvPath(id)
  const text = (await readText(path)) ?? ''
  try {
    return loadLedgerCsv(text)
  } catch (error) {
    throw new CorruptFileError(path, error)
  }
}

async function readLedger(id: string): Promise<LedgerState> {
  try {
    checkLedgerId(id)
    const meta = (await readJson(ledgerMetaPath(id), parseLedgerMeta)) ?? {
      name: id,
      currencySymbol: DEFAULT_CURRENCY
    }
    const entries = await readEntries(id)
    return { meta, entries, saveError: null, loadError: null }
  } catch (error) {
    const empty: LedgerMeta = { name: id, currencySymbol: DEFAULT_CURRENCY }
    return { meta: empty, entries: [], saveError: null, loadError: messageOf(error) }
  }
}

// The CSV always goes with the meta check, so a successful write means the whole ledger is on disk
async function writeLedger(id: string, ledger: LedgerState): Promise<void> {
  const text = metaText(ledger.meta)
  const writes = [writeText(ledgerCsvPath(id), serializeLedgerCsv(ledger.entries))]
  if (requestedMeta.get(id) !== text) {
    requestedMeta.set(id, text)
    writes.push(
      writeText(ledgerMetaPath(id), text).catch((error: unknown) => {
        if (requestedMeta.get(id) === text) requestedMeta.delete(id)
        throw error
      })
    )
  }
  const failed = (await Promise.allSettled(writes)).find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  )
  if (failed) throw failed.reason
}

async function readLedgerName(id: string): Promise<{ id: string; name: string }> {
  try {
    const meta = await readJson(ledgerMetaPath(id), parseLedgerMeta)
    return { id, name: meta?.name ?? id }
  } catch {
    return { id, name: id }
  }
}

export const useFinanceStore = create<FinanceState>((set, get) => {
  const putLedger = (id: string, ledger: LedgerState): void =>
    set((state) => ({ ledgers: { ...state.ledgers, [id]: ledger } }))

  const patchLedger = (id: string, patch: Partial<LedgerState>): void => {
    const ledger = ledgerOf(get().ledgers, id)
    if (ledger) putLedger(id, { ...ledger, ...patch })
  }

  // Writes the ledger as it is now, records the outcome in saveError and gives back the error, if any
  const persist = async (id: string): Promise<string | null> => {
    const ledger = ledgerOf(get().ledgers, id)
    if (!ledger) return null
    try {
      await writeLedger(id, ledger)
      patchLedger(id, { saveError: null })
      return null
    } catch (error) {
      const message = messageOf(error)
      patchLedger(id, { saveError: message })
      return message
    }
  }

  const writableLedger = (id: string): LedgerState => {
    checkLedgerId(id)
    if (deleting.has(id)) throw new Error(`Ledger ${id} is being deleted`)
    const ledger = ledgerOf(get().ledgers, id)
    if (!ledger) throw new Error(`Ledger ${id} is not loaded`)
    if (ledger.loadError !== null) {
      throw new Error(`Ledger ${id} was not changed because it could not be read: ${ledger.loadError}`)
    }
    return ledger
  }

  // The state is set before the first await; a failed write lands in saveError, not in a rejection
  const updateLedger = async (id: string, change: (ledger: LedgerState) => LedgerState): Promise<void> => {
    putLedger(id, change(writableLedger(id)))
    await persist(id)
  }

  // Reference data operations run one after the other: each reads the files the previous one wrote
  let referenceChain: Promise<unknown> = Promise.resolve()
  const inReferenceOrder = <T>(job: () => Promise<T>): Promise<T> => {
    const run = referenceChain.then(job, job)
    referenceChain = run.catch(() => undefined)
    return run
  }

  const readReference = async (): Promise<void> => {
    try {
      const accounts = (await readJson(ACCOUNTS_PATH, parseAccounts)) ?? []
      const categories = (await readJson(CATEGORIES_PATH, parseCategories)) ?? []
      set({ accounts, categories, referenceError: null })
    } catch (error) {
      set({ referenceError: messageOf(error) })
    }
  }

  // Reads the files first, so a write never rests on data that was not read, and a corrupt file stops it
  const readyReference = async (): Promise<void> => {
    await readReference()
    const { referenceError } = get()
    if (referenceError !== null) throw new Error(referenceError)
  }

  const writeAccounts = async (accounts: Account[]): Promise<void> => {
    const checked = parseAccounts(accounts)
    set({ accounts: checked })
    await writeJson(ACCOUNTS_PATH, checked)
  }

  const writeCategories = async (categories: CategoryNode[]): Promise<void> => {
    const checked = parseCategories(categories)
    set({ categories: checked })
    await writeJson(CATEGORIES_PATH, checked)
  }

  const isReadable = (id: string): boolean => ledgerOf(get().ledgers, id)?.loadError === null

  return {
    ledgers: {},
    accounts: [],
    categories: [],
    referenceError: null,

    loadReferenceData: () => inReferenceOrder(readReference),

    loadLedger: async (id) => {
      if (isReadable(id)) return
      const ledger = await readLedger(id)
      if (isReadable(id)) return
      if (ledger.loadError === null) requestedMeta.set(id, metaText(ledger.meta))
      else requestedMeta.delete(id)
      putLedger(id, ledger)
    },

    // The caller passes a fresh id: the disk is not checked, so a used id would be overwritten
    createLedger: async (id, name) => {
      checkLedgerId(id)
      if (ledgerOf(get().ledgers, id)) throw new Error(`Ledger ${id} already exists`)
      requestedMeta.delete(id)
      putLedger(id, {
        meta: { name, currencySymbol: DEFAULT_CURRENCY },
        entries: [],
        saveError: null,
        loadError: null
      })
      const failure = await persist(id)
      if (failure !== null) throw new Error(failure)
    },

    // Waits for queued writes first, so none can bring a removed file back
    deleteLedger: async (id) => {
      const csvPath = ledgerCsvPath(id)
      const metaPath = ledgerMetaPath(id)
      deleting.add(id)
      try {
        await flushWrites()
        await remove(csvPath)
        await remove(metaPath)
        requestedMeta.delete(id)
        set((state) => {
          const ledgers = { ...state.ledgers }
          delete ledgers[id]
          return { ledgers }
        })
      } finally {
        deleting.delete(id)
      }
    },

    listLedgers: async () => {
      const files = await list(LEDGERS_DIR)
      const ids = files.flatMap((file) => {
        const id = file.isDirectory ? null : ledgerIdOfMetaFile(file.name)
        return id === null ? [] : [id]
      })
      return Promise.all(ids.map(readLedgerName))
    },

    saveLedgerColumns: (id, columns) =>
      updateLedger(id, (ledger) => ({ ...ledger, meta: parseLedgerMeta({ ...ledger.meta, columns }) })),

    addEntry: (id, entry) => get().importEntries(id, [entry]),

    importEntries: (id, drafts) =>
      updateLedger(id, (ledger) => {
        const first = nextPos(ledger.entries)
        const added = drafts.map((draft, index) => ({ ...draft, id: newId(), pos: first + index }))
        return { ...ledger, entries: [...ledger.entries, ...added] }
      }),

    updateEntry: (id, entry) =>
      updateLedger(id, (ledger) => ({
        ...ledger,
        entries: ledger.entries.map((existing) => (existing.id === entry.id ? entry : existing))
      })),

    deleteEntry: (id, entryId) =>
      updateLedger(id, (ledger) => ({
        ...ledger,
        entries: ledger.entries.filter((entry) => entry.id !== entryId)
      })),

    ensureAccounts: (names) =>
      inReferenceOrder(async () => {
        await readyReference()
        const { accounts, ids } = mergeAccounts(get().accounts, names, newId)
        if (accounts !== get().accounts) await writeAccounts(accounts)
        return ids
      }),

    ensureCategories: (paths) =>
      inReferenceOrder(async () => {
        await readyReference()
        const categories = mergeCategoryPaths(get().categories, paths)
        if (categories !== get().categories) await writeCategories(categories)
      }),

    saveAccounts: (accounts) =>
      inReferenceOrder(async () => {
        await readyReference()
        await writeAccounts(accounts)
      }),

    saveCategories: (categories) =>
      inReferenceOrder(async () => {
        await readyReference()
        await writeCategories(categories)
      })
  }
})
