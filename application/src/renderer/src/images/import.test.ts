import { describe, it, expect, vi } from 'vitest'
import { importImageAsCopy, importImageAsLink, type ImportDeps } from './import'

function deps(overrides: Partial<ImportDeps> = {}): ImportDeps {
  return {
    pickFile: async () => '/pictures/foto.jpg',
    stat: async () => ({ size: 5_000_000, mtimeMs: 1 }),
    copyFile: vi.fn(async () => {}),
    writeBinary: vi.fn(async () => {}),
    probe: async () => ({ width: 4000, height: 3000 }),
    encode: async () => new Uint8Array(300_000),
    assetDir: async () => '/nb/sec/page/assets',
    newId: () => 'ID1',
    ...overrides
  }
}

describe('importImageAsCopy', () => {
  it('returns null when the picker is cancelled', async () => {
    const writeBinary = vi.fn(async () => {})
    const result = await importImageAsCopy(deps({ pickFile: async () => null, writeBinary }))
    expect(result).toBeNull()
    expect(writeBinary).not.toHaveBeenCalled()
  })

  it('writes a downscaled webp and returns a page-relative reference', async () => {
    const writeBinary = vi.fn(async () => {})
    const result = await importImageAsCopy(deps({ writeBinary }))
    expect(writeBinary).toHaveBeenCalledWith(
      '/nb/sec/page/assets/ID1.webp',
      expect.any(Uint8Array)
    )
    expect(result).toEqual({
      mode: 'copy',
      src: 'assets/ID1.webp',
      alt: '',
      width: null,
      naturalWidth: 2000,
      naturalHeight: 1500
    })
  })

  it('copies a gif verbatim so the animation survives', async () => {
    const copyFile = vi.fn(async () => {})
    const encode = vi.fn(async () => new Uint8Array(10))
    const result = await importImageAsCopy(
      deps({ pickFile: async () => '/pictures/loop.gif', copyFile, encode })
    )
    expect(encode).not.toHaveBeenCalled()
    expect(copyFile).toHaveBeenCalledWith('/pictures/loop.gif', '/nb/sec/page/assets/ID1.gif')
    expect(result?.src).toBe('assets/ID1.gif')
    expect(result?.naturalWidth).toBe(4000)
  })

  it('copies an svg verbatim so the vector survives', async () => {
    const copyFile = vi.fn(async () => {})
    const result = await importImageAsCopy(
      deps({ pickFile: async () => '/pictures/logo.svg', copyFile })
    )
    expect(copyFile).toHaveBeenCalledWith('/pictures/logo.svg', '/nb/sec/page/assets/ID1.svg')
    expect(result?.src).toBe('assets/ID1.svg')
  })

  it('keeps the original when re-encoding would make the file bigger', async () => {
    const copyFile = vi.fn(async () => {})
    const writeBinary = vi.fn(async () => {})
    const result = await importImageAsCopy(
      deps({
        pickFile: async () => '/pictures/tiny.png',
        stat: async () => ({ size: 4_000, mtimeMs: 1 }),
        probe: async () => ({ width: 200, height: 100 }),
        encode: async () => new Uint8Array(9_000),
        copyFile,
        writeBinary
      })
    )
    expect(writeBinary).not.toHaveBeenCalled()
    expect(copyFile).toHaveBeenCalledWith('/pictures/tiny.png', '/nb/sec/page/assets/ID1.png')
    expect(result?.src).toBe('assets/ID1.png')
  })

  it('keeps the original when the encoder is unavailable', async () => {
    const copyFile = vi.fn(async () => {})
    const result = await importImageAsCopy(
      deps({ pickFile: async () => '/pictures/a.png', encode: async () => null, copyFile })
    )
    expect(copyFile).toHaveBeenCalledWith('/pictures/a.png', '/nb/sec/page/assets/ID1.png')
    expect(result?.src).toBe('assets/ID1.png')
  })

  it('does not upscale a small image', async () => {
    const result = await importImageAsCopy(
      deps({ probe: async () => ({ width: 640, height: 480 }) })
    )
    expect(result?.naturalWidth).toBe(640)
    expect(result?.naturalHeight).toBe(480)
  })
})

describe('importImageAsLink', () => {
  it('stores the absolute original path and copies nothing', async () => {
    const copyFile = vi.fn(async () => {})
    const writeBinary = vi.fn(async () => {})
    const result = await importImageAsLink(deps({ copyFile, writeBinary }))
    expect(copyFile).not.toHaveBeenCalled()
    expect(writeBinary).not.toHaveBeenCalled()
    expect(result).toEqual({
      mode: 'link',
      src: '/pictures/foto.jpg',
      alt: '',
      width: null,
      naturalWidth: 4000,
      naturalHeight: 3000
    })
  })

  it('returns null when the picker is cancelled', async () => {
    expect(await importImageAsLink(deps({ pickFile: async () => null }))).toBeNull()
  })
})
