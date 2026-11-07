import { describe, expect, it } from 'vitest'
import { isValidId } from '@renderer/storage'
import { emptyContent, isTextBox, newTextBox, parsePageContent } from './model'

const box = {
  id: 'b1',
  type: 'textbox',
  x: 40,
  y: 60,
  width: 320,
  height: 200,
  zIndex: 1,
  content: { type: 'doc', content: [{ type: 'paragraph' }] }
}

// Written by the image branch, which this version does not render
const image = {
  id: 'i1',
  type: 'image',
  x: 400,
  y: 60,
  width: 120,
  height: 80,
  zIndex: 2,
  assetPath: 'photo.png',
  alt: 'Photo'
}

describe('parsePageContent', () => {
  it('keeps an image element next to a text box', () => {
    const content = parsePageContent({ pageId: 'p1', elements: [image, box] }, 'p1')
    expect(content).toEqual({ pageId: 'p1', elements: [image, box] })
    expect(content.elements.map(isTextBox)).toEqual([false, true])
  })

  it('keeps an extra field on the page and on a text box', () => {
    const raw = { pageId: 'p1', background: 'grid', elements: [{ ...box, locked: true }] }
    expect(parsePageContent(raw, 'p1')).toEqual(raw)
  })

  it('gives an empty list for missing elements', () => {
    expect(parsePageContent({ pageId: 'p1' }, 'p1')).toEqual({ pageId: 'p1', elements: [] })
  })

  it('backfills a missing pageId with the given id and keeps a stored one', () => {
    expect(parsePageContent({ elements: [box] }, 's1')).toEqual({ pageId: 's1', elements: [box] })
    expect(parsePageContent({ pageId: 'old', elements: [] }, 'p1').pageId).toBe('old')
  })

  it.each([
    ['elements that are not a list', { pageId: 'p1', elements: 'x' }, 'elements must be an array, got "x"'],
    ['a pageId that is not a string', { pageId: 7, elements: [] }, 'pageId must be a string, got 7'],
    ['a page that is not an object', ['b1'], 'Page content must be an object'],
    ['an element that is not an object', { elements: [5] }, 'Each canvas element must be an object, got 5'],
    ['an element without an id', { elements: [{ type: 'image' }] }, 'id must be a string'],
    ['an element without a type', { elements: [{ id: 'e1' }] }, 'Element "e1": type must be a string'],
    ['a text box with a text x', { elements: [{ ...box, x: '40' }] }, 'Text box "b1": x must be a number'],
    ['a text box without zIndex', { elements: [{ ...box, zIndex: undefined }] }, 'zIndex must be a number'],
    ['a text box whose content is text', { elements: [{ ...box, content: 'hi' }] }, 'content must be an object'],
    ['a text box whose content is a list', { elements: [{ ...box, content: [] }] }, 'content must be an object']
  ])('throws for %s', (_case, raw, message) => {
    expect(() => parsePageContent(raw, 'p1')).toThrow(message)
  })

  it.each(['x', 'y', 'width', 'height', 'zIndex'])('rejects an infinite %s', (key) => {
    const raw = JSON.parse(JSON.stringify({ pageId: 'p1', elements: [box] }).replace(`"${key}":`, `"${key}":1e999,"_":`))
    expect(raw.elements[0][key]).toBe(Infinity)
    expect(() => parsePageContent(raw, 'p1')).toThrow(`Text box "b1": ${key} must be a number, got Infinity`)
  })

  it.each([NaN, -Infinity])('rejects %s as a number', (value) => {
    expect(() => parsePageContent({ elements: [{ ...box, x: value }] }, 'p1')).toThrow('x must be a number')
  })

  it('still accepts zero and negative numbers', () => {
    const parsed = parsePageContent({ elements: [{ ...box, x: 0, y: -40, zIndex: 0 }] }, 'p1')
    expect(parsed.elements[0]).toMatchObject({ x: 0, y: -40, zIndex: 0 })
  })
})

describe('emptyContent', () => {
  it('has no elements and carries the content id', () => {
    expect(emptyContent('s1')).toEqual({ pageId: 's1', elements: [] })
  })
})

describe('newTextBox', () => {
  it('is an empty box of the usual size at the point', () => {
    expect(newTextBox({ x: 12, y: 34 }, 7)).toMatchObject({
      type: 'textbox',
      x: 12,
      y: 34,
      width: 320,
      height: 200,
      zIndex: 7,
      content: { type: 'doc', content: [{ type: 'paragraph' }] }
    })
  })

  it('gets its own valid id and its own content object', () => {
    const first = newTextBox({ x: 0, y: 0 }, 1)
    const second = newTextBox({ x: 0, y: 0 }, 1)
    expect(isValidId(first.id)).toBe(true)
    expect(first.id).not.toBe(second.id)
    expect(first.content).not.toBe(second.content)
  })

  it('is read back unchanged by parsePageContent', () => {
    const created = newTextBox({ x: 5, y: 6 }, 2)
    expect(parsePageContent({ pageId: 'p1', elements: [created] }, 'p1').elements).toEqual([created])
  })
})
