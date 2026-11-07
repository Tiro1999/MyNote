import { readFileSync } from 'node:fs'
import { createNodeFromContent, getSchema, type AnyExtension, type JSONContent, type NodeConfig } from '@tiptap/core'
import type { Schema } from '@tiptap/pm/model'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildExtensions, coreBlocks } from '@renderer/editor'
import { FinanceLedgerNode, FinanceStatsNode, financePlaceholderFeature } from './nodes'

type Attrs = Record<string, unknown>
type GetAttrs = (element: unknown) => Attrs | false | null

// Every module a source file loads: import and export ... from, side-effect imports and import()
function importsOf(source: string): Array<{ from: string; typeOnly: boolean }> {
  const statements =
    /^(?:import|export)\b[\w$*{},\s]*?\bfrom\s+['"]([^'"]+)['"]|^import\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm
  return [...source.matchAll(statements)].map((match) => ({
    from: match[1] ?? match[2] ?? match[3],
    typeOnly: /^(?:import|export)\s+type\b/.test(match[0])
  }))
}

const schema: Schema = getSchema(buildExtensions([coreBlocks, financePlaceholderFeature]))

// The part of an element that the attribute parsers read
const element = (data: Record<string, string>): { getAttribute: (name: string) => string | null } => ({
  getAttribute: (name) => data[name] ?? null
})

function parseRule(type: string): { tag?: string; getAttrs: GetAttrs } {
  const rule = schema.nodes[type].spec.parseDOM?.[0]
  if (!rule || !rule.getAttrs) throw new Error(`${type} has no parse rule`)
  return { tag: rule.tag, getAttrs: rule.getAttrs as GetAttrs }
}

const attrsFromHtml = (type: string, data: Record<string, string>): Attrs | false | null =>
  parseRule(type).getAttrs(element(data))

// The attributes the clipboard writes for a block with these attrs
function htmlOf(type: string, attrs: Attrs): Record<string, string> {
  const node = schema.nodes[type].create(attrs)
  const spec = schema.nodes[type].spec.toDOM?.(node) as [string, Record<string, string>]
  return spec[1]
}

const stats: Attrs = {
  ledgerId: 'L1',
  mode: 'category',
  from: '2026-01-01',
  to: '2026-03-31',
  categoryFocus: 'Food/Groceries',
  tagFilter: ['weekly', 'shared']
}

const page = (...blocks: JSONContent[]): JSONContent => ({ type: 'doc', content: blocks })
const paragraph = (text: string): JSONContent => ({
  type: 'paragraph',
  attrs: { textAlign: null },
  content: [{ type: 'text', text }]
})
const load = (json: JSONContent): JSONContent =>
  createNodeFromContent(json, schema, { errorOnInvalidContent: true }).toJSON()

describe('the finance schema nodes', () => {
  it('register financeLedger and financeStats as selectable atoms without a node view', () => {
    for (const [node, name] of [
      [FinanceLedgerNode, 'financeLedger'],
      [FinanceStatsNode, 'financeStats']
    ] as const) {
      expect(node.name).toBe(name)
      expect((node.config as NodeConfig).addNodeView).toBeUndefined()
      expect(schema.nodes[name].isAtom).toBe(true)
      expect(schema.nodes[name].spec.selectable).toBe(true)
      expect(schema.nodes[name].isBlock).toBe(true)
    }
  })

  it('import nothing but the schema, so a build without finance keeps them', () => {
    const source = readFileSync(new URL('./nodes.ts', import.meta.url), 'utf8')
    const imports = importsOf(source)
    expect(imports.map((entry) => entry.from).sort()).toEqual(['./model', '@renderer/editor', '@tiptap/core'].sort())
    expect(imports.find((entry) => entry.from === '@renderer/editor')?.typeOnly).toBe(true)
  })
})

describe('importsOf', () => {
  const sample = [
    'import {',
    '  a,',
    '  b',
    "} from './multi'",
    "import './side-effect'",
    'import type { T } from "@renderer/editor"',
    "import * as everything from './namespace'",
    "export { c } from './reexport'",
    "export * from './star'",
    "export type { D } from './reexported-type'",
    'export const d = 1',
    "const e = await import('./dynamic')",
    'const text = "not from \'here\'"',
    'export function f() {',
    "  return 'from nowhere'",
    '}'
  ].join('\n')

  it('finds multi-line, side-effect, namespace, re-export and dynamic imports, in order', () => {
    expect(importsOf(sample).map((entry) => entry.from)).toEqual([
      './multi',
      './side-effect',
      '@renderer/editor',
      './namespace',
      './reexport',
      './star',
      './reexported-type',
      './dynamic'
    ])
  })

  it('knows which imports are type-only', () => {
    expect(importsOf(sample).filter((entry) => entry.typeOnly).map((entry) => entry.from)).toEqual([
      '@renderer/editor',
      './reexported-type'
    ])
  })

  it('does not take a "from" inside code or a string for an import', () => {
    expect(importsOf("export const a = 1\nconst b = 'x from \"y\"'\n")).toEqual([])
  })
})

