import { afterEach, describe, expect, it, vi } from 'vitest'
import { onLinkOpenFailed } from './openFailed'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('onLinkOpenFailed', () => {
  it('passes each failed url to the callback and returns the unsubscribe function', () => {
    const unsubscribe = vi.fn()
    let listener: ((url: string) => void) | undefined
    vi.stubGlobal('window', {
      api: {
        links: {
          onOpenFailed: (callback: (url: string) => void) => {
            listener = callback
            return unsubscribe
          }
        }
      }
    })

    const seen: string[] = []
    const stop = onLinkOpenFailed((url) => seen.push(url))
    listener?.('https://example.com/a')
    listener?.('https://example.com/b')
    expect(seen).toEqual(['https://example.com/a', 'https://example.com/b'])

    expect(unsubscribe).not.toHaveBeenCalled()
    stop()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
