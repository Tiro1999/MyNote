import { describe, expect, it } from 'vitest'
import { filterSlashItems, type SlashItem } from './feature'

function item(id: string, title: string, keywords: string[] = []): SlashItem {
  return { id, title, description: '', icon: '', keywords, run: () => undefined }
}

const items = [
  item('callout-info', 'Info', ['information']),
  item('table', 'Table', ['grid', 'tabelle']),
  item('toc', 'Table of contents', ['headings'])
]

describe('filterSlashItems', () => {
  it('finds Table by a part of the title', () => {
    expect(filterSlashItems(items, 'tab').map((i) => i.id)).toEqual(['table', 'toc'])
  })

  it('finds an item by a keyword', () => {
    expect(filterSlashItems(items, 'grid').map((i) => i.id)).toEqual(['table'])
  })

  it('returns every item for an empty query', () => {
    expect(filterSlashItems(items, '')).toEqual(items)
  })

  it('ignores case', () => {
    expect(filterSlashItems(items, 'TAB').map((i) => i.id)).toEqual(['table', 'toc'])
    expect(filterSlashItems(items, 'InFoRmAtion').map((i) => i.id)).toEqual(['callout-info'])
  })

  it('ignores whitespace around the query', () => {
    expect(filterSlashItems(items, '  grid ').map((i) => i.id)).toEqual(['table'])
    expect(filterSlashItems(items, '   ')).toEqual(items)
  })

  it('returns nothing when no title or keyword matches', () => {
    expect(filterSlashItems(items, 'zzz')).toEqual([])
  })
})
