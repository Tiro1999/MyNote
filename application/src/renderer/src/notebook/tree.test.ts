import { describe, expect, it } from 'vitest'
import { isValidId } from '@renderer/storage'
import type { Notebook } from './model'
import { NOW, page, pageIds } from './testFixtures'
import {
  addPage,
  addSubpage,
  contentDir,
  contentPath,
  findPage,
  findSection,
  getPageTreeChildren,
  newPage,
  removePage,
  removeSection,
  resolves,
  updatePage,
  updateSection
} from './tree'

// Frozen in strict mode, so a helper that changes its input throws
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

// nb1/s1 with page p1 and its child p2
function fixture(): Notebook[] {
  return deepFreeze([
    {
      id: 'nb1',
      name: 'Work',
      color: '#0078D4',
      sections: [
        { id: 's1', notebookId: 'nb1', name: 'Projects', color: '#E3008C', pages: [page('p1', [page('p2')])] }
      ]
    }
  ])
}

describe('contentPath', () => {
  it('nests a subpage under its whole page chain', () => {
    expect(contentPath(fixture(), { kind: 'page', id: 'p2' })).toBe('nb1/s1/p1/p2/page.json')
  })

  it('puts a chapter note into its chapter folder', () => {
    expect(contentPath(fixture(), { kind: 'section', id: 's1' })).toBe('nb1/s1/page.json')
  })

  it('is null for content that is not in the tree', () => {
    expect(contentPath(fixture(), { kind: 'page', id: 'gone' })).toBeNull()
    expect(contentPath(fixture(), { kind: 'section', id: 'p1' })).toBeNull()
  })
})

describe('contentDir', () => {
  it('is the folder that holds the content file and the subpages', () => {
    expect(contentDir(fixture(), { kind: 'page', id: 'p1' })).toBe('nb1/s1/p1')
    expect(contentDir(fixture(), { kind: 'section', id: 's1' })).toBe('nb1/s1')
  })
})

describe('resolves', () => {
  it('tells whether a ref points into the tree', () => {
    expect(resolves(fixture(), { kind: 'page', id: 'p2' })).toBe(true)
    expect(resolves(fixture(), { kind: 'section', id: 's1' })).toBe(true)
    expect(resolves(fixture(), { kind: 'page', id: 's1' })).toBe(false)
    expect(resolves(removePage(fixture(), 'p1'), { kind: 'page', id: 'p2' })).toBe(false)
  })
})

describe('findSection and findPage', () => {
  it('find a chapter with its notebook', () => {
    const found = findSection(fixture(), 's1')
    expect(found?.notebook.id).toBe('nb1')
    expect(found?.section.name).toBe('Projects')
    expect(findSection(fixture(), 'p1')).toBeNull()
  })

  it('find a subpage with the chain from its top-level page down to itself', () => {
    const found = findPage(fixture(), 'p2')
    expect(found?.notebook.id).toBe('nb1')
    expect(found?.section.id).toBe('s1')
    expect(found?.chain.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(findPage(fixture(), 's1')).toBeNull()
  })
})

describe('removePage', () => {
  it('also drops the subpages', () => {
    const next = removePage(fixture(), 'p1')
    expect(pageIds(next)).toEqual([])
    expect(findPage(next, 'p2')).toBeNull()
  })

  it('removes only the subpage when given one', () => {
    expect(pageIds(removePage(fixture(), 'p2'))).toEqual(['p1'])
  })
})

describe('removeSection', () => {
  it('drops the chapter with its pages', () => {
    const next = removeSection(fixture(), 's1')
    expect(next[0].sections).toEqual([])
    expect(next[0].name).toBe('Work')
  })
})

describe('updatePage', () => {
  it('reaches a subpage', () => {
    const next = updatePage(fixture(), 'p2', (p) => ({ ...p, title: 'Renamed' }))
    expect(findPage(next, 'p2')?.chain.map((p) => p.title)).toEqual(['P1', 'Renamed'])
  })
})

describe('updateSection', () => {
  it('changes only the matching chapter', () => {
    const next = updateSection(fixture(), 's1', (section) => ({ ...section, collapsed: true }))
    expect(next[0].sections[0].collapsed).toBe(true)
    expect(next[0].sections[0].pages).toEqual(fixture()[0].sections[0].pages)
  })
})

describe('addPage and addSubpage', () => {
  it('appends a page to a chapter', () => {
    expect(pageIds(addPage(fixture(), 's1', page('p3')))).toEqual(['p1', 'p2', 'p3'])
  })

  it('opens a collapsed chapter it adds a page to, so the new page is visible', () => {
    const folded = updateSection(fixture(), 's1', (section) => ({ ...section, collapsed: true }))
    const chapter = addPage(folded, 's1', page('p3'))[0].sections[0]
    expect(chapter.collapsed).toBe(false)
    expect(chapter.pages.map((p) => p.id)).toEqual(['p1', 'p3'])
  })

  it('appends a subpage and opens its parent, so the subpage is visible', () => {
    const folded = updatePage(fixture(), 'p1', (p) => ({ ...p, collapsed: true }))
    const parent = findPage(addSubpage(folded, 'p1', page('p3')), 'p1')?.chain[0]
    expect(parent?.collapsed).toBe(false)
    expect(parent?.children.map((p) => p.id)).toEqual(['p2', 'p3'])
  })
})

describe('getPageTreeChildren', () => {
  it("lists a chapter's top-level pages", () => {
    const tree = fixture()
    expect(getPageTreeChildren(tree, { kind: 'section', id: 's1' })).toEqual([tree[0].sections[0].pages[0]])
  })

  it("lists a page's direct subpages", () => {
    expect(getPageTreeChildren(fixture(), { kind: 'page', id: 'p1' }).map((p) => p.id)).toEqual(['p2'])
  })

  it('is empty for content that is not in the tree', () => {
    expect(getPageTreeChildren(fixture(), { kind: 'page', id: 'gone' })).toEqual([])
  })
})

describe('newPage', () => {
  it('builds an empty page with a fresh, valid id', () => {
    const created = newPage('s1', 'Untitled Page', NOW)
    expect(created).toEqual({
      id: created.id,
      sectionId: 's1',
      title: 'Untitled Page',
      createdAt: NOW,
      updatedAt: NOW,
      children: []
    })
    expect(isValidId(created.id)).toBe(true)
    expect(newPage('s1', 'Untitled Page', NOW).id).not.toBe(created.id)
  })
})
