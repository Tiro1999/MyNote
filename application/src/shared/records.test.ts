import { describe, expect, it } from 'vitest'
import { isRecord } from './records'

describe('isRecord', () => {
  it('is true for a plain object', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ a: 1 })).toBe(true)
  })

  it('is false for an array, null and every other type', () => {
    for (const value of [[], [1], null, undefined, 'x', 0, true, () => 0])
      expect(isRecord(value)).toBe(false)
  })
})
