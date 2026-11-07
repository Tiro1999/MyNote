import { getSchema, type Editor, type JSONContent } from '@tiptap/core'
import { buildExtensions, coreBlocks, type EditorFeature, type SlashItem } from '@renderer/editor'
import { financeFeature, financePlaceholderFeature } from '@renderer/finance'
import { useNotebookStore } from '@renderer/notebook'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { editorFeatures } from './editorFeatures'

// A ledger slash item creates its files; here the write goes nowhere
vi.mock('@renderer/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@renderer/storage')>()),
  writeText: vi.fn(async () => undefined)
}))

function expectUnique(values: string[]): void {
  expect(new Set(values).size).toBe(values.length)
}

describe('editorFeatures', () => {
  it('lists the core blocks and the finance feature', () => {
    expect(editorFeatures.map((feature) => feature.name)).toEqual(['core', 'finance'])
  })

  it('has no slash item id twice', () => {
    expectUnique(editorFeatures.flatMap((feature) => feature.slashItems.map((item) => item.id)))
  })

  it('registers no extension name twice', () => {
    expectUnique(buildExtensions(editorFeatures).map((extension) => extension.name))
  })

  it('gives every slash item a title, a description and an icon', () => {
    for (const item of editorFeatures.flatMap((feature) => feature.slashItems)) {
      expect([item.title, item.description, item.icon].every((value) => value.length > 0)).toBe(true)
    }
  })
})

// The node types a slash item puts into the editor, read from a chain that only records
function insertedTypes(item: SlashItem): string[] {
  const types: string[] = []
  const collect = (content: JSONContent | JSONContent[]): void => {
    for (const entry of Array.isArray(content) ? content : [content]) {
      if (entry.type) types.push(entry.type)
      if (entry.content) collect(entry.content)
    }
  }
  const chain = {
    focus: () => chain,
    deleteRange: () => chain,
    setTextSelection: () => chain,
    insertContent: (content: JSONContent | JSONContent[]) => {
      collect(content)
      return chain
    },
    insertTable: () => {
      types.push('table')
      return chain
    },
    run: () => true
  }
  item.run({ chain: () => chain } as unknown as Editor, { from: 1, to: 2 })
  return types
}

const featureSets: Record<string, EditorFeature[]> = {
  'the finance feature': [coreBlocks, financeFeature],
  'the finance placeholder': [coreBlocks, financePlaceholderFeature]
}

describe.each(Object.entries(featureSets))('slash items with %s', (_name, features) => {
  const registered = Object.keys(getSchema(buildExtensions(features)).nodes)

  afterEach(() => useNotebookStore.setState({ selection: null }))

  it('insert only nodes the schema registers, or a content check would lock the text box', () => {
    useNotebookStore.setState({ selection: { kind: 'page', id: 'p1' } })
    for (const item of features.flatMap((feature) => feature.slashItems)) {
      const types = insertedTypes(item)
      expect(types.length, item.id).toBeGreaterThan(0)
      for (const type of types) expect(registered, `${item.id} inserts ${type}`).toContain(type)
    }
  })
})

describe('the finance placeholder', () => {
  it('adds no slash item', () => {
    expect(financePlaceholderFeature.slashItems).toEqual([])
  })

  it('leaves the ledger and statistics items out of the menu', () => {
    const ids = [coreBlocks, financePlaceholderFeature].flatMap((feature) => feature.slashItems.map((item) => item.id))
    expect(ids).not.toContain('ledger')
    expect(ids).not.toContain('statistics')
  })
})

describe('editorFeatures by the finance flag', () => {
  afterEach(() => {
    vi.doUnmock('@shared/features')
    vi.resetModules()
  })

  it.each([
    [true, ['core', 'finance']],
    [false, ['core', 'finance-placeholder']]
  ])('with FEATURE_FINANCE %s lists %j', async (flag, names) => {
    vi.resetModules()
    vi.doMock('@shared/features', () => ({ FEATURE_FINANCE: flag }))
    const { editorFeatures: list } = await import('./editorFeatures')
    expect(list.map((feature) => feature.name)).toEqual(names)
  })

  it('builds a schema for the finance-excluded list that still knows both finance blocks', async () => {
    vi.resetModules()
    vi.doMock('@shared/features', () => ({ FEATURE_FINANCE: false }))
    const { editorFeatures: list } = await import('./editorFeatures')
    const nodes = Object.keys(getSchema(buildExtensions(list)).nodes)
    expect(nodes).toEqual(expect.arrayContaining(['financeLedger', 'financeStats']))
    expect(list.flatMap((feature) => feature.slashItems.map((item) => item.id))).not.toContain('ledger')
  })
})
