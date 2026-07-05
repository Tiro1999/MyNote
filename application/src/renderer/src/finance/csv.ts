import type { Entry, EntryType } from './model'

/** Parse RFC-4180 CSV text into a matrix of string cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  const pushField = (): void => {
    row.push(field)
    field = ''
  }
  const pushRow = (): void => {
    pushField()
    rows.push(row)
    row = []
  }

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      pushField()
      i++
      continue
    }
    if (ch === '\r') {
      i++
      continue
    }
    if (ch === '\n') {
      pushRow()
      i++
      continue
    }
    field += ch
    i++
  }
  // flush trailing field/row unless the text ended exactly on a newline
  if (field.length > 0 || row.length > 0) pushRow()
  return rows
}

function encodeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function serializeCsv(rows: string[][]): string {
  return rows.map((r) => r.map(encodeField).join(',')).join('\r\n')
}

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

export function parseLedgerCsv(text: string): Entry[] {
  const rows = parseCsv(text)
  if (rows.length <= 1) return []
  return rows.slice(1).map((cells) => ({
    id: cells[0] ?? '',
    pos: Number(cells[1] ?? '0'),
    date: cells[2] ?? '',
    type: (cells[3] as EntryType) ?? 'expense',
    amount: cells[4] ?? '0',
    accountId: cells[5] ?? '',
    categoryPath: cells[6] ?? '',
    topic: cells[7] ?? '',
    tags: (cells[8] ?? '').length > 0 ? (cells[8] as string).split(';') : [],
    referenceLink: cells[9] ?? ''
  }))
}
