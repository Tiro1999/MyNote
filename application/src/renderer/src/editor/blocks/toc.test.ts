import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it, vi } from 'vitest'
import { headingEntries, headingLinks, sameHeadings, tocSlashItem } from './toc'

const schema = getSchema([StarterKit])

const heading = (level: number, text?: string): object => ({
  type: 'heading',
  attrs: { level },
  ...(text ? { content: [{ type: 'text', text }] } : {})
})
const doc = (...content: object[]): ReturnType<typeof schema.nodeFromJSON> =>
  schema.nodeFromJSON({ type: 'doc', content })

describe('headingEntries', () => {
  it('lists the headings in document order, including nested ones', () => {
    const entries = headingEntries(
      doc(
        heading(1, 'Intro'),
        { type: 'paragraph', content: [{ type: 'text', text: 'body' }] },
        { type: 'blockquote', content: [heading(3, 'Quoted')] },
        heading(2)
      )
    )
    expect(entries).toEqual([
      { level: 1, text: 'Intro' },
      { level: 3, text: 'Quoted' },
      { level: 2, text: '' }
    ])
  })

  it('finds no heading in a document without one', () => {
    expect(headingEntries(doc({ type: 'paragraph' }))).toEqual([])
  })
})

describe('sameHeadings', () => {
  const a = [{ level: 1, text: 'A' }]

  it('is true for equal lists, also when the document around them changed', () => {
    expect(sameHeadings(a, [{ level: 1, text: 'A' }])).toBe(true)
    expect(sameHeadings([], [])).toBe(true)
  })

  it('is false when a level, a text or the count differs', () => {
    expect(sameHeadings(a, [{ level: 2, text: 'A' }])).toBe(false)
    expect(sameHeadings(a, [{ level: 1, text: 'B' }])).toBe(false)
    expect(sameHeadings(a, [])).toBe(false)
    expect(sameHeadings(a, [...a, { level: 1, text: 'C' }])).toBe(false)
  })
})

describe('headingLinks', () => {
  it('indents relative to the highest level present', () => {
    const links = headingLinks(
      [
        { level: 2, text: 'A' },
        { level: 3, text: 'B' },
        { level: 4, text: 'C' },
        { level: 2, text: 'D' }
      ],
      vi.fn()
    )
    expect(links.map((link) => link.depth)).toEqual([0, 1, 2, 0])
    expect(links.map((link) => link.label)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('reports the index of the clicked heading', () => {
    const onSelect = vi.fn()
    const links = headingLinks([{ level: 1, text: 'A' }, { level: 1, text: 'B' }], onSelect)
    links[1].onClick()
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('returns nothing for no headings', () => {
    expect(headingLinks([], vi.fn())).toEqual([])
  })
})

describe('tocSlashItem', () => {
  it('says that it covers this text box', () => {
    expect(tocSlashItem.description).toContain('this text box')
  })
})
