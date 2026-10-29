import { describe, it, expect } from 'vitest'
import { formatNumber, formatDate, applyColumnFormat } from './format'

describe('formatNumber', () => {
  it('groups thousands and appends a currency symbol', () => {
    expect(
      formatNumber('1234.5', {
        decimals: 2,
        thousands: true,
        currencySymbol: '€',
        symbolPosition: 'after'
      })
    ).toBe('1.234,50 €')
  })
  it('honours no-grouping and a leading symbol, accepts comma decimals', () => {
    expect(
      formatNumber('1234,5', {
        decimals: 2,
        thousands: false,
        currencySymbol: '$',
        symbolPosition: 'before'
      })
    ).toBe('$ 1234,50')
  })
  it('passes non-numbers and empty strings through untouched', () => {
    const fmt = { decimals: 2, thousands: true, currencySymbol: '', symbolPosition: 'after' as const }
    expect(formatNumber('abc', fmt)).toBe('abc')
    expect(formatNumber('', fmt)).toBe('')
  })
})

describe('formatDate', () => {
  it('renders ISO dates in the chosen pattern', () => {
    expect(formatDate('2026-07-04', { pattern: 'dd.MM.yyyy' })).toBe('04.07.2026')
    expect(formatDate('2026-07-04', { pattern: 'dd.MM.yy' })).toBe('04.07.26')
    expect(formatDate('2026-07-04', { pattern: 'MM/dd/yyyy' })).toBe('07/04/2026')
  })
  it('passes non-ISO values through', () => {
    expect(formatDate('not-a-date', { pattern: 'dd.MM.yyyy' })).toBe('not-a-date')
  })
})

describe('applyColumnFormat', () => {
  it('formats by the column type, else returns raw', () => {
    expect(
      applyColumnFormat('5', {
        type: 'number',
        number: { decimals: 2, thousands: false, currencySymbol: '', symbolPosition: 'after' }
      })
    ).toBe('5,00')
    expect(applyColumnFormat('2026-07-04', { type: 'date', date: { pattern: 'dd.MM.yyyy' } })).toBe(
      '04.07.2026'
    )
    expect(applyColumnFormat('hello', { type: 'text' })).toBe('hello')
  })
})
