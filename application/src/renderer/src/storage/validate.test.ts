import { describe, expect, it } from 'vitest'
import { describeValue, isRecord } from './validate'

describe('isRecord', () => {
  it('accepts a plain object', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ id: 'nb1' })).toBe(true)
  })

  it.each([[null], [[]], [['nb1']], ['nb1'], [42], [true], [undefined]])('rejects %j', (value) => {
    expect(isRecord(value)).toBe(false)
  })
})

describe('describeValue', () => {
  it.each([
    ['x', '"x"'],
    [42, '42'],
    [null, 'null'],
    [{ text: 'Plan' }, '{"text":"Plan"}'],
    [undefined, 'undefined']
  ])('shows %j as %s', (value, text) => {
    expect(describeValue(value)).toBe(text)
  })

  it('cuts a value longer than 40 characters, so it cannot flood a message', () => {
    expect(describeValue('x'.repeat(500))).toBe(`"${'x'.repeat(39)}…`)
    expect(describeValue('x'.repeat(38))).toBe(`"${'x'.repeat(38)}"`)
  })
})
