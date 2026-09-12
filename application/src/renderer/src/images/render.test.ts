import { describe, it, expect, vi } from 'vitest'
import { resolveDisplayUrl, type RenderDeps } from './render'
import { RENDER_CACHE_THRESHOLD_BYTES, assetUrl, cacheFileName } from './source'

const SMALL = 1000
const LARGE = RENDER_CACHE_THRESHOLD_BYTES + 1

function deps(overrides: Partial<RenderDeps> = {}): RenderDeps {
  return {
    pageDir: '/nb/sec/page',
    cacheDir: '/cache',
    stat: async () => ({ size: SMALL, mtimeMs: 7 }),
    exists: async () => false,
    writeThumbnail: vi.fn(async () => {}),
    fetchRemote: async () => ({ path: '/cache/remote-abc.png' }),
    ...overrides
  }
}

describe('resolveDisplayUrl — local sources', () => {
  it('serves a small copy straight from the page folder', async () => {
    const result = await resolveDisplayUrl({ mode: 'copy', src: 'assets/x.webp' }, deps())
    expect(result).toEqual({ ok: true, url: assetUrl('/nb/sec/page/assets/x.webp') })
  })

  it('serves a small linked original directly, without touching the cache', async () => {
    const writeThumbnail = vi.fn(async () => {})
    const result = await resolveDisplayUrl(
      { mode: 'link', src: '/pictures/x.png' },
      deps({ writeThumbnail })
    )
    expect(result).toEqual({ ok: true, url: assetUrl('/pictures/x.png') })
    expect(writeThumbnail).not.toHaveBeenCalled()
  })

  it('reports a missing file instead of rendering a broken image', async () => {
    const result = await resolveDisplayUrl(
      { mode: 'link', src: '/gone/x.png' },
      deps({ stat: async () => null })
    )
    expect(result).toEqual({ ok: false, reason: 'missing', detail: '/gone/x.png' })
  })

  it('reuses an existing cache entry for a large source', async () => {
    const writeThumbnail = vi.fn(async () => {})
    const expected = `/cache/${cacheFileName('/pictures/big.png', 7, LARGE)}`
    const result = await resolveDisplayUrl(
      { mode: 'link', src: '/pictures/big.png' },
      deps({ stat: async () => ({ size: LARGE, mtimeMs: 7 }), exists: async () => true, writeThumbnail })
    )
    expect(result).toEqual({ ok: true, url: assetUrl(expected) })
    expect(writeThumbnail).not.toHaveBeenCalled()
  })

  it('builds a cache entry for a large source that has none yet', async () => {
    const writeThumbnail = vi.fn(async () => {})
    const expected = `/cache/${cacheFileName('/pictures/big.png', 7, LARGE)}`
    const result = await resolveDisplayUrl(
      { mode: 'link', src: '/pictures/big.png' },
      deps({ stat: async () => ({ size: LARGE, mtimeMs: 7 }), writeThumbnail })
    )
    expect(writeThumbnail).toHaveBeenCalledWith(assetUrl('/pictures/big.png'), expected)
    expect(result).toEqual({ ok: true, url: assetUrl(expected) })
  })

  it('falls back to the original when building the cache entry fails', async () => {
    const result = await resolveDisplayUrl(
      { mode: 'link', src: '/pictures/broken-encoder.png' },
      deps({
        stat: async () => ({ size: LARGE, mtimeMs: 7 }),
        writeThumbnail: async () => {
          throw new Error('encoder unavailable')
        }
      })
    )
    expect(result).toEqual({ ok: true, url: assetUrl('/pictures/broken-encoder.png') })
  })

  it('builds a cache entry only once when two nodes resolve the same source', async () => {
    const writeThumbnail = vi.fn(async () => {})
    const shared = deps({ stat: async () => ({ size: LARGE, mtimeMs: 99 }), writeThumbnail })
    const source = { mode: 'link', src: '/pictures/shared.png' } as const
    await Promise.all([resolveDisplayUrl(source, shared), resolveDisplayUrl(source, shared)])
    expect(writeThumbnail).toHaveBeenCalledTimes(1)
  })
})

describe('resolveDisplayUrl — remote sources', () => {
  it('renders a downloaded remote image from the cache', async () => {
    const result = await resolveDisplayUrl(
      { mode: 'url', src: 'https://e.com/a.png' },
      deps({ fetchRemote: async () => ({ path: '/cache/remote-abc.png' }) })
    )
    expect(result).toEqual({ ok: true, url: assetUrl('/cache/remote-abc.png') })
  })

  it('surfaces the download error', async () => {
    const result = await resolveDisplayUrl(
      { mode: 'url', src: 'https://e.com/a.png' },
      deps({ fetchRemote: async () => ({ error: 'Server antwortete mit 404.' }) })
    )
    expect(result).toEqual({ ok: false, reason: 'remote', detail: 'Server antwortete mit 404.' })
  })

  it('downscales a downloaded image that is too large to render directly', async () => {
    const writeThumbnail = vi.fn(async () => {})
    const expected = `/cache/${cacheFileName('/cache/remote-abc.png', 3, LARGE)}`
    const result = await resolveDisplayUrl(
      { mode: 'url', src: 'https://e.com/a.png' },
      deps({ stat: async () => ({ size: LARGE, mtimeMs: 3 }), writeThumbnail })
    )
    expect(result).toEqual({ ok: true, url: assetUrl(expected) })
  })
})
