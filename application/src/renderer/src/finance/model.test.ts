import { describe, it, expect } from 'vitest'
import { parseMoneyToCents, formatCents, splitCategoryPath, categoryAtDepth } from './model'

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
  it('formats cents with a symbol', () => {
    expect(formatCents(1234, '€')).toBe('12,34 €')
    expect(formatCents(-30000, '€')).toBe('-300,00 €')
  })
})

describe('category paths', () => {
  it('splits a path, empty string yields no segments', () => {
    expect(splitCategoryPath('Essen/Lebensmittel')).toEqual(['Essen', 'Lebensmittel'])
    expect(splitCategoryPath('')).toEqual([])
  })
  it('returns the top-N-joined path at a given depth', () => {
    expect(categoryAtDepth('Essen/Lebensmittel/Supermarkt', 1)).toBe('Essen')
    expect(categoryAtDepth('Essen/Lebensmittel/Supermarkt', 2)).toBe('Essen/Lebensmittel')
    expect(categoryAtDepth('Essen', 3)).toBe('Essen')
    expect(categoryAtDepth('', 1)).toBe('')
  })
})
