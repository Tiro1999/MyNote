import { describe, it, expect } from 'vitest'
import { parseCsv, serializeCsv, parseLedgerCsv, serializeLedgerCsv } from './csv'
import type { Entry } from './model'

describe('rfc-4180', () => {
  it('round-trips fields with commas, quotes and newlines', () => {
    const rows = [
      ['a', 'b,c', 'd"e'],
      ['line1\nline2', '', 'x']
    ]
    const text = serializeCsv(rows)
    expect(parseCsv(text)).toEqual(rows)
  })
})

describe('ledger csv', () => {
  const entry: Entry = {
    id: 'e1',
    pos: 1,
    date: '2026-06-01',
    type: 'expense',
    amount: '12.34',
    accountId: 'acc1',
    categoryPath: 'Essen/Lebensmittel',
    topic: 'Wocheneinkauf, groß',
    tags: ['Tax2026', 'Haushalt'],
    referenceLink: 'C:/inv/1.pdf'
  }

  it('round-trips an entry through header+row', () => {
    const text = serializeLedgerCsv([entry])
    const parsed = parseLedgerCsv(text)
    expect(parsed).toEqual([entry])
  })

  it('serializes tags as semicolon-joined', () => {
    const text = serializeLedgerCsv([entry])
    expect(text).toContain('Tax2026;Haushalt')
  })

  it('treats an empty/whitespace file as no entries', () => {
    expect(parseLedgerCsv('')).toEqual([])
    expect(parseLedgerCsv('\n')).toEqual([])
  })
})
