import { describe, it, expect } from 'vitest'
import { excelSerialToISO, mapMoneyManager } from './moneyManager'

describe('excelSerialToISO', () => {
  it('converts an Excel serial (with time fraction) to the calendar date', () => {
    expect(excelSerialToISO('45658.75')).toBe('2025-01-01')
    expect(excelSerialToISO(45658)).toBe('2025-01-01')
    expect(excelSerialToISO(' 45658 ')).toBe('2025-01-01')
    expect(excelSerialToISO('')).toBe('')
    expect(excelSerialToISO('abc')).toBe('')
  })

  it('accepts the first and the last serial that Excel can show', () => {
    expect(excelSerialToISO('1')).toBe('1899-12-31')
    expect(excelSerialToISO('2958465')).toBe('9999-12-31')
  })

  it.each(['1e3', '-5', '0', '0.5', '3000000', '2958466', '01.01.2025', '2025-01-01', '4.', '.5', '1,5', '0x10'])(
    'gives no date for the text %j',
    (text) => {
      expect(excelSerialToISO(text)).toBe('')
    }
  )

  it.each([NaN, Infinity, -1, 0, 3000000, 1e21])('gives no date for the number %s', (value) => {
    expect(excelSerialToISO(value)).toBe('')
  })
})

describe('mapMoneyManager', () => {
  const header = ['Datum', 'Konto', 'Kategorie', 'Unterkategorie', 'Notiz', 'EUR', 'Einnahmen/Ausgaben']
  // Fully fictional sample data — no real account, category or transaction values.
  const grid = [
    header,
    ['45658.5', 'Konto A', 'Freizeit', 'Kino', 'Beispiel 1', '5.0', 'Ausgabe'],
    ['45659.5', 'Konto B', 'Arbeit', 'Gehalt', 'Beispiel 2', '850.0', 'Einkommen'],
    ['45660.5', 'Konto A', 'Haushalt', '', 'Beispiel 3', '2.49', 'Ausgabe'],
    ['45661.5', 'Konto A', 'Umbuchung', '', 'Beispiel 4', '100.0', 'Ausgehender Transfer']
  ]
  const rowWith = (over: Record<number, string>): string[] => {
    const row = ['45658', 'Konto A', 'Freizeit', 'Kino', 'Beispiel', '5.0', 'Ausgabe']
    Object.entries(over).forEach(([index, value]) => (row[Number(index)] = value))
    return row
  }

  it('maps rows, joins category path, skips transfers', () => {
    const r = mapMoneyManager(grid)
    expect(r.skipped).toBe(1)
    expect(r.entries).toHaveLength(3)
    expect(r.entries[0]).toMatchObject({
      date: '2025-01-01',
      type: 'expense',
      amount: '5.00',
      categoryPath: 'Freizeit/Kino',
      topic: 'Beispiel 1',
      accountName: 'Konto A'
    })
    expect(r.entries[1].type).toBe('income')
    expect(r.entries[2].categoryPath).toBe('Haushalt') // empty subcategory → just the category
  })

  it('collects distinct account names and category paths', () => {
    const r = mapMoneyManager(grid)
    expect(r.accountNames.sort()).toEqual(['Konto A', 'Konto B'])
    expect(r.categoryPaths).toContain('Freizeit/Kino')
    expect(r.categoryPaths).toContain('Arbeit/Gehalt')
  })

  it('cleans a slash in a category name so it stays one level', () => {
    const r = mapMoneyManager([header, rowWith({ 2: ' Food/Drink ', 3: 'Café/Bar' })])
    expect(r.entries[0].categoryPath).toBe('Food Drink/Café Bar')
  })

  it('keeps a name of slashes from making an empty level', () => {
    const r = mapMoneyManager([header, rowWith({ 2: 'Food/', 3: '' }), rowWith({ 2: '/', 3: '' }), rowWith({ 2: '/', 3: 'Sub' })])
    expect(r.entries.map((e) => e.categoryPath)).toEqual(['Food', '', ''])
    expect(r.categoryPaths).toEqual(['Food'])
  })

  describe('header', () => {
    it('accepts another currency code in cell 5', () => {
      expect(mapMoneyManager([header.with(5, 'USD'), rowWith({})]).entries).toHaveLength(1)
    })

    it('accepts header cells with spaces around them', () => {
      expect(mapMoneyManager([header.map((cell) => ` ${cell} `), rowWith({})]).entries).toHaveLength(1)
    })

    it.each<[string, string[][]]>([
      ['an empty grid', []],
      ['an empty header', [[]]],
      ['a ledger CSV header', [['id', 'pos', 'date', 'type', 'amount', 'accountId', 'categoryPath']]],
      ['an English header', [['Date', 'Account', 'Category', 'Subcategory', 'Note', 'EUR', 'Income/Expense']]],
      ['no currency code', [header.with(5, ' ')]],
      ['a wrong type column', [header.with(6, 'Typ')]],
      ['a wrong first column', [header.with(0, 'Date')]],
      ['a short header', [header.slice(0, 6)]],
      ['data in place of the header', [rowWith({})]]
    ])('throws for %s', (_label, wrongGrid) => {
      expect(() => mapMoneyManager(wrongGrid)).toThrow('This is not a Money Manager export')
    })
  })

  describe('amounts', () => {
    it.each(['abc', '', ' ', '0', '-5.0', '1,234.50', '1e3', '5 EUR'])('skips the amount %j', (amount) => {
      const r = mapMoneyManager([header, rowWith({ 5: amount })])
      expect(r.entries).toEqual([])
      expect(r.skipped).toBe(1)
    })

    it.each([
      ['5.0', '5.00'],
      ['850', '850.00'],
      ['5,5', '5.50'],
      ['2.4900000000000002', '2.49']
    ])('writes the amount %j as %s', (amount, canonical) => {
      expect(mapMoneyManager([header, rowWith({ 5: amount })]).entries[0].amount).toBe(canonical)
    })

    it('does not collect the account or category of a skipped row', () => {
      const r = mapMoneyManager([header, rowWith({ 1: 'Lost', 2: 'Gone', 3: '', 5: 'abc' })])
      expect(r.accountNames).toEqual([])
      expect(r.categoryPaths).toEqual([])
    })
  })

  describe('dates', () => {
    it('turns a numeric serial into the date', () => {
      expect(mapMoneyManager([header, rowWith({ 0: '45658' })]).entries[0].date).toBe('2025-01-01')
    })

    it.each(['01.01.2025', '2025-01-01', '', 'abc', '1e5', '0'])('skips the date %j', (date) => {
      const r = mapMoneyManager([header, rowWith({ 0: date })])
      expect(r.entries).toEqual([])
      expect(r.skipped).toBe(1)
    })
  })

  it('gives an empty account name for a row without account', () => {
    const r = mapMoneyManager([header, rowWith({ 1: '  ' })])
    expect(r.entries[0].accountName).toBe('')
    expect(r.accountNames).toEqual([])
  })

  it('ignores blank rows without counting them', () => {
    const r = mapMoneyManager([header, [], rowWith({}), ['', ' '], rowWith({ 5: 'abc' })])
    expect(r.entries).toHaveLength(1)
    expect(r.skipped).toBe(1)
  })

  it('reads a grid that holds only the header as nothing to import', () => {
    expect(mapMoneyManager([header])).toEqual({ entries: [], accountNames: [], categoryPaths: [], skipped: 0 })
  })
})
