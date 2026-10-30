import { describe, expect, it } from 'vitest'
import { messageOf } from './errors'

describe('messageOf', () => {
  it('gives the message of an Error, also of a subclass', () => {
    expect(messageOf(new Error('EBUSY: resource busy or locked'))).toBe('EBUSY: resource busy or locked')
    expect(messageOf(new TypeError('x is not a function'))).toBe('x is not a function')
  })

  it('turns any other thrown value into text', () => {
    expect(messageOf('offline')).toBe('offline')
    expect(messageOf(42)).toBe('42')
    expect(messageOf(null)).toBe('null')
    expect(messageOf(undefined)).toBe('undefined')
  })
})
