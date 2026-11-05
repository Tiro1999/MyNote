import { MONEY_MANAGER, cleanCategoryPath, normalizeAmount } from '../model'
import type { Entry, EntryType } from '../model'

/** An entry whose account is still a name (not yet resolved to an id). */
export type NamedEntry = Omit<Entry, 'id' | 'pos' | 'accountId'> & { accountName: string }

export interface MoneyManagerImport {
  entries: NamedEntry[]
  accountNames: string[]
  categoryPaths: string[]
  skipped: number
}

// Cell positions of a Money Manager row
const COLUMN = { date: 0, account: 1, category: 2, subcategory: 3, note: 4, amount: 5, type: 6 } as const

// Header words of the export; data of that file, not UI text. The amount header is the currency code.
const HEADER_WORDS = ['Datum', 'Konto', 'Kategorie', 'Unterkategorie', 'Notiz']
const TYPE_HEADER = 'Einnahmen/Ausgaben'

const NOT_A_MONEY_MANAGER_EXPORT = 'This is not a Money Manager export'
const SERIAL_PATTERN = /^\d+(\.\d+)?$/
const FIRST_SERIAL = 1
const LAST_SERIAL = 2958465 // 9999-12-31

// Days from the Excel epoch (1899-12-30) to 1970-01-01
const EPOCH_OFFSET_DAYS = 25569
const MS_PER_DAY = 86400000

/** Excel serial date (numeric only, time fraction ignored) as `YYYY-MM-DD`; '' = not a serial date. */
export function excelSerialToISO(serial: string | number): string {
  const text = typeof serial === 'number' ? String(serial) : serial.trim()
  if (!SERIAL_PATTERN.test(text)) return ''
  const day = Math.floor(Number(text))
  if (day < FIRST_SERIAL || day > LAST_SERIAL) return ''
  return new Date((day - EPOCH_OFFSET_DAYS) * MS_PER_DAY).toISOString().slice(0, 10)
}

// A slash inside a name would split it into levels; the trim comes last, so a name of slashes ends empty
const cleanName = (s: string | undefined): string => (s ?? '').replace(/\//g, ' ').trim()

function isHeader(row: string[] | undefined): boolean {
  if (row === undefined) return false
  const cell = (index: number): string => (row[index] ?? '').trim()
  return (
    HEADER_WORDS.every((word, index) => cell(index) === word) &&
    cell(COLUMN.amount) !== '' &&
    cell(COLUMN.type) === TYPE_HEADER
  )
}

const isBlank = (row: string[]): boolean => row.every((cell) => cell.trim() === '')

function entryType(word: string): EntryType | null {
  if (word === MONEY_MANAGER.income) return 'income'
  if (word === MONEY_MANAGER.expense) return 'expense'
  return null
}

/** Map a Money Manager .xlsx grid (header first) to entries; transfers and invalid rows are skipped. */
export function mapMoneyManager(grid: string[][]): MoneyManagerImport {
  if (!isHeader(grid[0])) throw new Error(NOT_A_MONEY_MANAGER_EXPORT)
  const entries: NamedEntry[] = []
  const accountNames = new Set<string>()
  const categoryPaths = new Set<string>()
  let skipped = 0

  for (const row of grid.slice(1)) {
    if (isBlank(row)) continue
    const type = entryType((row[COLUMN.type] ?? '').trim())
    const date = excelSerialToISO(row[COLUMN.date] ?? '')
    const amount = normalizeAmount(row[COLUMN.amount] ?? '', false)
    if (type === null || date === '' || amount === null) {
      skipped++
      continue
    }

    const accountName = (row[COLUMN.account] ?? '').trim()
    const category = cleanName(row[COLUMN.category])
    const categoryPath = category ? cleanCategoryPath(`${category}/${cleanName(row[COLUMN.subcategory])}`) : ''

    if (accountName) accountNames.add(accountName)
    if (categoryPath) categoryPaths.add(categoryPath)

    entries.push({
      date,
      type,
      amount,
      categoryPath,
      topic: (row[COLUMN.note] ?? '').trim(),
      tags: [],
      referenceLink: '',
      accountName
    })
  }

  return {
    entries,
    accountNames: [...accountNames],
    categoryPaths: [...categoryPaths],
    skipped
  }
}
