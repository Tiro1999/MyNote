import { describe, expect, it } from 'vitest'
import { emptyContent, isTextBox, parsePageContent } from './model'

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
})

describe('emptyContent', () => {
  it('has no elements and carries the content id', () => {
    expect(emptyContent('s1')).toEqual({ pageId: 's1', elements: [] })
  })
})
