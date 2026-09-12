import { describe, it, expect } from 'vitest'
import {
  RENDER_CACHE_THRESHOLD_BYTES,
  assetUrl,
  cacheFileName,
  extensionOf,
  fitWithin,
  isReencodable,
  needsRenderCache,
  resolveStoredPath
} from './source'

describe('extensionOf', () => {
  it('returns the lowercased extension without the dot', () => {
    expect(extensionOf('/home/u/Foto.PNG')).toBe('png')
  })

  it('strips query string and fragment from a URL', () => {
    expect(extensionOf('https://example.com/a/b.jpg?v=2#top')).toBe('jpg')
  })

  it('returns an empty string when there is no extension', () => {
    expect(extensionOf('/home/u/README')).toBe('')
  })

  it('ignores dots that belong to a parent directory', () => {
    expect(extensionOf('/home/my.photos/file')).toBe('')
  })

  it('does not mistake a dotfile for an extension', () => {
    expect(extensionOf('/home/u/.gitignore')).toBe('')
  })
})

describe('isReencodable', () => {
  it('refuses gif so animation survives', () => {
    expect(isReencodable('gif')).toBe(false)
  })

  it('refuses svg so the vector survives, case-insensitively', () => {
    expect(isReencodable('SVG')).toBe(false)
  })

  it('allows raster formats', () => {
    for (const extension of ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'avif']) {
      expect(isReencodable(extension)).toBe(true)
    }
  })
})

describe('fitWithin', () => {
  it('never upscales an image that already fits', () => {
    expect(fitWithin(800, 600, 2000)).toEqual({ width: 800, height: 600 })
  })

  it('leaves an image at exactly the limit untouched', () => {
    expect(fitWithin(2000, 1000, 2000)).toEqual({ width: 2000, height: 1000 })
  })

  it('scales a landscape image by its long edge', () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 })
  })

  it('scales a portrait image by its long edge', () => {
    expect(fitWithin(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 })
  })

  it('rounds to whole pixels', () => {
    expect(fitWithin(3333, 2222, 2000)).toEqual({ width: 2000, height: 1333 })
  })

  it('never collapses an extreme aspect ratio to zero', () => {
    expect(fitWithin(10000, 3, 2000).height).toBe(1)
  })
})

describe('needsRenderCache', () => {
  it('leaves a file at exactly the threshold alone', () => {
    expect(needsRenderCache(RENDER_CACHE_THRESHOLD_BYTES)).toBe(false)
  })

  it('caches one byte above the threshold', () => {
    expect(needsRenderCache(RENDER_CACHE_THRESHOLD_BYTES + 1)).toBe(true)
  })
})

describe('assetUrl', () => {
  it('percent-encodes a POSIX path into the URL path', () => {
    expect(assetUrl('/home/u/a b.png')).toBe('asset://img/%2Fhome%2Fu%2Fa%20b.png')
  })

  it('encodes Windows separators and the drive colon', () => {
    expect(assetUrl('C:\\Users\\u\\a.png')).toBe('asset://img/C%3A%5CUsers%5Cu%5Ca.png')
  })

  it('survives a round trip through URL parsing, including non-ASCII names', () => {
    const path = '/home/u/Ünterlagen/Grüße.png'
    const parsed = new URL(assetUrl(path))
    expect(decodeURIComponent(parsed.pathname.slice(1))).toBe(path)
  })
})

describe('cacheFileName', () => {
  it('is stable for an unchanged file', () => {
    expect(cacheFileName('/a/b.png', 42, 100)).toBe(cacheFileName('/a/b.png', 42, 100))
  })

  it('changes when the file is modified', () => {
    expect(cacheFileName('/a/b.png', 42, 100)).not.toBe(cacheFileName('/a/b.png', 43, 100))
  })

  it('changes when the size changes', () => {
    expect(cacheFileName('/a/b.png', 42, 100)).not.toBe(cacheFileName('/a/b.png', 42, 101))
  })

  it('changes for a different path', () => {
    expect(cacheFileName('/a/b.png', 42, 100)).not.toBe(cacheFileName('/a/c.png', 42, 100))
  })

  it('produces a prefixed webp name', () => {
    expect(cacheFileName('/a/b.png', 1, 2)).toMatch(/^thumb-[0-9a-f]{16}\.webp$/)
  })
})

describe('resolveStoredPath', () => {
  it('joins a copy against the page folder', () => {
    expect(resolveStoredPath({ mode: 'copy', src: 'assets/x.webp' }, '/nb/sec/page')).toBe(
      '/nb/sec/page/assets/x.webp'
    )
  })

  it('uses a link path as it is', () => {
    expect(resolveStoredPath({ mode: 'link', src: '/pictures/x.png' }, '/nb/sec/page')).toBe(
      '/pictures/x.png'
    )
  })

  it('has no local path for a remote source', () => {
    expect(resolveStoredPath({ mode: 'url', src: 'https://e/x.png' }, '/nb/sec/page')).toBeNull()
  })
})
