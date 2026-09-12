import { describe, it, expect } from 'vitest'
import {
  decodeAssetUrl,
  extensionForContentType,
  isAllowedRemoteUrl,
  remoteCacheFileName,
  remoteCacheFileNameFromUrl
} from './imageRules'

const assetUrlFor = (path: string): string => `asset://img/${encodeURIComponent(path)}`

describe('decodeAssetUrl', () => {
  it('decodes an absolute POSIX path', () => {
    expect(decodeAssetUrl(assetUrlFor('/home/u/a.png'))).toEqual({
      ok: true,
      filePath: '/home/u/a.png'
    })
  })

  it('canonicalises .. segments instead of serving them literally', () => {
    expect(decodeAssetUrl(assetUrlFor('/a/b/../c.png'))).toEqual({ ok: true, filePath: '/a/c.png' })
  })

  it('rejects a relative path', () => {
    expect(decodeAssetUrl(assetUrlFor('a/b.png')).ok).toBe(false)
  })

  it('rejects a file without an image extension', () => {
    expect(decodeAssetUrl(assetUrlFor('/etc/passwd')).ok).toBe(false)
  })

  it('rejects an executable disguised behind an image name', () => {
    expect(decodeAssetUrl(assetUrlFor('/tmp/a.png.exe')).ok).toBe(false)
  })

  it('rejects an empty path', () => {
    expect(decodeAssetUrl('asset://img/').ok).toBe(false)
  })

  it('rejects a malformed percent escape instead of throwing', () => {
    expect(decodeAssetUrl('asset://img/%E0%A4%A').ok).toBe(false)
  })

  it('accepts every extension the picker offers', () => {
    for (const extension of ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'avif']) {
      expect(decodeAssetUrl(assetUrlFor(`/a/b.${extension}`)).ok).toBe(true)
    }
  })

  it('accepts an uppercase extension', () => {
    expect(decodeAssetUrl(assetUrlFor('/a/B.PNG')).ok).toBe(true)
  })
})

describe('isAllowedRemoteUrl', () => {
  it('allows https and http', () => {
    expect(isAllowedRemoteUrl('https://example.com/a.png')).toBe(true)
    expect(isAllowedRemoteUrl('http://example.com/a.png')).toBe(true)
  })

  it('rejects other schemes', () => {
    expect(isAllowedRemoteUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedRemoteUrl('data:image/png;base64,AAAA')).toBe(false)
  })

  it('rejects unparseable input', () => {
    expect(isAllowedRemoteUrl('not a url')).toBe(false)
  })
})

describe('extensionForContentType', () => {
  it('maps image/jpeg to jpg', () => {
    expect(extensionForContentType('image/jpeg')).toBe('jpg')
  })

  it('ignores parameters and casing', () => {
    expect(extensionForContentType('Image/PNG; charset=utf-8')).toBe('png')
  })

  it('returns an empty string for a non-image type', () => {
    expect(extensionForContentType('text/html')).toBe('')
  })
})

describe('remoteCacheFileNameFromUrl', () => {
  it('derives the name from the URL when it carries an image extension', () => {
    expect(remoteCacheFileNameFromUrl('https://e.com/a/b.png?v=1')).toMatch(
      /^remote-[0-9a-f]{32}\.png$/
    )
  })

  it('has no name for a URL without a usable extension', () => {
    expect(remoteCacheFileNameFromUrl('https://e.com/render?id=7')).toBeNull()
  })

  it('is stable for the same URL and different per URL', () => {
    const first = remoteCacheFileNameFromUrl('https://e.com/a.png')
    expect(first).toBe(remoteCacheFileNameFromUrl('https://e.com/a.png'))
    expect(first).not.toBe(remoteCacheFileNameFromUrl('https://e.com/b.png'))
  })
})

describe('remoteCacheFileName', () => {
  it('prefers the extension from the URL', () => {
    expect(remoteCacheFileName('https://e.com/a.png', 'image/webp')).toMatch(/\.png$/)
  })

  it('falls back to the content type when the URL has none', () => {
    expect(remoteCacheFileName('https://e.com/render?id=7', 'image/webp')).toMatch(/\.webp$/)
  })
})
