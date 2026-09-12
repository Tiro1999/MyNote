import { describe, it, expect } from 'vitest'
import { contentDirFor } from './notebookStore'
import type { Notebook, PageMeta } from '../types'

function page(id: string, children: PageMeta[] = []): PageMeta {
  return {
    id,
    sectionId: 'SEC',
    title: id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    children
  }
}

const notebooks: Notebook[] = [
  {
    id: 'NB',
    name: 'Notebook',
    color: '#000',
    sections: [
      {
        id: 'SEC',
        notebookId: 'NB',
        name: 'Chapter',
        color: '#111',
        pages: [page('P1', [page('P2', [page('P3')])])]
      }
    ]
  }
]

describe('contentDirFor', () => {
  it("returns a chapter's own folder", () => {
    expect(contentDirFor('/root', notebooks, 'section', 'SEC')).toBe('/root/NB/SEC')
  })

  it('returns a top-level page folder', () => {
    expect(contentDirFor('/root', notebooks, 'page', 'P1')).toBe('/root/NB/SEC/P1')
  })

  it('nests a subpage by its full ancestry chain', () => {
    expect(contentDirFor('/root', notebooks, 'page', 'P3')).toBe('/root/NB/SEC/P1/P2/P3')
  })

  it('returns null when nothing is open', () => {
    expect(contentDirFor('/root', notebooks, null, null)).toBeNull()
  })

  it('returns null for an unknown id', () => {
    expect(contentDirFor('/root', notebooks, 'page', 'NOPE')).toBeNull()
    expect(contentDirFor('/root', notebooks, 'section', 'NOPE')).toBeNull()
  })
})
