import { create } from 'zustand'
import { messageOf } from '@shared/errors'
import { contentPath, resolves, useNotebookStore, type ContentRef } from '@renderer/notebook'
import { flushWrites, hasUnsentWrites, readJson, writeJson } from '@renderer/storage'
import { notify } from '@renderer/ui'
import {
  emptyContent,
  isTextBox,
  parsePageContent,
  type CanvasElement,
  type PageContent,
  type TextBoxElement,
  type TextBoxPatch
} from './model'

export const SAVE_DELAY_MS = 400

// Content together with the path it was loaded from, so a save never lands in another page
interface Snapshot {
  path: string
  content: PageContent
}

interface ContentState {
  ref: ContentRef | null
  path: string | null
  content: PageContent | null
  error: string | null

  addElement(element: CanvasElement): void
  updateElement(id: string, patch: TextBoxPatch): void
  commitElement(id: string, patch: TextBoxPatch): void
  deleteElement(id: string): void
}

let pendingSave: Snapshot | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined
let loads = 0
let closeHeld = false

async function save({ path, content }: Snapshot): Promise<void> {
  try {
    await writeJson(path, content)
  } catch (error) {
    notify(`Couldn't save ${path}: ${messageOf(error)}`, 'error')
  }
}

function takePendingSave(): Snapshot | null {
  clearTimeout(saveTimer)
  const snapshot = pendingSave
  pendingSave = null
  return snapshot
}

function saveNow(snapshot: Snapshot): void {
  takePendingSave()
  void save(snapshot)
}

function saveLater(snapshot: Snapshot): void {
  clearTimeout(saveTimer)
  pendingSave = snapshot
  saveTimer = setTimeout(() => void flushContent(), SAVE_DELAY_MS)
}

// Sends the pending save at once; resolves when it has been written or has failed
export function flushContent(): Promise<void> {
  const snapshot = takePendingSave()
  return snapshot ? save(snapshot) : Promise.resolve()
}

export const useContentStore = create<ContentState>((set, get) => {
  // No content (still loading, or failed to load) or an edit that matched nothing leaves state and file alone
  const change = (edit: (elements: CanvasElement[]) => CanvasElement[] | null): Snapshot | null => {
    const { path, content } = get()
    if (path === null || content === null) return null
    const elements = edit(content.elements)
    if (elements === null) return null
    const changed = { ...content, elements }
    set({ content: changed })
    return { path, content: changed }
  }

  const patchTextBox = (id: string, patch: TextBoxPatch): Snapshot | null =>
    change((elements) => {
      const target = elements.find(
        (element): element is TextBoxElement => element.id === id && isTextBox(element)
      )
      return target ? elements.map((element) => (element === target ? { ...target, ...patch } : element)) : null
    })

  return {
    ref: null,
    path: null,
    content: null,
    error: null,

    addElement: (element) => {
      const snapshot = change((elements) => [...elements, element])
      if (snapshot) saveNow(snapshot)
    },

    updateElement: (id, patch) => {
      patchTextBox(id, patch)
    },

    commitElement: (id, patch) => {
      const snapshot = patchTextBox(id, patch)
      if (snapshot) saveLater(snapshot)
    },

    deleteElement: (id) => {
      const snapshot = change((elements) => {
        const rest = elements.filter((element) => element.id !== id)
        return rest.length < elements.length ? rest : null
      })
      if (snapshot) saveNow(snapshot)
    }
  }
})

function sameRef(a: ContentRef | null, b: ContentRef | null): boolean {
  return a?.kind === b?.kind && a?.id === b?.id
}

// A load whose request number is no longer the latest belongs to an earlier selection
async function load(ref: ContentRef, path: string, request: number): Promise<void> {
  try {
    const content = (await readJson(path, (raw) => parsePageContent(raw, ref.id))) ?? emptyContent(ref.id)
    if (request === loads) useContentStore.setState({ content })
  } catch (error) {
    if (request === loads) useContentStore.setState({ error: messageOf(error) })
  }
}

function followSelection(): void {
  const { selection, notebooks } = useNotebookStore.getState()
  const { ref, error } = useContentStore.getState()
  // Selecting the open content again reloads it only after a failed load
  if (sameRef(selection, ref) && error === null) return
  // A save into deleted content would recreate its folder with a lone page.json
  if (ref !== null && !resolves(notebooks, ref)) takePendingSave()
  else void flushContent()
  const path = selection && contentPath(notebooks, selection)
  const request = ++loads
  useContentStore.setState({ ref: selection, path, content: null, error: null })
  if (selection && path) void load(selection, path, request)
}

// Text queued behind an in-flight write has not reached main yet, so the close waits for it
function flushBeforeClose(event: BeforeUnloadEvent): void {
  void flushContent()
  // A second close while one is held passes, so a stalled write cannot trap the window
  if (closeHeld || !hasUnsentWrites()) return
  closeHeld = true
  event.preventDefault()
  event.returnValue = ''
  void flushWrites().then(() => {
    closeHeld = false
    window.close()
  })
}

export function startContentSync(): () => void {
  const unsubscribe = useNotebookStore.subscribe((state, prev) => {
    if (state.selection !== prev.selection) followSelection()
  })
  window.addEventListener('beforeunload', flushBeforeClose)
  followSelection()
  return () => {
    unsubscribe()
    window.removeEventListener('beforeunload', flushBeforeClose)
  }
}
