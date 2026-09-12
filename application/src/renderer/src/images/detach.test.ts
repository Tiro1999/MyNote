import { describe, it, expect } from 'vitest'
import { placeDetachedImage } from './detach'

const host = { x: 100, y: 200, width: 320, height: 240 }

describe('placeDetachedImage', () => {
  it('places the image to the right of its host text box', () => {
    const element = placeDetachedImage(
      host,
      { mode: 'copy', src: 'assets/a.webp', alt: '', width: 400, naturalWidth: 800, naturalHeight: 400 },
      'NEW',
      5
    )
    expect(element.x).toBe(444)
    expect(element.y).toBe(200)
    expect(element.zIndex).toBe(5)
  })

  it('keeps the intrinsic aspect ratio', () => {
    const element = placeDetachedImage(
      host,
      { mode: 'copy', src: 'a', alt: '', width: 400, naturalWidth: 800, naturalHeight: 400 },
      'NEW',
      1
    )
    expect(element.width).toBe(400)
    expect(element.height).toBe(200)
  })

  it('falls back to the intrinsic width when none was chosen', () => {
    const element = placeDetachedImage(
      host,
      { mode: 'copy', src: 'a', alt: '', width: null, naturalWidth: 640, naturalHeight: 480 },
      'NEW',
      1
    )
    expect(element.width).toBe(640)
    expect(element.height).toBe(480)
  })

  it('uses a sane default when nothing about the size is known', () => {
    const element = placeDetachedImage(
      host,
      { mode: 'url', src: 'https://e/a.png', alt: '', width: null, naturalWidth: null, naturalHeight: null },
      'NEW',
      1
    )
    expect(element.width).toBe(320)
    expect(element.height).toBe(240)
  })

  it('clamps an absurdly wide image', () => {
    const element = placeDetachedImage(
      host,
      { mode: 'copy', src: 'a', alt: '', width: 9000, naturalWidth: 9000, naturalHeight: 9000 },
      'NEW',
      1
    )
    expect(element.width).toBe(1200)
  })

  it('carries the source over unchanged so no file is touched', () => {
    const element = placeDetachedImage(
      host,
      { mode: 'link', src: '/pictures/x.png', alt: 'Foto', width: null, naturalWidth: 100, naturalHeight: 100 },
      'NEW',
      1
    )
    expect(element).toMatchObject({ type: 'image', mode: 'link', src: '/pictures/x.png', alt: 'Foto' })
  })
})
