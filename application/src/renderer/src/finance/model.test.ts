import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CURRENCY,
  LOCALE,
  MONEY_MANAGER,
  parseMoneyToCents,
  formatCents,
  normalizeAmount,
  isStringArray,
  parseTags,
  todayISO,
  flattenCategories,
  splitCategoryPath,
  cleanCategoryPath,
  categoryAtDepth
} from './model'

describe('constants', () => {
  it('defines the locale, the default currency and the Money Manager type words once', () => {
    expect(LOCALE).toBe('de-DE')
    expect(DEFAULT_CURRENCY).toBe('€')
    expect(MONEY_MANAGER).toEqual({ income: 'Einkommen', expense: 'Ausgabe' })
  })
})

describe('money', () => {
  it('parses dot and comma decimals to cents', () => {
    expect(parseMoneyToCents('12.34')).toBe(1234)
    expect(parseMoneyToCents('12,34')).toBe(1234)
    expect(parseMoneyToCents('-300')).toBe(-30000)
    expect(parseMoneyToCents('0')).toBe(0)
  })
  it('rounds to the nearest cent', () => {
    expect(parseMoneyToCents('1.005')).toBe(101)
  })
  it('returns 0 for unparsable text', () => {
    expect(parseMoneyToCents('abc')).toBe(0)
    expect(parseMoneyToCents('1.234,56')).toBe(0)
    expect(parseMoneyToCents('')).toBe(0)
  })
  it('formats cents with a symbol', () => {
    expect(formatCents(1234, '€')).toBe('12,34 €')
    expect(formatCents(-30000, '€')).toBe('-300,00 €')
  })
})

describe('normalizeAmount', () => {
  it('returns canonical dot-decimal text with two decimals', () => {
    expect(normalizeAmount('12,5', false)).toBe('12.50')
    expect(normalizeAmount('12.5', false)).toBe('12.50')
    expect(normalizeAmount('7', false)).toBe('7.00')
    expect(normalizeAmount('007', false)).toBe('7.00')
  })
  it('rounds half up on the decimal text', () => {
    expect(normalizeAmount('1.005', false)).toBe('1.01')
    expect(normalizeAmount('12.345', false)).toBe('12.35')
    expect(normalizeAmount('0.995', false)).toBe('1.00')
    expect(normalizeAmount('1.0049', false)).toBe('1.00')
  })
  it('never shows a float artefact', () => {
    expect(normalizeAmount('19.99', false)).toBe('19.99')
    expect(normalizeAmount('4.35', false)).toBe('4.35')
    expect(normalizeAmount('1.15', false)).toBe('1.15')
    expect(normalizeAmount('0.1', false)).toBe('0.10')
    expect(normalizeAmount('1234567.89', false)).toBe('1234567.89')
  })
  it('is idempotent on its own output', () => {
    expect(normalizeAmount(normalizeAmount('12,5', false) ?? '', false)).toBe('12.50')
    expect(normalizeAmount(normalizeAmount('-3', true) ?? '', true)).toBe('-3.00')
  })
  it('accepts a negative sign only when allowed', () => {
    expect(normalizeAmount('-3', true)).toBe('-3.00')
    expect(normalizeAmount('-1,005', true)).toBe('-1.01')
    expect(normalizeAmount('3', true)).toBe('3.00')
    expect(normalizeAmount('-3', false)).toBeNull()
  })
  it('accepts zero only when negatives are allowed', () => {
    expect(normalizeAmount('0', true)).toBe('0.00')
    expect(normalizeAmount('0', false)).toBeNull()
    expect(normalizeAmount('0.004', false)).toBeNull()
    expect(normalizeAmount('0.004', true)).toBe('0.00')
  })
  it('never produces -0.00', () => {
    expect(normalizeAmount('-0', true)).toBe('0.00')
    expect(normalizeAmount('-0,00', true)).toBe('0.00')
    expect(normalizeAmount('-0.004', true)).toBe('0.00')
  })
  it('trims the input and accepts a missing integer part', () => {
    expect(normalizeAmount(' 12,5 ', false)).toBe('12.50')
    expect(normalizeAmount('.5', false)).toBe('0.50')
    expect(normalizeAmount(',5', false)).toBe('0.50')
    expect(normalizeAmount('-.5', true)).toBe('-0.50')
  })
  it('rejects anything else', () => {
    for (const bad of ['-3', '0', '', 'abc', '1.234,56', '12,5,0']) {
      expect(normalizeAmount(bad, false)).toBeNull()
    }
    for (const bad of [
      '',
      ' ',
      '-',
      '5.',
      '5,',
      '.',
      ',',
      '--3',
      '- 3',
      '+3',
      '3-',
      '1 000',
      '1.234,56',
      '1,234.56',
      '1.2.3',
      '1,5.0',
      '1e3',
      '0x10',
      'Infinity',
      'NaN',
      '1_000',
      '١٢'
    ]) {
      expect(normalizeAmount(bad, true)).toBeNull()
    }
  })
  it('rejects amounts beyond the safe integer range of cents', () => {
    expect(normalizeAmount('99999999999999999999', false)).toBeNull()
    expect(normalizeAmount('90071992547409.91', false)).toBe('90071992547409.91')
    expect(normalizeAmount('90071992547409.92', false)).toBeNull()
    expect(normalizeAmount('-90071992547409.92', true)).toBeNull()
  })
})

