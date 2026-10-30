import { joinPath, newId } from '@renderer/storage'
import type { ContentRef, Notebook, PageMeta, Section } from './model'

const CONTENT_FILE = 'page.json'

type Change<T> = (item: T) => T

export interface SectionLocation {
  notebook: Notebook
  section: Section
}

export interface PageLocation extends SectionLocation {
  // From the top-level page down to the page itself; empty for a chapter note
  chain: PageMeta[]
}

export function findSection(nbs: Notebook[], id: string): SectionLocation | null {
  for (const notebook of nbs) {
    const section = notebook.sections.find((candidate) => candidate.id === id)
    if (section) return { notebook, section }
  }
  return null
}

function findChain(pages: PageMeta[], id: string): PageMeta[] | null {
  for (const page of pages) {
    if (page.id === id) return [page]
    const rest = findChain(page.children, id)
    if (rest) return [page, ...rest]
  }
  return null
}

export function findPage(nbs: Notebook[], id: string): PageLocation | null {
  for (const notebook of nbs) {
    for (const section of notebook.sections) {
      const chain = findChain(section.pages, id)
      if (chain) return { notebook, section, chain }
    }
  }
  return null
}

export function locate(nbs: Notebook[], ref: ContentRef): PageLocation | null {
  if (ref.kind === 'page') return findPage(nbs, ref.id)
  const found = findSection(nbs, ref.id)
  return found ? { ...found, chain: [] } : null
}

export function contentDir(nbs: Notebook[], ref: ContentRef): string | null {
  const found = locate(nbs, ref)
  if (!found) return null
  return joinPath(found.notebook.id, found.section.id, ...found.chain.map((page) => page.id))
}

export function contentPath(nbs: Notebook[], ref: ContentRef): string | null {
  const dir = contentDir(nbs, ref)
  return dir === null ? null : joinPath(dir, CONTENT_FILE)
}

export function resolves(nbs: Notebook[], ref: ContentRef): boolean {
  return locate(nbs, ref) !== null
}

// A chapter's top-level pages or a page's direct subpages
export function getPageTreeChildren(nbs: Notebook[], ref: ContentRef): PageMeta[] {
  const found = locate(nbs, ref)
  if (!found) return []
  const page = found.chain.at(-1)
  return page ? page.children : found.section.pages
}

function mapSections(nbs: Notebook[], change: Change<Section>): Notebook[] {
  return nbs.map((notebook) => ({ ...notebook, sections: notebook.sections.map(change) }))
}

function mapPages(pages: PageMeta[], id: string, change: Change<PageMeta>): PageMeta[] {
  return pages.map((page) =>
    page.id === id ? change(page) : { ...page, children: mapPages(page.children, id, change) }
  )
}

function dropPage(pages: PageMeta[], id: string): PageMeta[] {
  return pages
    .filter((page) => page.id !== id)
    .map((page) => ({ ...page, children: dropPage(page.children, id) }))
}

export function updateNotebook(nbs: Notebook[], id: string, change: Change<Notebook>): Notebook[] {
  return nbs.map((notebook) => (notebook.id === id ? change(notebook) : notebook))
}

export function updateSection(nbs: Notebook[], id: string, change: Change<Section>): Notebook[] {
  return mapSections(nbs, (section) => (section.id === id ? change(section) : section))
}

export function updatePage(nbs: Notebook[], id: string, change: Change<PageMeta>): Notebook[] {
  return mapSections(nbs, (section) => ({ ...section, pages: mapPages(section.pages, id, change) }))
}

export function removeSection(nbs: Notebook[], id: string): Notebook[] {
  return nbs.map((notebook) => ({
    ...notebook,
    sections: notebook.sections.filter((section) => section.id !== id)
  }))
}

export function removePage(nbs: Notebook[], id: string): Notebook[] {
  return mapSections(nbs, (section) => ({ ...section, pages: dropPage(section.pages, id) }))
}

// The chapter opens, so the new page is visible
export function addPage(nbs: Notebook[], sectionId: string, page: PageMeta): Notebook[] {
  return updateSection(nbs, sectionId, (section) => ({
    ...section,
    collapsed: false,
    pages: [...section.pages, page]
  }))
}

// The parent opens, so the new subpage is visible
export function addSubpage(nbs: Notebook[], parentPageId: string, page: PageMeta): Notebook[] {
  return updatePage(nbs, parentPageId, (parent) => ({
    ...parent,
    collapsed: false,
    children: [...parent.children, page]
  }))
}

export function newPage(sectionId: string, title: string, now: string): PageMeta {
  return { id: newId(), sectionId, title, createdAt: now, updatedAt: now, children: [] }
}
