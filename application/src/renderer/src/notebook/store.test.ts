import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushWrites } from '@renderer/storage'
import { notify } from '@renderer/ui'
import type { ContentRef, Notebook } from './model'
import { useNotebookStore } from './store'
import { page, pageIds } from './fixtures.testing'

vi.mock('@renderer/ui', () => ({ notify: vi.fn() }))

const MANIFEST = 'notebooks.json'

// Disk and call log of the window.api fake
let disk: Map<string, string>
let log: string[]
const files = {
  readText: vi.fn<(path: string) => Promise<string | null>>(),
  writeText: vi.fn<(path: string, text: string) => Promise<void>>(),
  remove: vi.fn<(path: string) => Promise<void>>()
}
const dialogs = { openNotebookFolder: vi.fn<() => Promise<string | null>>() }

beforeEach(() => {
  disk = new Map()
  log = []
  files.readText.mockReset().mockImplementation(async (path) => {
    log.push(`read ${path}`)
    return disk.get(path) ?? null
  })
  files.writeText.mockReset().mockImplementation(async (path, text) => {
    log.push(`write ${path}`)
    disk.set(path, text)
  })
  files.remove.mockReset().mockImplementation(async (path) => {
    log.push(`remove ${path}`)
  })
  dialogs.openNotebookFolder.mockReset().mockResolvedValue('/notes')
  vi.mocked(notify).mockClear()
  vi.stubGlobal('window', { api: { files, dialogs } })
  useNotebookStore.setState(useNotebookStore.getInitialState(), true)
})

afterEach(async () => {
  await flushWrites()
  vi.unstubAllGlobals()
})

// nb1 with chapter s1 (page p1 and its child p2) and the empty chapter s2
function fixture(): Notebook[] {
  return [
    {
      id: 'nb1',
      name: 'Work',
      color: '#0078D4',
      sections: [
        { id: 's1', notebookId: 'nb1', name: 'Projects', color: '#E3008C', pages: [page('p1', [page('p2')])] },
        { id: 's2', notebookId: 'nb1', name: 'Ideas', color: '#E3008C', pages: [] }
      ]
    }
  ]
}

const state = useNotebookStore.getState

function openWith(notebooks: Notebook[]): void {
  useNotebookStore.setState({ dataRoot: '/notes', notebooks, activeNotebookId: 'nb1' })
}

function lastManifest(): Notebook[] {
  const writes = files.writeText.mock.calls.filter(([path]) => path === MANIFEST)
  const last = writes.at(-1)
  if (!last) throw new Error(`${MANIFEST} was not written`)
  return JSON.parse(last[1]) as Notebook[]
}

// A timer fires after all pending microtasks, so every step that could run has run
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('addPage', () => {
  it('keeps both pages when it runs twice without await', async () => {
    openWith(fixture())
    await Promise.all([state().addPage('s1'), state().addPage('s1')])
    const pages = state().notebooks[0].sections[0].pages
    expect(pages).toHaveLength(3)
    expect(new Set(pages.map((p) => p.id)).size).toBe(3)
    expect(lastManifest()[0].sections[0].pages.map((p) => p.id)).toEqual(pages.map((p) => p.id))
  })

  it('adds the page to the tree only and selects it', async () => {
    openWith(fixture())
    await state().addPage('s2')
    const [created] = state().notebooks[0].sections[1].pages
    expect(created).toMatchObject({ sectionId: 's2', title: 'Untitled Page', children: [] })
    expect(state().selection).toEqual({ kind: 'page', id: created.id })
    expect(log).toEqual([`write ${MANIFEST}`])
  })
})

describe('addSubpage', () => {
  it('adds the subpage under its parent and selects it', async () => {
    openWith(fixture())
    await state().addSubpage('p2')
    const [created] = state().notebooks[0].sections[0].pages[0].children[0].children
    expect(created).toMatchObject({ sectionId: 's1', title: 'Untitled Page' })
    expect(state().selection).toEqual({ kind: 'page', id: created.id })
    expect(log).toEqual([`write ${MANIFEST}`])
  })
})

describe('deleteSection and deletePage', () => {
  it('deleteSection removes the chapter folder only after notebooks.json is written', async () => {
    openWith(fixture())
    const manifestWrite = Promise.withResolvers<void>()
    files.writeText.mockImplementationOnce((path) => {
      log.push(`write ${path}`)
      return manifestWrite.promise
    })
    const deleted = state().deleteSection('s1')
    await settle()
    const removedEarly = files.remove.mock.calls.length
    // Resolved before any assertion, so a failure cannot leave the write queue stuck for later tests
    manifestWrite.resolve()
    await deleted
    expect(removedEarly).toBe(0)
    expect(log).toEqual([`write ${MANIFEST}`, 'remove nb1/s1'])
    expect(lastManifest()[0].sections.map((s) => s.id)).toEqual(['s2'])
  })

  it('still removes the folder after a failed manifest save and notifies once', async () => {
    openWith(fixture())
    files.writeText.mockRejectedValueOnce(new Error('EBUSY: resource busy or locked'))
    await expect(state().deletePage('p1')).resolves.toBeUndefined()
    expect(files.remove).toHaveBeenCalledWith('nb1/s1/p1')
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('EBUSY'), 'error')
  })

  it('removes the folder once when the same page is deleted twice at the same time', async () => {
    openWith(fixture())
    await Promise.all([state().deletePage('p1'), state().deletePage('p1')])
    expect(files.remove).toHaveBeenCalledTimes(1)
    expect(files.remove).toHaveBeenCalledWith('nb1/s1/p1')
    expect(files.writeText).toHaveBeenCalledTimes(1)
  })

  it('reports a removal that throws at once and still resolves, so the delete dialog cannot stay busy', async () => {
    openWith(fixture())
    files.remove.mockImplementationOnce(() => {
      throw new Error('An object could not be cloned.')
    })
    await expect(state().deletePage('p1')).resolves.toBeUndefined()
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('could not be cloned'), 'error')
  })

  it('deletePage removes the folder of a subpage under its page chain', async () => {
    openWith(fixture())
    await state().deletePage('p2')
    expect(log).toEqual([`write ${MANIFEST}`, 'remove nb1/s1/p1/p2'])
    expect(pageIds(state().notebooks)).toEqual(['p1'])
  })

  it('clears a selection inside the deleted subtree in the same update as the tree change', async () => {
    openWith(fixture())
    state().select({ kind: 'page', id: 'p2' })
    const seen: Array<{ hasP2: boolean; selection: ContentRef | null }> = []
    const unsubscribe = useNotebookStore.subscribe((next) =>
      seen.push({ hasP2: pageIds(next.notebooks).includes('p2'), selection: next.selection })
    )
    await state().deletePage('p1')
    unsubscribe()
    expect(seen[0]).toEqual({ hasP2: false, selection: null })
  })

  it('keeps a selection that still resolves', async () => {
    openWith(fixture())
    state().select({ kind: 'page', id: 'p1' })
    await state().deletePage('p2')
    expect(state().selection).toEqual({ kind: 'page', id: 'p1' })
  })
})

