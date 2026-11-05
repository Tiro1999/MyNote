import { describe, expect, it, vi } from 'vitest'
import type { PageMeta } from '@renderer/notebook'
import { pageHierarchySlashItem, pageLinks } from './pageHierarchy'

const page = (id: string, title: string, children: PageMeta[] = []): PageMeta => ({
  id,
  sectionId: 's1',
  title,
  createdAt: '',
  updatedAt: '',
  children
})

describe('pageLinks', () => {
  const tree = [page('a', 'A', [page('a1', 'A1', [page('a1x', 'A1x')]), page('a2', 'A2')]), page('b', '')]

  it('flattens the tree depth first, one level of indent per generation', () => {
    const links = pageLinks(tree, vi.fn())
    expect(links.map((link) => [link.label, link.depth])).toEqual([
      ['A', 0],
      ['A1', 1],
      ['A1x', 2],
      ['A2', 1],
      ['', 0]
    ])
  })

  it('opens the page of the clicked entry', () => {
    const openPage = vi.fn()
    pageLinks(tree, openPage)[2].onClick()
    expect(openPage).toHaveBeenCalledWith('a1x')
  })

  it('returns nothing for no pages', () => {
    expect(pageLinks([], vi.fn())).toEqual([])
  })
})

describe('pageHierarchySlashItem', () => {
  it('is titled in English and keeps its search keywords', () => {
    expect(pageHierarchySlashItem.title).toBe('Page hierarchy')
    expect(pageHierarchySlashItem.keywords).toContain('subpages')
  })
})
