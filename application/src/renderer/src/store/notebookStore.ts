import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Notebook, Section, PageMeta, PageContent, AnyCanvasElement } from '../types'

// Helpers to keep path construction in one place.
// Node.js fs accepts forward slashes on all platforms, so we always use '/'.
const fsApi = () => window.api.fs
const THEME_STORAGE_KEY = 'mynote-theme'

function readInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return true
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return savedTheme === null ? true : savedTheme === 'dark'
}

function persistTheme(isDarkMode: boolean): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light')
}

function manifestPath(root: string): string {
  return `${root}/notebooks.json`
}

/** Path to a chapter's own note content (a chapter can hold notes directly). */
function sectionContentPath(root: string, notebookId: string, sectionId: string): string {
  return `${root}/${notebookId}/${sectionId}/page.json`
}

/** Path to a page/subpage's content, nested by its ancestry chain of ids. */
function pageContentPath(
  root: string,
  notebookId: string,
  sectionId: string,
  chain: PageMeta[]
): string {
  const idPath = chain.map((p) => p.id).join('/')
  return `${root}/${notebookId}/${sectionId}/${idPath}/page.json`
}

async function persistNotebooks(root: string, notebooks: Notebook[]): Promise<void> {
  await fsApi().writeFile(manifestPath(root), JSON.stringify(notebooks, null, 2))
}

// Backfills fields introduced after the initial data model (e.g. subpages, collapse state)
// so notebooks.json files saved by older versions of the app keep working.
function normalizePage(page: PageMeta): PageMeta {
  return { ...page, children: (page.children ?? []).map(normalizePage) }
}

function normalizeNotebooks(notebooks: Notebook[]): Notebook[] {
  return notebooks.map((nb) => ({
    ...nb,
    sections: (nb.sections ?? []).map((sec) => ({
      ...sec,
      pages: (sec.pages ?? []).map(normalizePage)
    }))
  }))
}

// ─── Recursive page-tree helpers ──────────────────────────────────────────────

/** Returns the chain of pages (root ancestor → target, inclusive) leading to `pageId`. */
function findPageChain(
  pages: PageMeta[],
  pageId: string,
  chain: PageMeta[] = []
): PageMeta[] | null {
  for (const page of pages) {
    const nextChain = [...chain, page]
    if (page.id === pageId) return nextChain
    if (page.children.length > 0) {
      const found = findPageChain(page.children, pageId, nextChain)
      if (found) return found
    }
  }
  return null
}

interface PageLocation {
  notebook: Notebook
  section: Section
  chain: PageMeta[]
}

function findPageLocation(notebooks: Notebook[], pageId: string): PageLocation | null {
  for (const notebook of notebooks) {
    for (const section of notebook.sections) {
      const chain = findPageChain(section.pages, pageId)
      if (chain) return { notebook, section, chain }
    }
  }
  return null
}

/** Immutably applies `fn` to the page matching `pageId`, anywhere in the (sub)page tree. */
function mapPageTree(
  pages: PageMeta[],
  pageId: string,
  fn: (page: PageMeta) => PageMeta
): PageMeta[] {
  return pages.map((page) => {
    if (page.id === pageId) return fn(page)
    if (page.children.length > 0) {
      return { ...page, children: mapPageTree(page.children, pageId, fn) }
    }
    return page
  })
}

/** Immutably removes the page matching `pageId`, anywhere in the (sub)page tree. */
function removePageFromTree(pages: PageMeta[], pageId: string): PageMeta[] {
  return pages
    .filter((page) => page.id !== pageId)
    .map((page) =>
      page.children.length > 0 ? { ...page, children: removePageFromTree(page.children, pageId) } : page
    )
}

