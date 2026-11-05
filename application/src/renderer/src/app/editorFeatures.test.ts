import { buildExtensions } from '@renderer/editor'
import { describe, expect, it } from 'vitest'
import { editorFeatures } from './editorFeatures'

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
