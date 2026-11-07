import { describe, expect, it } from 'vitest'
import { serializeCsv } from './csv'
import { LEDGER_HEADER, loadLedgerCsv, parseLedgerCsv, serializeLedgerCsv } from './ledgerCsv'
import type { Entry } from './model'

const fields: Omit<Entry, 'id' | 'pos'> = {
  date: '2026-06-01',
  type: 'expense',
  amount: '12.34',
  accountId: 'acc1',
  categoryPath: 'Essen/Lebensmittel',
  topic: 'Wocheneinkauf, groß',
  tags: ['Tax2026', 'Haushalt'],
  referenceLink: 'C:/inv/1.pdf'
}

const entry: Entry = { id: 'e1', pos: 1, ...fields }

// One CSV row as cells, in header order; over replaces single cells by header name
function cells(over: Record<string, string> = {}): string[] {
  const base: Record<string, string> = {
    id: 'e1',
    pos: '1',
    date: '2026-06-01',
    type: 'expense',
    amount: '12.34',
    accountId: 'acc1',
    categoryPath: 'Food',
    topic: 'Lunch',
    tags: '',
    referenceLink: '',
    ...over
  }
  return LEDGER_HEADER.map((name) => base[name] ?? '')
}

const csvOf = (...rows: string[][]): string => serializeCsv([LEDGER_HEADER, ...rows])

describe('serializeLedgerCsv', () => {
  it('writes the header and joins tags with a semicolon', () => {
    const text = serializeLedgerCsv([entry])
    expect(text.split('\r\n')[0]).toBe('id,pos,date,type,amount,accountId,categoryPath,topic,tags,referenceLink')
    expect(text).toContain('Tax2026;Haushalt')
  })
})

describe('loadLedgerCsv', () => {
  it('round-trips the entries with their id and pos', () => {
    expect(loadLedgerCsv(serializeLedgerCsv([entry]))).toEqual([entry])
  })

  it('reads a file with a BOM, CRLF or LF line ends', () => {
    const text = serializeLedgerCsv([entry])
    expect(loadLedgerCsv(`\uFEFF${text}`)).toEqual([entry])
    expect(loadLedgerCsv(text.replaceAll('\r\n', '\n'))).toEqual([entry])
    expect(loadLedgerCsv(`${text}\r\n`)).toEqual([entry])
  })

  it.each(['', '\n', '\r\n\r\n', '   ', '\uFEFF'])('treats %j as an empty ledger', (text) => {
    expect(loadLedgerCsv(text)).toEqual([])
  })

  it('reads a header-only file as an empty ledger', () => {
    expect(loadLedgerCsv(csvOf())).toEqual([])
  })

  it('keeps every row and every value as stored (v0.1.x never normalized amounts)', () => {
    const loaded = loadLedgerCsv(
      csvOf(
        cells({ id: 'a', amount: '12,5' }),
        cells({ id: 'b', amount: '1.234,56' }),
        cells({ id: 'c', amount: 'abc', date: '01.01.2025', type: 'transfer' })
      )
    )
    expect(loaded.map((e) => e.amount)).toEqual(['12,5', '1.234,56', 'abc'])
    expect(loaded[2]).toMatchObject({ date: '01.01.2025', type: 'transfer' })
  })

  it('round-trips a topic with a line break, a quote and a comma inside a quoted field', () => {
    const tricky: Entry = { ...entry, topic: 'a\r\nb "q", c' }
    expect(loadLedgerCsv(serializeLedgerCsv([tricky, entry]))).toEqual([tricky, entry])
  })

  it('leaves a pos that is not a number as NaN', () => {
    const loaded = loadLedgerCsv(csvOf(cells({ id: 'a', pos: 'abc' }), cells({ id: 'b', pos: '2' })))
    expect(loaded[0].pos).toBeNaN()
    expect(loaded[1].pos).toBe(2)
  })

  it('splits tags on a semicolon and reads an empty cell as no tags', () => {
    const loaded = loadLedgerCsv(csvOf(cells({ tags: 'a;b' }), cells({ id: 'e2', tags: '' })))
    expect(loaded.map((e) => e.tags)).toEqual([['a', 'b'], []])
  })

  it('ignores blank lines between the rows', () => {
    expect(loadLedgerCsv(`${csvOf(cells({ id: 'a' }))}\r\n\r\n${serializeCsv([cells({ id: 'b' })])}\r\n`)).toHaveLength(2)
  })

  it.each([
    ['another header', 'name,value\r\nx,1'],
    ['a header with another name', serializeCsv([LEDGER_HEADER.map((name) => (name === 'tags' ? 'labels' : name)), cells()])],
    ['a header with a cell missing', serializeCsv([LEDGER_HEADER.slice(0, 9), cells()])],
    ['data without a header', serializeCsv([cells()])]
  ])('throws for %s', (_label, text) => {
    expect(() => loadLedgerCsv(text)).toThrow('This is not a MyNote ledger CSV')
  })

  it.each([
    ['fewer', cells().slice(0, 9)],
    ['more', [...cells(), 'x']]
  ])('throws for a row with %s than 10 cells, so the file is never rewritten', (_label, row) => {
    expect(() => loadLedgerCsv(csvOf(cells({ id: 'a' }), row))).toThrow('Entry row 2 has')
  })
})