/** Ids of a page and all of its nested subpages. */
function collectPageIds(page: PageMeta): string[] {
  return [page.id, ...page.children.flatMap(collectPageIds)]
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface NotebookStore {
  dataRoot: string | null
  notebooks: Notebook[]
  activeNotebookId: string | null
  activeSectionId: string | null
  /** Whether the open canvas shows a chapter's own note or a page/subpage. */
  activeContentKind: 'section' | 'page' | null
  /** Id of the section (chapter) or page/subpage currently shown, matching activeContentKind. */
  activeContentId: string | null
  pageContent: PageContent | null
  isDarkMode: boolean

  setDataRoot: (path: string) => Promise<void>

  setActiveNotebook: (id: string) => void
  setActiveSection: (id: string) => Promise<void>
  setActivePage: (id: string) => Promise<void>
  toggleDarkMode: () => void

  addNotebook: (name: string, color?: string) => Promise<void>
  addSection: (notebookId: string, name: string) => Promise<void>
  addPage: (sectionId: string, title?: string) => Promise<void>
  addSubpage: (parentPageId: string, title?: string) => Promise<void>

  renameNotebook: (id: string, name: string) => Promise<void>
  renameSection: (id: string, name: string) => Promise<void>
  renamePage: (pageId: string, title: string) => Promise<void>

  toggleSectionCollapsed: (id: string) => Promise<void>
  togglePageCollapsed: (pageId: string) => Promise<void>

  deleteSection: (id: string) => Promise<void>
  deletePage: (pageId: string) => Promise<void>

  addElement: (element: AnyCanvasElement) => void
  updateElement: (id: string, updates: Partial<AnyCanvasElement>) => void
  deleteElement: (id: string) => void

  savePageContent: () => Promise<void>
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useNotebookStore = create<NotebookStore>((set, get) => ({
  dataRoot: null,
  notebooks: [],
  activeNotebookId: null,
  activeSectionId: null,
  activeContentKind: null,
  activeContentId: null,
  pageContent: null,
  isDarkMode: readInitialDarkMode(),

  setDataRoot: async (path) => {
    const exists = await fsApi().exists(manifestPath(path))
    if (exists) {
      const raw = await fsApi().readFile(manifestPath(path))
      set({ dataRoot: path, notebooks: normalizeNotebooks(JSON.parse(raw)) })
    } else {
      await fsApi().writeFile(manifestPath(path), '[]')
      set({ dataRoot: path, notebooks: [] })
    }
  },

  setActiveNotebook: (id) =>
    set({
      activeNotebookId: id,
      activeSectionId: null,
      activeContentKind: null,
      activeContentId: null,
      pageContent: null
    }),

  setActiveSection: async (id) => {
    const { dataRoot, notebooks } = get()
    set({
      activeSectionId: id,
      activeContentKind: 'section',
      activeContentId: id,
      pageContent: null
    })
    if (!dataRoot) return
    const notebook = notebooks.find((nb) => nb.sections.some((s) => s.id === id))
    if (!notebook) return
    const contentPath = sectionContentPath(dataRoot, notebook.id, id)
    const exists = await fsApi().exists(contentPath)
    if (exists) {
      const raw = await fsApi().readFile(contentPath)
      set({ pageContent: JSON.parse(raw) })
    } else {
      const fresh: PageContent = { pageId: id, elements: [] }
      await fsApi().writeFile(contentPath, JSON.stringify(fresh, null, 2))
      set({ pageContent: fresh })
    }
  },

  setActivePage: async (id) => {
    const { dataRoot, notebooks } = get()
    const location = findPageLocation(notebooks, id)
    if (!location) return
    set({
      activeNotebookId: location.notebook.id,
      activeSectionId: location.section.id,
      activeContentKind: 'page',
      activeContentId: id,
      pageContent: null
    })
    if (!dataRoot) return
    const contentPath = pageContentPath(
      dataRoot,
      location.notebook.id,
      location.section.id,
      location.chain
    )
    const exists = await fsApi().exists(contentPath)
    if (exists) {
      const raw = await fsApi().readFile(contentPath)
      set({ pageContent: JSON.parse(raw) })
    } else {
      const fresh: PageContent = { pageId: id, elements: [] }
      await fsApi().writeFile(contentPath, JSON.stringify(fresh, null, 2))
      set({ pageContent: fresh })
    }
  },

  toggleDarkMode: () =>
    set((state) => {
      const nextValue = !state.isDarkMode
      persistTheme(nextValue)
      return { isDarkMode: nextValue }
    }),

  addNotebook: async (name, color = '#0078D4') => {
    const { dataRoot, notebooks } = get()
    if (!dataRoot) return
    const id = nanoid()
    const notebook: Notebook = { id, name, color, sections: [] }
    const updated = [...notebooks, notebook]
    await fsApi().mkdir(`${dataRoot}/${id}`)
    await persistNotebooks(dataRoot, updated)
    set({
      notebooks: updated,
      activeNotebookId: id,
      activeSectionId: null,
      activeContentKind: null,
      activeContentId: null,
      pageContent: null
    })
  },

  addSection: async (notebookId, name) => {
    const { dataRoot, notebooks } = get()
    if (!dataRoot) return
    const sectionId = nanoid()
    const section: Section = { id: sectionId, notebookId, name, color: '#E3008C', pages: [] }
    const updated = notebooks.map((nb) =>
      nb.id === notebookId ? { ...nb, sections: [...nb.sections, section] } : nb
    )
    await fsApi().mkdir(`${dataRoot}/${notebookId}/${sectionId}`)
    const fresh: PageContent = { pageId: sectionId, elements: [] }
    await fsApi().writeFile(
      sectionContentPath(dataRoot, notebookId, sectionId),
      JSON.stringify(fresh, null, 2)
    )
    await persistNotebooks(dataRoot, updated)
    set({
      notebooks: updated,
      activeNotebookId: notebookId,
      activeSectionId: sectionId,
      activeContentKind: 'section',
      activeContentId: sectionId,
      pageContent: fresh
    })
  },

  addPage: async (sectionId, title = 'Untitled Page') => {
    const { dataRoot, notebooks } = get()
    if (!dataRoot) return
    const notebook = notebooks.find((nb) => nb.sections.some((s) => s.id === sectionId))
    if (!notebook) return
    const pageId = nanoid()
    const now = new Date().toISOString()
    const page: PageMeta = {
      id: pageId,
      sectionId,
      title,
      createdAt: now,
      updatedAt: now,
      children: []
    }
    const updated = notebooks.map((nb) =>
      nb.id === notebook.id
        ? {
            ...nb,
            sections: nb.sections.map((sec) =>
              sec.id === sectionId ? { ...sec, pages: [...sec.pages, page] } : sec
            )
          }
        : nb
    )
    const pagePath = `${dataRoot}/${notebook.id}/${sectionId}/${pageId}`
    await fsApi().mkdir(`${pagePath}/assets`)
    await fsApi().writeFile(
      `${pagePath}/page.json`,
      JSON.stringify({ pageId, elements: [] }, null, 2)
    )
    await persistNotebooks(dataRoot, updated)
    set({
      notebooks: updated,
      activeNotebookId: notebook.id,
      activeSectionId: sectionId,
      activeContentKind: 'page',
      activeContentId: pageId,
      pageContent: { pageId, elements: [] }
    })
  },

  addSubpage: async (parentPageId, title = 'Untitled Page') => {
    const { dataRoot, notebooks } = get()
    if (!dataRoot) return
    const location = findPageLocation(notebooks, parentPageId)
    if (!location) return
    const subpageId = nanoid()
    const now = new Date().toISOString()
    const subpage: PageMeta = {
      id: subpageId,
      sectionId: location.section.id,
      title,
      createdAt: now,
      updatedAt: now,
      children: []
    }
    const updated = notebooks.map((nb) =>
      nb.id === location.notebook.id
        ? {
            ...nb,
            sections: nb.sections.map((sec) =>
              sec.id === location.section.id
                ? {
                    ...sec,
                    pages: mapPageTree(sec.pages, parentPageId, (page) => ({
                      ...page,
                      collapsed: false,
                      children: [...page.children, subpage]
                    }))
                  }
                : sec
            )
          }
        : nb
    )
    const idPath = [...location.chain.map((p) => p.id), subpageId].join('/')
    const pagePath = `${dataRoot}/${location.notebook.id}/${location.section.id}/${idPath}`
    await fsApi().mkdir(`${pagePath}/assets`)
    await fsApi().writeFile(
      `${pagePath}/page.json`,
      JSON.stringify({ pageId: subpageId, elements: [] }, null, 2)
    )
    await persistNotebooks(dataRoot, updated)
    set({
      notebooks: updated,
      activeNotebookId: location.notebook.id,
      activeSectionId: location.section.id,
      activeContentKind: 'page',
      activeContentId: subpageId,
      pageContent: { pageId: subpageId, elements: [] }
    })
  },

  renameNotebook: async (id, name) => {
    const { dataRoot, notebooks } = get()
    if (!dataRoot) return
    const trimmed = name.trim()
    if (!trimmed) return
    const updated = notebooks.map((nb) => (nb.id === id ? { ...nb, name: trimmed } : nb))
    await persistNotebooks(dataRoot, updated)
    set({ notebooks: updated })
  },

  renameSection: async (id, name) => {
    const { dataRoot, notebooks } = get()
    if (!dataRoot) return
    const trimmed = name.trim()
    if (!trimmed) return
    const updated = notebooks.map((nb) => ({
      ...nb,
      sections: nb.sections.map((sec) => (sec.id === id ? { ...sec, name: trimmed } : sec))
    }))
    await persistNotebooks(dataRoot, updated)
    set({ notebooks: updated })
  },

  renamePage: async (pageId, title) => {
    const { dataRoot, notebooks } = get()
    if (!dataRoot) return
    const trimmed = title.trim()
    if (!trimmed) return
    const now = new Date().toISOString()
    const updated = notebooks.map((nb) => ({
      ...nb,
      sections: nb.sections.map((sec) => ({
        ...sec,
        pages: mapPageTree(sec.pages, pageId, (page) => ({
          ...page,
          title: trimmed,
          updatedAt: now
        }))
      }))
    }))
    await persistNotebooks(dataRoot, updated)
    set({ notebooks: updated })
  },

  toggleSectionCollapsed: async (id) => {
    const { dataRoot, notebooks } = get()
    const updated = notebooks.map((nb) => ({
      ...nb,
      sections: nb.sections.map((sec) =>
        sec.id === id ? { ...sec, collapsed: !sec.collapsed } : sec
      )
    }))
    set({ notebooks: updated })
    if (dataRoot) await persistNotebooks(dataRoot, updated)
  },

  togglePageCollapsed: async (pageId) => {
    const { dataRoot, notebooks } = get()
    const updated = notebooks.map((nb) => ({
      ...nb,
      sections: nb.sections.map((sec) => ({
        ...sec,
        pages: mapPageTree(sec.pages, pageId, (page) => ({ ...page, collapsed: !page.collapsed }))
      }))
    }))
    set({ notebooks: updated })
    if (dataRoot) await persistNotebooks(dataRoot, updated)
  },

  deleteSection: async (id) => {
    const { dataRoot, notebooks, activeSectionId } = get()
    if (!dataRoot) return
    const notebook = notebooks.find((nb) => nb.sections.some((s) => s.id === id))
    if (!notebook) return
    const updated = notebooks.map((nb) =>
      nb.id === notebook.id ? { ...nb, sections: nb.sections.filter((sec) => sec.id !== id) } : nb
    )
    await fsApi().remove(`${dataRoot}/${notebook.id}/${id}`)
    await persistNotebooks(dataRoot, updated)
    const wasActive = activeSectionId === id
    set({
      notebooks: updated,
      ...(wasActive
        ? { activeSectionId: null, activeContentKind: null, activeContentId: null, pageContent: null }
        : {})
    })
  },

  deletePage: async (pageId) => {
    const { dataRoot, notebooks, activeContentKind, activeContentId } = get()
    if (!dataRoot) return
    const location = findPageLocation(notebooks, pageId)
    if (!location) return
    const deletedIds = new Set(collectPageIds(location.chain[location.chain.length - 1]))
    const updated = notebooks.map((nb) =>
      nb.id === location.notebook.id
        ? {
            ...nb,
            sections: nb.sections.map((sec) =>
              sec.id === location.section.id
                ? { ...sec, pages: removePageFromTree(sec.pages, pageId) }
                : sec
            )
          }
        : nb
    )
    const idPath = location.chain.map((p) => p.id).join('/')
    await fsApi().remove(`${dataRoot}/${location.notebook.id}/${location.section.id}/${idPath}`)
    await persistNotebooks(dataRoot, updated)
    const shouldReset =
      activeContentKind === 'page' && activeContentId !== null && deletedIds.has(activeContentId)
    set({
      notebooks: updated,
      ...(shouldReset ? { activeContentKind: null, activeContentId: null, pageContent: null } : {})
    })
  },

  addElement: (element) => {
    const { pageContent } = get()
    if (!pageContent) return
    set({ pageContent: { ...pageContent, elements: [...pageContent.elements, element] } })
  },

  updateElement: (id, updates) => {
    const { pageContent } = get()
    if (!pageContent) return
    set({
      pageContent: {
        ...pageContent,
        elements: pageContent.elements.map((el) =>
          el.id === id ? ({ ...el, ...updates } as AnyCanvasElement) : el
        )
      }
    })
  },

  deleteElement: (id) => {
    const { pageContent } = get()
    if (!pageContent) return
    set({
      pageContent: { ...pageContent, elements: pageContent.elements.filter((el) => el.id !== id) }
    })
  },

  savePageContent: async () => {
    const {
      dataRoot,
      activeNotebookId,
      activeSectionId,
      activeContentKind,
      activeContentId,
      pageContent,
      notebooks
    } = get()
    if (
      !dataRoot ||
      !activeNotebookId ||
      !activeSectionId ||
      !activeContentKind ||
      !activeContentId ||
      !pageContent
    )
      return
    if (activeContentKind === 'section') {
      await fsApi().writeFile(
        sectionContentPath(dataRoot, activeNotebookId, activeSectionId),
        JSON.stringify(pageContent, null, 2)
      )
      return
    }
    const location = findPageLocation(notebooks, activeContentId)
    if (!location) return
    await fsApi().writeFile(
      pageContentPath(dataRoot, location.notebook.id, location.section.id, location.chain),
      JSON.stringify(pageContent, null, 2)
    )
  }
}))
