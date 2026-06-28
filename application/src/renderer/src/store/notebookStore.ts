import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Notebook, Section, PageMeta, PageContent, AnyCanvasElement } from '../types'

// Helpers to keep path construction in one place.
// Node.js fs accepts forward slashes on all platforms, so we always use '/'.
const fsApi = () => window.api.fs

function manifestPath(root: string): string {
  return `${root}/notebooks.json`
}

function pageJsonPath(
  root: string,
  notebookId: string,
  sectionId: string,
  pageId: string
): string {
  return `${root}/${notebookId}/${sectionId}/${pageId}/page.json`
}

async function persistNotebooks(root: string, notebooks: Notebook[]): Promise<void> {
  await fsApi().writeFile(manifestPath(root), JSON.stringify(notebooks, null, 2))
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface NotebookStore {
  dataRoot: string | null
  notebooks: Notebook[]
  activeNotebookId: string | null
  activeSectionId: string | null
  activePageId: string | null
  pageContent: PageContent | null

  setDataRoot: (path: string) => Promise<void>

  setActiveNotebook: (id: string) => void
  setActiveSection: (id: string) => void
  setActivePage: (id: string) => Promise<void>

  addNotebook: (name: string, color?: string) => Promise<void>
  addSection: (notebookId: string, name: string) => Promise<void>
  addPage: (sectionId: string, title?: string) => Promise<void>

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
  activePageId: null,
  pageContent: null,

  setDataRoot: async (path) => {
    const exists = await fsApi().exists(manifestPath(path))
    if (exists) {
      const raw = await fsApi().readFile(manifestPath(path))
      set({ dataRoot: path, notebooks: JSON.parse(raw) })
    } else {
      await fsApi().writeFile(manifestPath(path), '[]')
      set({ dataRoot: path, notebooks: [] })
    }
  },

  setActiveNotebook: (id) =>
    set({ activeNotebookId: id, activeSectionId: null, activePageId: null, pageContent: null }),

  setActiveSection: (id) =>
    set({ activeSectionId: id, activePageId: null, pageContent: null }),

  setActivePage: async (id) => {
    const { dataRoot, activeNotebookId, activeSectionId } = get()
    if (!dataRoot || !activeNotebookId || !activeSectionId) return
    set({ activePageId: id })
    const contentPath = pageJsonPath(dataRoot, activeNotebookId, activeSectionId, id)
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

  addNotebook: async (name, color = '#0078D4') => {
    const { dataRoot, notebooks } = get()
    if (!dataRoot) return
    const id = nanoid()
    const notebook: Notebook = { id, name, color, sections: [] }
    const updated = [...notebooks, notebook]
    await fsApi().mkdir(`${dataRoot}/${id}`)
    await persistNotebooks(dataRoot, updated)
    set({ notebooks: updated })
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
    await persistNotebooks(dataRoot, updated)
    set({ notebooks: updated })
  },

  addPage: async (sectionId, title = 'Untitled Page') => {
    const { dataRoot, notebooks } = get()
    if (!dataRoot) return
    const notebook = notebooks.find((nb) => nb.sections.some((s) => s.id === sectionId))
    if (!notebook) return
    const pageId = nanoid()
    const now = new Date().toISOString()
    const page: PageMeta = { id: pageId, sectionId, title, createdAt: now, updatedAt: now }
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
    set({ notebooks: updated })
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
    const { dataRoot, activeNotebookId, activeSectionId, activePageId, pageContent } = get()
    if (!dataRoot || !activeNotebookId || !activeSectionId || !activePageId || !pageContent) return
    await fsApi().writeFile(
      pageJsonPath(dataRoot, activeNotebookId, activeSectionId, activePageId),
      JSON.stringify(pageContent, null, 2)
    )
  }
}))
