import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { CALLOUT_VARIANTS, Callout, calloutSlashItems, parseCalloutVariant } from './callout'

const schema = getSchema([StarterKit, Callout])

describe('parseCalloutVariant', () => {
  it('keeps a known variant', () => {
    for (const variant of CALLOUT_VARIANTS) expect(parseCalloutVariant(variant)).toBe(variant)
    expect(parseCalloutVariant('warning')).toBe('warning')
  })

  it('falls back to info for an unknown variant, a missing one and a non-string', () => {
    expect(parseCalloutVariant('bogus')).toBe('info')
    expect(parseCalloutVariant(undefined)).toBe('info')
    expect(parseCalloutVariant(null)).toBe('info')
    expect(parseCalloutVariant(3)).toBe('info')
    expect(parseCalloutVariant('')).toBe('info')
  })
})

describe('callout node', () => {
  const rule = schema.nodes.callout.spec.parseDOM?.[0]
  const element = (variant: string | null): HTMLElement =>
    ({ getAttribute: (name: string) => (name === 'data-callout-variant' ? variant : null) }) as HTMLElement

  it('reads a known variant from pasted HTML and falls back to info otherwise', () => {
    const attrsOf = (variant: string | null): unknown =>
      (rule?.getAttrs as (dom: HTMLElement) => { variant: string })(element(variant)).variant
    expect(attrsOf('error')).toBe('error')
    expect(attrsOf('bogus')).toBe('info')
    expect(attrsOf(null)).toBe('info')
  })

  it('renders a stored unknown variant as info instead of throwing', () => {
    const paragraph = schema.nodes.paragraph.create()
    const node = schema.nodes.callout.create({ variant: 'bogus' }, paragraph)
    const [tag, attrs, icon] = schema.nodes.callout.spec.toDOM?.(node) as [
      string,
      Record<string, string>,
      [string, Record<string, string>, string]
    ]
    expect(tag).toBe('div')
    expect(attrs['data-callout-variant']).toBe('info')
    expect(icon[2]).toBe('ℹ️')
  })

  it('keeps the stored variant of a known callout', () => {
    const node = schema.nodes.callout.create({ variant: 'warning' }, schema.nodes.paragraph.create())
    const [, attrs, icon] = schema.nodes.callout.spec.toDOM?.(node) as [
      string,
      Record<string, string>,
      [string, Record<string, string>, string]
    ]
    expect(attrs['data-callout-variant']).toBe('warning')
    expect(icon[2]).toBe('⚠️')
  })
})

describe('calloutSlashItems', () => {
  it('has one item per variant, labelled Info, Note, Warning and Error', () => {
    expect(calloutSlashItems.map((item) => [item.id, item.title])).toEqual([
      ['callout-info', 'Info'],
      ['callout-note', 'Note'],
      ['callout-warning', 'Warning'],
      ['callout-error', 'Error']
    ])
  })

  it('finds each item by its variant name', () => {
    for (const [index, variant] of CALLOUT_VARIANTS.entries()) {
      expect(calloutSlashItems[index].keywords).toContain(variant)
    }
  })
})
