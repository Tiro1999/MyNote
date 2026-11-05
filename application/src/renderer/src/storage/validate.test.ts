import { describe, expect, it } from 'vitest'
import { describeValue, fieldsOf, isRecord, textOf } from './validate'

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

describe('fieldsOf', () => {
  it('gives the record back', () => {
    const value = { id: 'nb1' }
    expect(fieldsOf(value, 'Notebook')).toBe(value)
  })

  it.each([[null], [[]], ['nb1'], [42], [undefined]])('rejects %j and names where it was found', (value) => {
    expect(() => fieldsOf(value, 'Each page')).toThrow(`Each page must be an object, got ${describeValue(value)}`)
  })
})

describe('textOf', () => {
  it('gives a string field back, empty or not', () => {
    expect(textOf({ name: 'Work', empty: '' }, 'name', 'Notebook "nb1"')).toBe('Work')
    expect(textOf({ empty: '' }, 'empty', 'Notebook "nb1"')).toBe('')
  })

  it.each([[{}], [{ name: 5 }], [{ name: null }], [{ name: ['a'] }]])('rejects %j and names key and place', (fields) => {
    expect(() => textOf(fields, 'name', 'Notebook "nb1"')).toThrow(/^Notebook "nb1": name must be a string, got /)
  })
})
