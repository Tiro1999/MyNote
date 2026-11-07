import type { AnyExtension } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { coreBlocks } from './blocks'
import { buildExtensions } from './extensions'
import type { EditorFeature, SlashItem } from './feature'

const run = (): void => undefined
const slashItem = (id: string): SlashItem => ({
  id,
  title: id,
  description: '',
  icon: '',
  keywords: [],
  run
})
const extra: EditorFeature = { name: 'extra', extensions: [], slashItems: [slashItem('extra-1')] }

function names(extensions: AnyExtension[]): string[] {
  return extensions.map((extension) => extension.name)
}

describe('buildExtensions', () => {
  it('contains the base editor, the legacy nodes and the slash command', () => {
    expect(names(buildExtensions([]))).toEqual(
      expect.arrayContaining(['starterKit', 'textAlign', 'tableKit', 'templateLink', 'slashCommand'])
    )
  })

  it('opens links only through the link guard', () => {
    const result = buildExtensions([])
    expect(names(result)).toContain('linkGuard')
    const starterKit = result.find((extension) => extension.name === 'starterKit')
    expect(starterKit?.options.link).toEqual({ openOnClick: false })
  })

  it('adds the extensions of every feature', () => {
    const result = names(buildExtensions([coreBlocks]))
    expect(result).toEqual(
      expect.arrayContaining(['callout', 'tocBlock', 'pageHierarchyBlock', 'table'])
    )
  })

  it('gives the slash command the items of all features, in feature order', () => {
    const slash = buildExtensions([coreBlocks, extra]).find((e) => e.name === 'slashCommand')
    const ids = (slash?.options.items as SlashItem[]).map((item) => item.id)
    expect(ids).toEqual([...coreBlocks.slashItems.map((item) => item.id), 'extra-1'])
  })

  it('registers no extension name twice', () => {
    const result = names(buildExtensions([coreBlocks]))
    expect(new Set(result).size).toBe(result.length)
  })
})

describe('coreBlocks', () => {
  it('has unique slash item ids and the callout, toc, hierarchy and table items', () => {
    const ids = coreBlocks.slashItems.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([
      'callout-info',
      'callout-note',
      'callout-warning',
      'callout-error',
      'table-of-contents',
      'page-hierarchy',
      'table'
    ])
  })
})