describe('I/O errors', () => {
  it('reports a failed manifest write once, keeps the change and resolves', async () => {
    openWith(fixture())
    files.writeText.mockRejectedValueOnce(new Error('EBUSY: resource busy or locked'))
    await expect(state().renameSection('s1', 'Renamed')).resolves.toBeUndefined()
    expect(state().notebooks[0].sections[0].name).toBe('Renamed')
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('EBUSY'), 'error')
  })

  it('reports a failed folder removal and keeps the deletion', async () => {
    openWith(fixture())
    files.remove.mockRejectedValueOnce(new Error('EPERM: operation not permitted'))
    await expect(state().deletePage('p1')).resolves.toBeUndefined()
    expect(pageIds(state().notebooks)).toEqual([])
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('EPERM'), 'error')
  })
})

describe('openFolder', () => {
  it.each([
    ['bad JSON', '[{"id": "nb1",', `${MANIFEST}: `],
    ['an invalid id', JSON.stringify([{ id: '..', name: 'Work', color: '#0078D4', sections: [] }]), '".."']
  ])('sets openError for a manifest with %s and writes nothing', async (_case, text, named) => {
    disk.set(MANIFEST, text)
    await state().openFolder()
    expect(state().openError).toContain(MANIFEST)
    expect(state().openError).toContain(named)
    expect(state().dataRoot).toBeNull()
    expect(files.writeText).not.toHaveBeenCalled()
    expect(files.remove).not.toHaveBeenCalled()
  })

  it('opens a folder without a manifest as an empty list and writes nothing', async () => {
    await state().openFolder()
    expect(state()).toMatchObject({ dataRoot: '/notes', notebooks: [], openError: null })
    expect(files.writeText).not.toHaveBeenCalled()
  })

  it('loads the manifest of the picked folder', async () => {
    disk.set(MANIFEST, JSON.stringify(fixture()))
    await state().openFolder()
    expect(state().dataRoot).toBe('/notes')
    expect(state().notebooks).toEqual(fixture())
  })

  it('changes nothing when the dialog is cancelled', async () => {
    dialogs.openNotebookFolder.mockResolvedValue(null)
    await state().openFolder()
    expect(state()).toMatchObject({ dataRoot: null, openError: null })
    expect(files.readText).not.toHaveBeenCalled()
  })

  it('keeps the folder picked last when the load of an earlier pick ends later', async () => {
    const slowRead = Promise.withResolvers<string | null>()
    dialogs.openNotebookFolder.mockResolvedValueOnce('/a').mockResolvedValueOnce('/b')
    files.readText.mockReturnValueOnce(slowRead.promise)
    disk.set(MANIFEST, JSON.stringify(fixture()))
    const first = state().openFolder()
    await vi.waitFor(() => expect(files.readText).toHaveBeenCalledTimes(1))
    await state().openFolder()
    slowRead.resolve('[]')
    await first
    expect(state().dataRoot).toBe('/b')
    expect(state().notebooks).toEqual(fixture())
  })
})

describe('select and setActiveNotebook', () => {
  it('select also activates the notebook of the content and ignores refs that do not resolve', () => {
    useNotebookStore.setState({ dataRoot: '/notes', notebooks: fixture(), activeNotebookId: null })
    state().select({ kind: 'section', id: 's2' })
    expect(state()).toMatchObject({ selection: { kind: 'section', id: 's2' }, activeNotebookId: 'nb1' })
    state().select({ kind: 'page', id: 'gone' })
    expect(state().selection).toEqual({ kind: 'section', id: 's2' })
  })

  it('setActiveNotebook clears the selection', () => {
    openWith(fixture())
    state().select({ kind: 'page', id: 'p1' })
    state().setActiveNotebook('nb1')
    expect(state().selection).toBeNull()
  })
})

describe('renames', () => {
  it('trim the name and ignore an empty one', async () => {
    openWith(fixture())
    await state().renamePage('p2', '  Details  ')
    await state().renameNotebook('nb1', '   ')
    expect(state().notebooks[0].name).toBe('Work')
    expect(state().notebooks[0].sections[0].pages[0].children[0].title).toBe('Details')
    expect(log).toEqual([`write ${MANIFEST}`])
  })
})
