import type { Entry, EntryType } from './model'

import { parseCsv, serializeCsv } from '../lib/csv'

// The CSV primitives moved to `lib/csv.ts` when the MTG module started sharing
// them; re-exported here so existing importers (and tests) keep working.
export { parseCsv, serializeCsv }

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