describe('parseLedgerCsv', () => {
  it('round-trips the entries without id and pos, with a semicolon in the tags text', () => {
    const text = serializeLedgerCsv([entry])
    expect(text).toContain('Tax2026;Haushalt')
    expect(parseLedgerCsv(text)).toEqual({ entries: [fields], skipped: 0 })
  })

  it('reads a file with a BOM and CRLF', () => {
    expect(parseLedgerCsv(`\uFEFF${serializeLedgerCsv([entry])}\r\n`)).toEqual({ entries: [fields], skipped: 0 })
  })

  it('gives no id and no pos', () => {
    expect(Object.keys(parseLedgerCsv(csvOf(cells())).entries[0]).sort()).toEqual(
      ['accountId', 'amount', 'categoryPath', 'date', 'referenceLink', 'tags', 'topic', 'type'].sort()
    )
  })

  it.each([
    ['another header', 'a,b\r\n1,2'],
    ['no header', serializeCsv([cells()])],
    ['an empty file', ''],
    ['a blank file', '\r\n']
  ])('throws for %s', (_label, text) => {
    expect(() => parseLedgerCsv(text)).toThrow('This is not a MyNote ledger CSV')
  })

  it('reads a header-only file as nothing to import', () => {
    expect(parseLedgerCsv(csvOf())).toEqual({ entries: [], skipped: 0 })
  })

  it('counts one bad row as skipped and imports the others', () => {
    const result = parseLedgerCsv(csvOf(cells({ id: 'a' }), cells({ id: 'b', amount: 'abc' }), cells({ id: 'c' })))
    expect(result.entries).toHaveLength(2)
    expect(result.skipped).toBe(1)
  })

  it('ignores blank rows without counting them', () => {
    const text = `${csvOf(cells())}\r\n\r\n${serializeCsv([cells()])}\r\n\r\n`
    expect(parseLedgerCsv(text)).toMatchObject({ skipped: 0 })
    expect(parseLedgerCsv(text).entries).toHaveLength(2)
  })

  it('skips a row whose cell count is not 10', () => {
    const result = parseLedgerCsv(csvOf(cells().slice(0, 9), [...cells(), 'x'], cells()))
    expect(result.entries).toHaveLength(1)
    expect(result.skipped).toBe(2)
  })

  it.each(['2026-02-31', '2025-02-29', '2026-13-01', '2026-00-10', '01.01.2025', '2026-1-5', '2026-06-01T10:00', '', '12'])(
    'skips the date %j',
    (date) => {
      expect(parseLedgerCsv(csvOf(cells({ date })))).toEqual({ entries: [], skipped: 1 })
    }
  )

  it.each(['2024-02-29', '0001-01-01', '9999-12-31'])('accepts the date %s', (date) => {
    expect(parseLedgerCsv(csvOf(cells({ date }))).entries[0].date).toBe(date)
  })

  it.each(['transfer', 'Income', '', 'Ausgabe'])('skips the type %j', (type) => {
    expect(parseLedgerCsv(csvOf(cells({ type }))).skipped).toBe(1)
  })

  it('accepts both types', () => {
    const result = parseLedgerCsv(csvOf(cells({ type: 'income' }), cells({ type: 'expense' })))
    expect(result.entries.map((e) => e.type)).toEqual(['income', 'expense'])
  })

  it.each([
    ['12,5', '12.50'],
    ['12.5', '12.50'],
    [' 7 ', '7.00'],
    ['0.005', '0.01'],
    ['2.4900000000000002', '2.49']
  ])('writes the amount %j as %s', (amount, canonical) => {
    expect(parseLedgerCsv(csvOf(cells({ amount }))).entries[0].amount).toBe(canonical)
  })

  it.each(['abc', '', '0', '-5', '1.234,56', '1,2,3', '12 EUR'])('skips the amount %j', (amount) => {
    expect(parseLedgerCsv(csvOf(cells({ amount })))).toEqual({ entries: [], skipped: 1 })
  })

  it('cleans the category path', () => {
    const paths = [' Food / Groceries ', 'a//b/', '/', '', 'Food'].map(
      (categoryPath) => parseLedgerCsv(csvOf(cells({ categoryPath }))).entries[0].categoryPath
    )
    expect(paths).toEqual(['Food/Groceries', 'a/b', '', '', 'Food'])
  })

  it('reads tags split on a comma or a semicolon and trimmed', () => {
    expect(parseLedgerCsv(csvOf(cells({ tags: ' a, b;c ;; ' }))).entries[0].tags).toEqual(['a', 'b', 'c'])
  })

  it('keeps account id, topic and reference link as text and ignores a bad id or pos', () => {
    const result = parseLedgerCsv(
      csvOf(cells({ id: '', pos: 'abc', accountId: 'foreign', topic: ' keep, as typed ', referenceLink: 'C:/a b.pdf' }))
    )
    expect(result.entries[0]).toMatchObject({
      accountId: 'foreign',
      topic: ' keep, as typed ',
      referenceLink: 'C:/a b.pdf'
    })
    expect(result.skipped).toBe(0)
  })
})