describe('parseTags', () => {
  it('splits on comma and semicolon, trims and drops empties', () => {
    expect(parseTags(' a, b;;c ,')).toEqual(['a', 'b', 'c'])
    expect(parseTags('')).toEqual([])
    expect(parseTags(' , ; ')).toEqual([])
    expect(parseTags('one tag')).toEqual(['one tag'])
  })
})

describe('isStringArray', () => {
  it('accepts a list of strings, also an empty one', () => {
    expect(isStringArray([])).toBe(true)
    expect(isStringArray(['a', ''])).toBe(true)
  })

  it('refuses everything else', () => {
    for (const value of [undefined, null, 'a', 5, {}, { length: 0 }, ['a', 1], [null], [['a']]]) {
      expect(isStringArray(value)).toBe(false)
    }
  })
})

describe('todayISO', () => {
  it('uses the local date parts', () => {
    expect(todayISO(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01')
    expect(todayISO(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
    expect(todayISO(new Date(2026, 8, 5, 12))).toBe('2026-09-05')
  })
  it('defaults to now', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('category paths', () => {
  it('splits a path, empty string yields no segments', () => {
    expect(splitCategoryPath('Essen/Lebensmittel')).toEqual(['Essen', 'Lebensmittel'])
    expect(splitCategoryPath('')).toEqual([])
  })
  it('cleans a path: trims the segments and drops empty ones', () => {
    expect(cleanCategoryPath(' Food / Groceries ')).toBe('Food/Groceries')
    expect(cleanCategoryPath('a//b/')).toBe('a/b')
    expect(cleanCategoryPath('/C/')).toBe('C')
    expect(cleanCategoryPath('Essen/Lebensmittel')).toBe('Essen/Lebensmittel')
    expect(cleanCategoryPath('/')).toBe('')
    expect(cleanCategoryPath(' ')).toBe('')
    expect(cleanCategoryPath('')).toBe('')
  })
  it('returns the top-N-joined path at a given depth', () => {
    expect(categoryAtDepth('Essen/Lebensmittel/Supermarkt', 1)).toBe('Essen')
    expect(categoryAtDepth('Essen/Lebensmittel/Supermarkt', 2)).toBe('Essen/Lebensmittel')
    expect(categoryAtDepth('Essen', 3)).toBe('Essen')
    expect(categoryAtDepth('', 1)).toBe('')
  })
  it('flattens a tree into every path prefix', () => {
    expect(
      flattenCategories([{ name: 'Food', children: [{ name: 'Groceries', children: [] }] }])
    ).toEqual(['Food', 'Food/Groceries'])
    expect(flattenCategories([])).toEqual([])
  })
  it('lists siblings and deeper levels in tree order', () => {
    const tree = [
      { name: 'A', children: [{ name: 'B', children: [{ name: 'C', children: [] }] }] },
      { name: 'D', children: [] }
    ]
    expect(flattenCategories(tree)).toEqual(['A', 'A/B', 'A/B/C', 'D'])
  })
})
