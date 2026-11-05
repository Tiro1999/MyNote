import type { FileFilter } from '@shared/ipc'
import { parseLedgerCsv, serializeLedgerCsv } from '../ledgerCsv'
import type { LedgerImport } from '../ledgerCsv'
import { flattenCategories } from '../model'
import { ledgerOf, useFinanceStore } from '../store'
import type { LedgerState } from '../store'
import { exportFileName } from './exportFileName'
import { mapMoneyManager } from './moneyManager'

export interface TransferResult {
  imported: number
  skipped: number
  createdAccounts: number
  createdCategories: number
}

const CSV_FILTERS: FileFilter[] = [{ name: 'CSV', extensions: ['csv'] }]

const noneCreated = (imported: number, skipped: number): TransferResult => ({
  imported,
  skipped,
  createdAccounts: 0,
  createdCategories: 0
})

function readableLedger(ledgerId: string): LedgerState {
  const ledger = ledgerOf(useFinanceStore.getState().ledgers, ledgerId)
  if (!ledger) throw new Error(`Ledger ${ledgerId} is not loaded`)
  if (ledger.loadError !== null) throw new Error(`Ledger ${ledgerId} could not be read: ${ledger.loadError}`)
  return ledger
}

// The store reports a failed write in saveError and does not reject, so the outcome is read back
async function addEntries(ledgerId: string, entries: LedgerImport['entries']): Promise<void> {
  readableLedger(ledgerId)
  await useFinanceStore.getState().importEntries(ledgerId, entries)
  const { saveError } = readableLedger(ledgerId)
  if (saveError !== null) {
    throw new Error(
      `Entries were added but could not be saved (${saveError}). ` +
        'Do not import again: close the program that holds the file, then change any entry to save.'
    )
  }
}

function referenceKeys(): { accounts: string[]; categories: string[] } {
  const { accounts, categories } = useFinanceStore.getState()
  return { accounts: accounts.map((account) => account.id), categories: flattenCategories(categories) }
}

function countNew(before: string[], after: string[]): number {
  const known = new Set(before)
  return after.filter((key) => !known.has(key)).length
}

/** Imports a ledger CSV into the ledger; null = cancelled. Throws for a wrong file or a failed write. */
export async function importLedgerCsv(ledgerId: string): Promise<TransferResult | null> {
  const text = await window.api.files.importText(CSV_FILTERS)
  if (text === null) return null
  const { entries, skipped } = parseLedgerCsv(text)
  if (entries.length > 0) await addEntries(ledgerId, entries)
  return noneCreated(entries.length, skipped)
}

/** Imports a Money Manager sheet into the ledger and creates its accounts and categories; null = cancelled. */
export async function importMoneyManager(ledgerId: string): Promise<TransferResult | null> {
  const grid = await window.api.xlsx.importSheet()
  if (grid === null) return null
  const { entries, accountNames, categoryPaths, skipped } = mapMoneyManager(grid)
  if (entries.length === 0) return noneCreated(0, skipped)

  readableLedger(ledgerId)
  const { loadReferenceData, ensureAccounts, ensureCategories } = useFinanceStore.getState()
  await loadReferenceData()
  const before = referenceKeys()
  const accountIds = await ensureAccounts(accountNames)
  await ensureCategories(categoryPaths)
  const after = referenceKeys()
  await addEntries(
    ledgerId,
    entries.map(({ accountName, ...entry }) => ({ ...entry, accountId: accountIds.get(accountName) ?? '' }))
  )
  return {
    imported: entries.length,
    skipped,
    createdAccounts: countNew(before.accounts, after.accounts),
    createdCategories: countNew(before.categories, after.categories)
  }
}

/** Saves the ledger as CSV through the save dialog; false = cancelled. */
export async function exportLedgerCsv(ledgerId: string): Promise<boolean> {
  const { meta, entries } = readableLedger(ledgerId)
  return window.api.files.exportText(exportFileName(meta.name, ledgerId), CSV_FILTERS, serializeLedgerCsv(entries))
}
