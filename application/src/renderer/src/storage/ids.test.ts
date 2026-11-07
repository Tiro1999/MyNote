import { describe, expect, it } from 'vitest'
import { ID_PATTERN, isValidId, newId } from './ids'

describe('isValidId', () => {
  it.each([
    ['V1StGXR8_Z5jdHi6B-myT', true],
    ['a'.repeat(64), true],
    ['', false],
    ['..', false],
    ['a/b', false],
    ['a\\b', false],
    ['a'.repeat(65), false],
    [42, false]
  ])('%j gives %s', (value, expected) => {
    expect(isValidId(value)).toBe(expected)
  })
})

describe('newId', () => {
  it('makes a new id each time that matches ID_PATTERN', () => {
    const first = newId()
    expect(first).toMatch(ID_PATTERN)
    expect(newId()).not.toBe(first)
  })
})