describe('financeLedger HTML round trip', () => {
  it('reads ledgerId from data-ledger-id', () => {
    expect(attrsFromHtml('financeLedger', { 'data-ledger-id': 'L1' })).toEqual({ ledgerId: 'L1' })
  })

  it('matches the div that carries data-finance-ledger', () => {
    expect(parseRule('financeLedger').tag).toBe('div[data-finance-ledger]')
  })

  it('writes ledgerId to data-ledger-id', () => {
    const node = schema.nodes.financeLedger.create({ ledgerId: 'L1' })
    expect(schema.nodes.financeLedger.spec.toDOM?.(node)).toEqual([
      'div',
      { 'data-finance-ledger': '', 'data-ledger-id': 'L1' }
    ])
  })

  it('keeps an empty ledger id empty', () => {
    expect(attrsFromHtml('financeLedger', { 'data-ledger-id': '' })).toEqual({ ledgerId: '' })
  })

  it('falls back to the default when the attribute is missing', () => {
    const attrs = attrsFromHtml('financeLedger', {}) as Attrs
    expect(attrs).not.toHaveProperty('ledgerId')
    expect(schema.nodes.financeLedger.create(attrs).attrs).toEqual({ ledgerId: '' })
  })

  it('gives back the attrs it wrote', () => {
    const written = htmlOf('financeLedger', { ledgerId: 'ledger-1' })
    expect(attrsFromHtml('financeLedger', written)).toEqual({ ledgerId: 'ledger-1' })
  })
})

describe('financeStats HTML round trip', () => {
  it('matches the div that carries data-finance-stats', () => {
    expect(parseRule('financeStats').tag).toBe('div[data-finance-stats]')
  })

  it('writes all six attributes to data-* attributes', () => {
    expect(htmlOf('financeStats', stats)).toEqual({
      'data-finance-stats': '',
      'data-ledger-id': 'L1',
      'data-mode': 'category',
      'data-from': '2026-01-01',
      'data-to': '2026-03-31',
      'data-category-focus': 'Food/Groceries',
      'data-tag-filter': '["weekly","shared"]'
    })
  })

  it('gives back every attribute it wrote', () => {
    expect(attrsFromHtml('financeStats', htmlOf('financeStats', stats))).toEqual(stats)
  })

  it('round-trips the defaults of a block that was never configured', () => {
    const defaults = schema.nodes.financeStats.create().attrs
    expect(defaults).toEqual({
      ledgerId: '',
      mode: 'overall',
      from: '',
      to: '',
      categoryFocus: '',
      tagFilter: []
    })
    expect(attrsFromHtml('financeStats', htmlOf('financeStats', defaults))).toEqual(defaults)
  })

  it('keeps tags with commas, quotes and umlauts', () => {
    const tagFilter = ['a,b', 'say "hi"', 'Größe', '</div>']
    const written = htmlOf('financeStats', { ...stats, tagFilter })
    expect(attrsFromHtml('financeStats', written)).toMatchObject({ tagFilter })
  })

  it.each([
    ['text that is no JSON', 'not json'],
    ['an object', '{"a":1}'],
    ['a number', '5'],
    ['a string', '"weekly"'],
    ['null', 'null'],
    ['numbers in the list', '[1,2]'],
    ['a mixed list', '["a",2]'],
    ['a nested list', '[["a"]]'],
    ['an empty text', '']
  ])('reads %s in data-tag-filter as no filter', (_name, text) => {
    expect(attrsFromHtml('financeStats', { 'data-tag-filter': text })).toMatchObject({ tagFilter: [] })
  })

  it('falls back to the defaults when no attribute is present', () => {
    const attrs = attrsFromHtml('financeStats', {}) as Attrs
    for (const key of ['ledgerId', 'mode', 'from', 'to', 'categoryFocus']) expect(attrs).not.toHaveProperty(key)
    expect(schema.nodes.financeStats.create(attrs).attrs).toEqual(schema.nodes.financeStats.create().attrs)
  })

  it('reads a pasted block from v0.1.x, which carried no data attribute, as an unconfigured block', () => {
    const attrs = attrsFromHtml('financeStats', {}) as Attrs
    expect(schema.nodes.financeStats.create(attrs).attrs.mode).toBe('overall')
  })
})

