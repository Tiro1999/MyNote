import { createNodeFromContent, getSchema, type JSONContent } from '@tiptap/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildExtensions } from '@renderer/editor'
import { editorFeatures } from './editorFeatures'

const schema = getSchema(buildExtensions(editorFeatures))

function load(json: JSONContent): JSONContent {
  return createNodeFromContent(json, schema, { errorOnInvalidContent: true }).toJSON()
}

type Mark = { type: string; attrs?: Record<string, unknown> }
type Attrs = Record<string, unknown>

// Documents are written the way getJSON() persists them (default attributes filled, marks in schema order)
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })
const text = (value: string, ...marks: Mark[]): JSONContent =>
  marks.length > 0 ? { type: 'text', text: value, marks } : { type: 'text', text: value }
const node = (type: string, attrs?: Attrs, ...content: JSONContent[]): JSONContent => ({
  type,
  ...(attrs ? { attrs } : {}),
  ...(content.length > 0 ? { content } : {})
})
const paragraph = (...content: JSONContent[]): JSONContent =>
  node('paragraph', { textAlign: null }, ...content)
const heading = (level: number, ...content: JSONContent[]): JSONContent =>
  node('heading', { level, textAlign: null }, ...content)
const cell = (
  type: 'tableCell' | 'tableHeader',
  value: string,
  attrs: Attrs = {}
): JSONContent =>
  node(type, { colspan: 1, rowspan: 1, colwidth: null, align: null, ...attrs }, paragraph(text(value)))
const link = (attrs: Attrs = {}): Mark => ({
  type: 'link',
  attrs: {
    href: 'https://example.com',
    target: '_blank',
    rel: 'noopener noreferrer nofollow',
    class: null,
    title: null,
    ...attrs
  }
})

const ledger = node('financeLedger', { ledgerId: 'ledger-1' })
const stats = node('financeStats', {
  ledgerId: 'ledger-1',
  mode: 'category',
  from: '2026-01-01',
  to: '2026-03-31',
  categoryFocus: 'Food',
  tagFilter: ['weekly', 'shared']
})
const templateLink = (kind: string): JSONContent =>
  node('templateLink', { kind, targetId: 'target-1', label: 'Other' })
const pageHierarchy = (kind: string): JSONContent =>
  node('pageHierarchyBlock', { kind, targetId: 'target-1' })
const headingWithLegacyId = node(
  'heading',
  { level: 2, textAlign: null, id: 'h-legacy' },
  text('Two')
)

const fixtures: Record<string, JSONContent> = {
  'bold, italic, underline, strike and a link': doc(
    paragraph(
      text('bold', { type: 'bold' }),
      text('italic', { type: 'italic' }),
      text('underline', { type: 'underline' }),
      text('strike', { type: 'strike' }),
      text('link', link())
    )
  ),
  'a link with target and rel': doc(
    paragraph(text('link', link({ target: '_self', rel: 'noopener', class: 'external' })))
  ),
  'the code mark': doc(paragraph(text('const a = 1', { type: 'code' }))),
  'a text node with several marks': doc(
    paragraph(text('all', link(), { type: 'bold' }, { type: 'italic' }, { type: 'underline' }))
  ),
  'text alignment on a paragraph and a heading': doc(
    node('paragraph', { textAlign: 'center' }, text('centered')),
    node('heading', { level: 2, textAlign: 'right' }, text('right'))
  ),
  'headings 1 to 6': doc(
    ...[1, 2, 3, 4, 5, 6].map((level) => heading(level, text(`Heading ${level}`)))
  ),
  'bullet and ordered lists': doc(
    node('bulletList', undefined, node('listItem', undefined, paragraph(text('a')))),
    node('orderedList', { start: 3, type: null }, node('listItem', undefined, paragraph(text('b'))))
  ),
  'a code block with a language': doc(
    node('codeBlock', { language: 'typescript' }, text('let a = 1'))
  ),
  'a blockquote': doc(node('blockquote', undefined, paragraph(text('quoted')))),
  'a horizontal rule': doc(paragraph(text('above')), node('horizontalRule')),
  'a hard break': doc(paragraph(text('a'), node('hardBreak'), text('b'))),
  'a table with a header row': doc(
    node(
      'table',
      undefined,
      node('tableRow', undefined, cell('tableHeader', 'h1'), cell('tableHeader', 'h2')),
      node('tableRow', undefined, cell('tableCell', 'c1'), cell('tableCell', 'c2'))
    )
  ),
  'a table cell with colspan, rowspan and colwidth': doc(
    node(
      'table',
      undefined,
      node(
        'tableRow',
        undefined,
        cell('tableCell', 'wide', { colspan: 2, rowspan: 2, colwidth: [120, 80] })
      )
    )
  ),
  'a callout of every variant': doc(
    ...['info', 'note', 'warning', 'error'].map((variant) =>
      node('callout', { variant }, paragraph(text(variant)))
    )
  ),
  'the live blocks': doc(node('tocBlock'), pageHierarchy('section'), pageHierarchy('page')),
  'a templateLink of kind page and of kind heading': doc(
    paragraph(text('see '), templateLink('page'), text(' and '), templateLink('heading'))
  ),
  'a finance ledger': doc(ledger),
  'finance statistics': doc(stats)
}

describe('editorFeatures schema', () => {
  it.each(Object.entries(fixtures))('loads a page with %s unchanged', (_name, json) => {
    expect(load(json)).toEqual(json)
  })

  it('drops the legacy heading id and keeps the level, the alignment and the text', () => {
    const loaded = load(doc(headingWithLegacyId))
    expect(loaded).toEqual(doc(heading(2, text('Two'))))
    expect(loaded.content?.[0].attrs).not.toHaveProperty('id')
  })

  it('fills the attributes a document written without them is missing', () => {
    expect(load({ type: 'doc', content: [{ type: 'paragraph' }] })).toEqual(doc(paragraph()))
  })

  it('rejects a node no feature registers', () => {
    expect(() => load(doc({ type: 'imageBlock' }))).toThrow()
  })

  describe('building the schema', () => {
    afterEach(() => vi.restoreAllMocks())

    it('registers no extension name twice, also inside StarterKit and TableKit', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      getSchema(buildExtensions(editorFeatures))
      expect(warn).not.toHaveBeenCalled()
    })
  })
})
