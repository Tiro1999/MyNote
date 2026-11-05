import { isValidId, joinPath } from '@renderer/storage'

export const FINANCE_DIR = 'finance'
export const LEDGERS_DIR = joinPath(FINANCE_DIR, 'ledgers')
export const ACCOUNTS_PATH = joinPath(FINANCE_DIR, 'accounts.json')
export const CATEGORIES_PATH = joinPath(FINANCE_DIR, 'categories.json')

const META_SUFFIX = '.meta.json'

// A ledger id comes from page JSON, so it must pass here before it becomes part of a path
export function checkLedgerId(id: string): string {
  if (!isValidId(id)) throw new Error('Invalid ledger id: ' + id)
  return id
}

export const ledgerCsvPath = (id: string): string => joinPath(LEDGERS_DIR, `${checkLedgerId(id)}.csv`)

export const ledgerMetaPath = (id: string): string =>
  joinPath(LEDGERS_DIR, `${checkLedgerId(id)}${META_SUFFIX}`)

// null = not a meta file of a valid ledger id
export function ledgerIdOfMetaFile(fileName: string): string | null {
  if (!fileName.endsWith(META_SUFFIX)) return null
  const id = fileName.slice(0, -META_SUFFIX.length)
  return isValidId(id) ? id : null
}
