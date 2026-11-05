import { parseCsv, serializeCsv } from './csv'
import { cleanCategoryPath, normalizeAmount, parseTags } from './model'
import type { Entry, EntryType } from './model'

export const LEDGER_HEADER = [
  'id',
  'pos',
  'date',
  'type',
  'amount',
  'accountId',
  'categoryPath',
  'topic',
  'tags',
  'referenceLink'
]

const NOT_A_LEDGER_CSV = 'This is not a MyNote ledger CSV'
const BYTE_ORDER_MARK = /^\uFEFF/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ENTRY_TYPES: readonly EntryType[] = ['income', 'expense']

type EntryFields = Omit<Entry, 'id' | 'pos'>

export interface LedgerImport {
  entries: EntryFields[]
  skipped: number
}

// The cells of one ledger row as text, named by the header
interface RowText {
  id: string
  pos: string
  date: string
  type: string
  amount: string
  accountId: string
  categoryPath: string
  topic: string
  tags: string
  referenceLink: string
}

export function serializeLedgerCsv(entries: Entry[]): string {
  const rows = [LEDGER_HEADER]
  for (const e of entries) {
    rows.push([
      e.id,
      String(e.pos),
      e.date,
      e.type,
      e.amount,
      e.accountId,
      e.categoryPath,
      e.topic,
      e.tags.join(';'),
      e.referenceLink
    ])
  }
  return serializeCsv(rows)
}

const isBlankRow = (cells: string[]): boolean => cells.length === 1 && cells[0].trim() === ''

const readRows = (text: string): string[][] =>
  parseCsv(text.replace(BYTE_ORDER_MARK, '')).filter((cells) => !isBlankRow(cells))

// An empty file has no header, so it is no ledger file either
function readEntryRows(rows: string[][]): string[][] {
  const [header, ...entryRows] = rows
  const isLedgerHeader =
    header !== undefined &&
    header.length === LEDGER_HEADER.length &&
    LEDGER_HEADER.every((name, index) => header[index] === name)
  if (!isLedgerHeader) throw new Error(NOT_A_LEDGER_CSV)
  return entryRows
}

// null = the row does not have the 10 cells of the header
function readRow(cells: string[]): RowText | null {
  if (cells.length !== LEDGER_HEADER.length) return null
  const [id, pos, date, type, amount, accountId, categoryPath, topic, tags, referenceLink] = cells
  return { id, pos, date, type, amount, accountId, categoryPath, topic, tags, referenceLink }
}

// A stored ledger: values stay as stored (v0.1.x never normalized amounts) and no row is dropped
export function loadLedgerCsv(text: string): Entry[] {
  const rows = readRows(text)
  if (rows.length === 0) return []
  return readEntryRows(rows).map((cells, index) => {
    const row = readRow(cells)
    if (row === null) {
      throw new Error(`Entry row ${index + 1} has ${cells.length} cells, expected ${LEDGER_HEADER.length}`)
    }
    return {
      ...row,
      pos: Number(row.pos),
      type: row.type as EntryType,
      tags: row.tags === '' ? [] : row.tags.split(';')
    }
  })
}

function isCalendarDate(text: string): boolean {
  if (!ISO_DATE.test(text)) return false
  const date = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text)
}

function checkedEntry(row: RowText): EntryFields | null {
  const date = row.date.trim()
  const type = ENTRY_TYPES.find((candidate) => candidate === row.type.trim())
  const amount = normalizeAmount(row.amount, false)
  if (!isCalendarDate(date) || type === undefined || amount === null) return null
  return {
    date,
    type,
    amount,
    accountId: row.accountId,
    categoryPath: cleanCategoryPath(row.categoryPath),
    topic: row.topic,
    tags: parseTags(row.tags),
    referenceLink: row.referenceLink
  }
}

// A file the user picked: a wrong header throws, a bad row is counted as skipped
export function parseLedgerCsv(text: string): LedgerImport {
  const entries: EntryFields[] = []
  let skipped = 0
  for (const cells of readEntryRows(readRows(text))) {
    const row = readRow(cells)
    const entry = row === null ? null : checkedEntry(row)
    if (entry === null) skipped++
    else entries.push(entry)
  }
  return { entries, skipped }
}
