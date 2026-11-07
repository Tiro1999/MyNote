import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from './log'

describe('createLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('drops debug in release', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    createLogger('files', 'production').debug('x')
    expect(spy).not.toHaveBeenCalled()
  })

  it('keeps debug in experimental and development', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    createLogger('files', 'experimental').debug('x')
    createLogger('files', 'development').debug('y')
    expect(spy.mock.calls).toEqual([
      ['[files]', 'x'],
      ['[files]', 'y']
    ])
  })

  it('always logs warn with the module prefix', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createLogger('files', 'production').warn('w')
    expect(spy).toHaveBeenCalledWith('[files]', 'w')
  })
})
