import { createNodeFromContent, getSchema, type JSONContent } from '@tiptap/core'
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildExtensions, coreBlocks, type EditorFeature } from '@renderer/editor'
import { financeFeature, financePlaceholderFeature } from '@renderer/finance'
import { editorFeatures } from './editorFeatures'

// A build without finance loads the same pages, so every test below runs under both
const featureSets: Record<string, EditorFeature[]> = {
  'the finance feature': [coreBlocks, financeFeature],
  'the finance placeholder': [coreBlocks, financePlaceholderFeature]
}

function loadNode(schema: Schema, json: JSONContent): ProseMirrorNode {
  return createNodeFromContent(json, schema, { errorOnInvalidContent: true }) as ProseMirrorNode
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

describe.each(Object.entries(featureSets))('schema with %s', (_name, features) => {
  const schema = getSchema(buildExtensions(features))
  const load = (json: JSONContent): JSONContent => loadNode(schema, json).toJSON()

  it.each(Object.entries(fixtures))('loads a page with %s unchanged', (_fixture, json) => {
    expect(load(json)).toEqual(json)
  })

  it('loads a page with finance blocks between other blocks unchanged', () => {
    const page = doc(
      paragraph(text('before')),
      ledger,
      stats,
      node('callout', { variant: 'note' }, paragraph(text('kept'))),
      paragraph(text('after'))
    )
    expect(load(page)).toEqual(page)
  })

  it('keeps the finance blocks as they are when the text around them is edited', () => {
    const page = doc(paragraph(text('before')), ledger, stats, paragraph(text('after')))
    const state = EditorState.create({ doc: loadNode(schema, page) })
    const edited = state.apply(state.tr.insertText(' and more', 7))
    expect(edited.doc.toJSON().content).toEqual([
      paragraph(text('before and more')),
      ledger,
      stats,
      paragraph(text('after'))
    ])
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
      getSchema(buildExtensions(features))
      expect(warn).not.toHaveBeenCalled()
    })
  })
})

describe('the real feature list', () => {
  it('loads the finance fixtures like the feature set it stands for', () => {
    const schema = getSchema(buildExtensions(editorFeatures))
    for (const json of [doc(ledger), doc(stats)]) {
      expect(loadNode(schema, json).toJSON()).toEqual(json)
    }
  })
})

describe('both finance feature sets', () => {
  it('give the finance blocks the same attributes and the same defaults', () => {
    const [real, placeholder] = Object.values(featureSets).map((features) => getSchema(buildExtensions(features)))
    for (const name of ['financeLedger', 'financeStats']) {
      expect(Object.keys(placeholder.nodes[name].spec.attrs ?? {})).toEqual(Object.keys(real.nodes[name].spec.attrs ?? {}))
      expect(placeholder.nodes[name].create().attrs).toEqual(real.nodes[name].create().attrs)
    }
  })

  it('register the same node names', () => {
    const [real, placeholder] = Object.values(featureSets).map((features) => getSchema(buildExtensions(features)))
    expect(Object.keys(placeholder.nodes).sort()).toEqual(Object.keys(real.nodes).sort())
  })
})