describe('a page with finance blocks', () => {
  const ledger: JSONContent = { type: 'financeLedger', attrs: { ledgerId: 'ledger-1' } }
  const statistics: JSONContent = { type: 'financeStats', attrs: stats }

  it('loads under the placeholder with the same attributes', () => {
    const json = page(paragraph('before'), ledger, statistics, paragraph('after'))
    const loaded = load(json)
    expect(loaded).toEqual(json)
    expect(loaded.content?.[1].attrs).toEqual({ ledgerId: 'ledger-1' })
    expect(loaded.content?.[2].attrs).toEqual(stats)
  })

  it('keeps hostile and wrongly typed values as they are, so a build never rewrites them', () => {
    const odd: JSONContent = {
      type: 'financeStats',
      attrs: { ledgerId: '../x', mode: 'weekly', from: 5, to: null, categoryFocus: [], tagFilter: 'a,b' }
    }
    expect(load(page(odd))).toEqual(page(odd))
    const hostile: JSONContent = { type: 'financeLedger', attrs: { ledgerId: 'constructor' } }
    expect(load(page(hostile))).toEqual(page(hostile))
  })

  it('fills the defaults of a block that was stored without attributes', () => {
    const loaded = load(page({ type: 'financeLedger' }, { type: 'financeStats' }))
    expect(loaded.content?.[0].attrs).toEqual({ ledgerId: '' })
    expect(loaded.content?.[1].attrs).toEqual({
      ledgerId: '',
      mode: 'overall',
      from: '',
      to: '',
      categoryFocus: '',
      tagFilter: []
    })
  })
})

interface StubElement {
  tag: string
  className: string
  textContent: string
  attributes: Record<string, string>
  setAttribute(name: string, value: string): void
}

// There is no DOM in the test environment; the node view only needs createElement
function stubDocument(): StubElement[] {
  const elements: StubElement[] = []
  vi.stubGlobal('document', {
    createElement: (tag: string): StubElement => {
      const created: StubElement = {
        tag,
        className: '',
        textContent: '',
        attributes: {},
        setAttribute(name, value) {
          this.attributes[name] = value
        }
      }
      elements.push(created)
      return created
    }
  })
  return elements
}

describe('financePlaceholderFeature', () => {
  const extension = (name: string): AnyExtension => {
    const found = financePlaceholderFeature.extensions.find((entry) => entry.name === name)
    if (!found) throw new Error(`${name} is not registered`)
    return found
  }

  afterEach(() => vi.unstubAllGlobals())

  it('registers both finance nodes and offers no slash item', () => {
    expect(financePlaceholderFeature.name).toBe('finance-placeholder')
    expect(financePlaceholderFeature.extensions.map((entry) => entry.name)).toEqual(['financeLedger', 'financeStats'])
    expect(financePlaceholderFeature.slashItems).toEqual([])
  })

  it('shows a plain DOM block with the notice and the marker of its node', () => {
    const elements = stubDocument()
    for (const [name, marker] of [
      ['financeLedger', 'data-finance-ledger'],
      ['financeStats', 'data-finance-stats']
    ] as const) {
      const addNodeView = (extension(name).config as NodeConfig).addNodeView as unknown as () => (props: never) => {
        dom: StubElement
        ignoreMutation?: () => boolean
      }
      const view = addNodeView.call({} as never)({} as never)
      expect(view.dom.tag).toBe('div')
      expect(view.dom.textContent).toBe('Finance module not included in this build')
      expect(view.dom.attributes[marker]).toBe('')
      expect(view.dom.attributes.contenteditable).toBe('false')
      expect(view.ignoreMutation?.()).toBe(true)
    }
    expect(elements).toHaveLength(2)
  })

  it('loads and saves a page with both blocks unchanged next to core blocks', () => {
    const json = page(
      paragraph('keep me'),
      { type: 'financeLedger', attrs: { ledgerId: 'ledger-1' } },
      { type: 'financeStats', attrs: stats },
      { type: 'callout', attrs: { variant: 'info' }, content: [paragraph('note')] }
    )
    expect(load(json)).toEqual(json)
  })
})
