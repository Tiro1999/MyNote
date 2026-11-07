import { create } from 'zustand'
import { messageOf } from '@shared/errors'
import { newId, openNotebookFolder, remove } from '@renderer/storage'
import { notify } from '@renderer/ui'
import type { ContentRef, Notebook, Section } from './model'
import { MANIFEST_PATH, loadNotebooks, saveNotebooks } from './persistence'
import * as tree from './tree'

const DEFAULT_PAGE_TITLE = 'Untitled Page'
const NOTEBOOK_COLOR = '#0078D4'
const SECTION_COLOR = '#E3008C'

type Mutator = (notebooks: Notebook[]) => Notebook[]

interface NotebookState {
  dataRoot: string | null
  notebooks: Notebook[]
  activeNotebookId: string | null
  selection: ContentRef | null
  openError: string | null

  openFolder(): Promise<void>
  setActiveNotebook(id: string): void
  select(ref: ContentRef): void

  addNotebook(name: string): Promise<void>
  addSection(notebookId: string, name: string): Promise<void>
  addPage(sectionId: string): Promise<void>
  addSubpage(parentPageId: string): Promise<void>

  renameNotebook(id: string, name: string): Promise<void>
  renameSection(id: string, name: string): Promise<void>
  renamePage(id: string, title: string): Promise<void>

  toggleSectionCollapsed(id: string): Promise<void>
  togglePageCollapsed(id: string): Promise<void>

  deleteSection(id: string): Promise<void>
  deletePage(id: string): Promise<void>
}

// I/O errors, also one thrown before a promise exists, reach the user as a toast; the action still resolves
async function reportFailure(task: () => Promise<void>, what: string): Promise<void> {
  try {
    await task()
  } catch (error) {
    notify(`${what}: ${messageOf(error)}`, 'error')
  }
}

function now(): string {
  return new Date().toISOString()
}

export const useNotebookStore = create<NotebookState>((set, get) => {
  let folderRequests = 0

  // Applies the change to the latest tree, clears a selection it removed, then saves the whole manifest
  const commit = (mutator: Mutator): Promise<void> => {
    set((state) => {
      const notebooks = mutator(state.notebooks)
      const { selection } = state
      return { notebooks, selection: selection && tree.resolves(notebooks, selection) ? selection : null }
    })
    return reportFailure(() => saveNotebooks(get().notebooks), `Couldn't save ${MANIFEST_PATH}`)
  }

  // The new content opens at once; its file is created by its first content save
  const commitAndSelect = (mutator: Mutator, ref: ContentRef): Promise<void> => {
    const saved = commit(mutator)
    get().select(ref)
    return saved
  }

  // Manifest first: a failed removal then leaves only a folder that no tree entry points to
  const deleteContent = async (ref: ContentRef, mutator: Mutator): Promise<void> => {
    const dir = tree.contentDir(get().notebooks, ref)
    if (dir === null) return
    await commit(mutator)
    await reportFailure(() => remove(dir), `Couldn't delete ${dir}`)
  }

  return {
    dataRoot: null,
    notebooks: [],
    activeNotebookId: null,
    selection: null,
    openError: null,

    openFolder: async () => {
      const request = ++folderRequests
      try {
        const path = await openNotebookFolder()
        if (path === null) return
        const notebooks = (await loadNotebooks()) ?? []
        // A folder picked later has replaced this one in main
        if (request !== folderRequests) return
        set({ dataRoot: path, notebooks, activeNotebookId: null, selection: null, openError: null })
      } catch (error) {
        if (request === folderRequests) set({ openError: messageOf(error) })
      }
    },

    setActiveNotebook: (id) => set({ activeNotebookId: id, selection: null }),

    // The content store follows a new selection object, so a re-click that retries a failed load needs a fresh ref
    select: (ref) => {
      const found = tree.locate(get().notebooks, ref)
      if (found) set({ selection: ref, activeNotebookId: found.notebook.id })
    },

    addNotebook: async (name) => {
      const notebook: Notebook = { id: newId(), name, color: NOTEBOOK_COLOR, sections: [] }
      const saved = commit((notebooks) => [...notebooks, notebook])
      get().setActiveNotebook(notebook.id)
      await saved
    },

    addSection: (notebookId, name) => {
      const section: Section = { id: newId(), notebookId, name, color: SECTION_COLOR, pages: [] }
      return commitAndSelect(
        (notebooks) =>
          tree.updateNotebook(notebooks, notebookId, (notebook) => ({
            ...notebook,
            sections: [...notebook.sections, section]
          })),
        { kind: 'section', id: section.id }
      )
    },

    addPage: (sectionId) => {
      const page = tree.newPage(sectionId, DEFAULT_PAGE_TITLE, now())
      return commitAndSelect((notebooks) => tree.addPage(notebooks, sectionId, page), {
        kind: 'page',
        id: page.id
      })
    },

    addSubpage: async (parentPageId) => {
      const parent = tree.findPage(get().notebooks, parentPageId)
      if (!parent) return
      const page = tree.newPage(parent.section.id, DEFAULT_PAGE_TITLE, now())
      await commitAndSelect((notebooks) => tree.addSubpage(notebooks, parentPageId, page), {
        kind: 'page',
        id: page.id
      })
    },

    renameNotebook: async (id, name) => {
      const trimmed = name.trim()
      if (!trimmed) return
      await commit((notebooks) =>
        tree.updateNotebook(notebooks, id, (notebook) => ({ ...notebook, name: trimmed }))
      )
    },

    renameSection: async (id, name) => {
      const trimmed = name.trim()
      if (!trimmed) return
      await commit((notebooks) =>
        tree.updateSection(notebooks, id, (section) => ({ ...section, name: trimmed }))
      )
    },

    renamePage: async (id, title) => {
      const trimmed = title.trim()
      if (!trimmed) return
      const updatedAt = now()
      await commit((notebooks) =>
        tree.updatePage(notebooks, id, (page) => ({ ...page, title: trimmed, updatedAt }))
      )
    },

    toggleSectionCollapsed: (id) =>
      commit((notebooks) =>
        tree.updateSection(notebooks, id, (section) => ({ ...section, collapsed: !section.collapsed }))
      ),

    togglePageCollapsed: (id) =>
      commit((notebooks) =>
        tree.updatePage(notebooks, id, (page) => ({ ...page, collapsed: !page.collapsed }))
      ),

    deleteSection: (id) =>
      deleteContent({ kind: 'section', id }, (notebooks) => tree.removeSection(notebooks, id)),

    deletePage: (id) => deleteContent({ kind: 'page', id }, (notebooks) => tree.removePage(notebooks, id))
  }
})
