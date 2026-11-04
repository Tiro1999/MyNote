import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotebookStore, type ContentKind, type PageMeta } from '@renderer/notebook'
import { flushWrites } from '@renderer/storage'
import { notify } from '@renderer/ui'
import { SAVE_DELAY_MS, flushContent, startContentSync, useContentStore } from './contentStore'
import type { TextBoxElement } from './model'

vi.mock('@renderer/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@renderer/ui')>()),
  notify: vi.fn()
}))

const NOW = '2026-06-30T20:55:47.832Z'
const A = 'nb1/s1/p1/page.json'
const B = 'nb1/s1/p2/page.json'
const CHAPTER_NOTE = 'nb1/s1/page.json'

interface FakeEvent {
  preventDefault: () => void
  returnValue: unknown
}

// Disk and write log of the window.api fake; while held is a list, writes stay in flight until released
let disk: Map<string, string>
let writes: Array<{ path: string; text: string }>
let held: Array<PromiseWithResolvers<void>> | null
let beforeUnload: ((event: FakeEvent) => void) | undefined
let stop: () => void

const files = {
  readText: vi.fn<(path: string) => Promise<string | null>>(),
  writeText: vi.fn<(path: string, text: string) => Promise<void>>(),
  remove: vi.fn<(path: string) => Promise<void>>()
}
const close = vi.fn<() => void>()

const fakeWindow = {
  api: { files },
  close,
  addEventListener: (type: string, listener: (event: FakeEvent) => void): void => {
    if (type === 'beforeunload') beforeUnload = listener
  },
  removeEventListener: (type: string, listener: (event: FakeEvent) => void): void => {
    if (type === 'beforeunload' && beforeUnload === listener) beforeUnload = undefined
  }
}

function page(id: string): PageMeta {
  return { id, sectionId: 's1', title: id.toUpperCase(), createdAt: NOW, updatedAt: NOW, children: [] }
}

function box(id: string, x = 0): TextBoxElement {
  const content = { type: 'doc', content: [] }
  return { id, type: 'textbox', x, y: 0, width: 320, height: 200, zIndex: 1, content }
}

// Written by the image branch, which this version does not render
const image = {
  id: 'i1',
  type: 'image',
  x: 400,
  y: 60,
  width: 120,
  height: 80,
  zIndex: 2,
  assetPath: 'photo.png',
  alt: 'Photo'
}

function store(path: string, pageId: string, elements: unknown[]): void {
  disk.set(path, JSON.stringify({ pageId, elements }))
}

beforeEach(() => {
  vi.useFakeTimers()
  disk = new Map()
  writes = []
  held = null
  files.readText.mockReset().mockImplementation(async (path) => disk.get(path) ?? null)
  files.writeText.mockReset().mockImplementation(async (path, text) => {
    writes.push({ path, text })
    if (held) {
      const write = Promise.withResolvers<void>()
      held.push(write)
      await write.promise
    }
    disk.set(path, text)
  })
  files.remove.mockReset().mockResolvedValue(undefined)
  close.mockReset()
  vi.mocked(notify).mockClear()
  vi.stubGlobal('window', fakeWindow)
  useNotebookStore.setState(useNotebookStore.getInitialState(), true)
  useContentStore.setState(useContentStore.getInitialState(), true)
  // nb1 with chapter s1 and its pages p1 and p2
  useNotebookStore.setState({
    dataRoot: '/notes',
    activeNotebookId: 'nb1',
    notebooks: [
      {
        id: 'nb1',
        name: 'Work',
        color: '#0078D4',
        sections: [
          { id: 's1', notebookId: 'nb1', name: 'Projects', color: '#E3008C', pages: [page('p1'), page('p2')] }
        ]
      }
    ]
  })
  stop = startContentSync()
})

// Stops holding first, so a test that failed mid-way cannot leave a write in flight for the next one
afterEach(async () => {
  stop()
  const stillHeld = held ?? []
  held = null
  for (const write of stillHeld) write.resolve()
  await flushContent()
  await flushWrites()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const state = useContentStore.getState

// Lets the fake disk answer without moving the clock
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

// Lets every held write land, so the queue sends the text that waited behind it
async function release(): Promise<void> {
  for (const write of held?.splice(0) ?? []) write.resolve()
  await settle()
}

async function open(id: string, kind: ContentKind = 'page'): Promise<void> {
  useNotebookStore.getState().select({ kind, id })
  await settle()
}

function writesTo(path: string): unknown[] {
  return writes.filter((write) => write.path === path).map((write) => JSON.parse(write.text))
}

// A write is in flight and a newer edit waits behind it, so a close has to be held
function queueUnsentText(id: string): void {
  held = []
  state().addElement(box(id))
  state().commitElement(id, { x: 50 })
}

function fireBeforeUnload(): FakeEvent {
  const event: FakeEvent = { preventDefault: vi.fn(), returnValue: undefined }
  if (!beforeUnload) throw new Error('No beforeunload listener is registered')
  beforeUnload(event)
  return event
}

describe('page switch', () => {
  it('writes a commit made less than 400 ms before the switch once, to the old page only', async () => {
    store(A, 'p1', [box('a1')])
    store(B, 'p2', [box('b1')])
    await open('p1')
    state().commitElement('a1', { x: 99 })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS / 2)
    await open('p2')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2)
    expect(writesTo(A)).toEqual([{ pageId: 'p1', elements: [box('a1', 99)] }])
    expect(writesTo(B)).toEqual([])
    expect(state().content).toEqual({ pageId: 'p2', elements: [box('b1')] })
  })

  it('shows the page selected last when the load of an earlier page ends later', async () => {
    store(A, 'p1', [box('a1')])
    store(B, 'p2', [box('b1')])
    const slowRead = Promise.withResolvers<string | null>()
    files.readText.mockReturnValueOnce(slowRead.promise)
    await open('p1')
    await open('p2')
    slowRead.resolve(disk.get(A) ?? null)
    await settle()
    expect(state()).toMatchObject({ ref: { kind: 'page', id: 'p2' }, path: B, error: null })
    expect(state().content).toEqual({ pageId: 'p2', elements: [box('b1')] })
  })

  it('opens a missing file as empty content and creates it with the first save', async () => {
    await open('s1', 'section')
    expect(state().content).toEqual({ pageId: 's1', elements: [] })
    expect(writes).toEqual([])
    state().addElement(box('n1'))
    await settle()
    expect(writesTo(CHAPTER_NOTE)).toEqual([{ pageId: 's1', elements: [box('n1')] }])
  })
})

describe('a corrupt page', () => {
  it.each([
    ['bad JSON', '{"pageId": "p2", "elements": ['],
    ['elements that are not a list', '{"pageId": "p2", "elements": "x"}']
  ])('with %s sets error, keeps content null and is never written', async (_case, text) => {
    store(A, 'p1', [box('a1')])
    disk.set(B, text)
    await open('p2')
    expect(state().content).toBeNull()
    expect(state().error).toContain(`${B}: `)
    state().commitElement('b1', { x: 5 })
    state().addElement(box('b2'))
    state().deleteElement('b1')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2)
    await open('p1')
    expect(writes).toEqual([])
    expect(disk.get(B)).toBe(text)
  })
})

describe('commitElement', () => {
  it('turns two commits within 400 ms into one write with the newest text', async () => {
    store(A, 'p1', [box('a1')])
    await open('p1')
    state().commitElement('a1', { x: 1 })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS / 2)
    state().commitElement('a1', { x: 2 })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 1)
    expect(writes).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(writesTo(A)).toEqual([{ pageId: 'p1', elements: [box('a1', 2)] }])
  })

  it('updateElement changes the state only, addElement and deleteElement save at once', async () => {
    store(A, 'p1', [box('a1')])
    await open('p1')
    state().updateElement('a1', { y: 30 })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2)
    expect(writes).toEqual([])
    expect(state().content?.elements).toEqual([{ ...box('a1'), y: 30 }])
    state().addElement(box('a2'))
    state().deleteElement('a1')
    await settle()
    expect(writesTo(A).at(-1)).toEqual({ pageId: 'p1', elements: [box('a2')] })
  })
})

describe('a page written by another version', () => {
  it('writes an element of another type and the extra fields back as they were loaded', async () => {
    const locked = { ...box('a1'), locked: true }
    disk.set(A, JSON.stringify({ pageId: 'p1', background: 'grid', elements: [locked, image] }))
    await open('p1')
    state().commitElement('a1', { x: 99 })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(writesTo(A)).toEqual([
      { pageId: 'p1', background: 'grid', elements: [{ ...locked, x: 99 }, image] }
    ])
  })
})

describe('an id that no text box has', () => {
  it('changes nothing and writes nothing', async () => {
    store(A, 'p1', [box('a1'), image])
    await open('p1')
    const loaded = state().content
    state().updateElement('gone', { x: 1 })
    state().commitElement('gone', { x: 1 })
    state().commitElement('i1', { x: 1 })
    state().deleteElement('gone')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2)
    expect(writes).toEqual([])
    expect(state().content).toBe(loaded)
  })
})

describe('deleting a page', () => {
  it('drops the pending save of the deleted open page, so its folder is not written again', async () => {
    store(A, 'p1', [box('a1')])
    await open('p1')
    state().commitElement('a1', { x: 9 })
    await useNotebookStore.getState().deletePage('p1')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2)
    expect(files.remove).toHaveBeenCalledWith('nb1/s1/p1')
    expect(writesTo(A)).toEqual([])
    expect(state()).toMatchObject({ ref: null, path: null, content: null })
  })

  it('keeps the pending save of the open page when another page is deleted', async () => {
    store(A, 'p1', [box('a1')])
    await open('p1')
    state().commitElement('a1', { x: 9 })
    await useNotebookStore.getState().deletePage('p2')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(writesTo(A)).toEqual([{ pageId: 'p1', elements: [box('a1', 9)] }])
  })
})

describe('closing the window', () => {
  it('holds the close while text waits behind an in-flight write and closes once the queue drains', async () => {
    store(A, 'p1', [box('a1')])
    await open('p1')
    queueUnsentText('a2')
    const event = fireBeforeUnload()
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(event.returnValue).toBe('')
    await release()
    expect(close).not.toHaveBeenCalled()
    await release()
    expect(close).toHaveBeenCalledTimes(1)
    expect(writesTo(A).at(-1)).toEqual({ pageId: 'p1', elements: [box('a1'), box('a2', 50)] })
  })

  it('lets a second close pass while the first one is still held', async () => {
    store(A, 'p1', [box('a1')])
    await open('p1')
    queueUnsentText('a2')
    const first = fireBeforeUnload()
    const second = fireBeforeUnload()
    expect(first.preventDefault).toHaveBeenCalledTimes(1)
    expect(second.preventDefault).not.toHaveBeenCalled()
    expect(second.returnValue).toBeUndefined()
    expect(close).not.toHaveBeenCalled()
  })

  it('does not hold a close event again once the queue has drained', async () => {
    store(A, 'p1', [box('a1')])
    await open('p1')
    queueUnsentText('a2')
    fireBeforeUnload()
    await release()
    await release()
    expect(close).toHaveBeenCalledTimes(1)
    const again = fireBeforeUnload()
    expect(again.preventDefault).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('holds a close again for text that is unsent after an earlier hold has drained', async () => {
    store(A, 'p1', [box('a1')])
    await open('p1')
    queueUnsentText('a2')
    fireBeforeUnload()
    await release()
    await release()
    queueUnsentText('a3')
    const again = fireBeforeUnload()
    expect(again.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('lets the close pass and sends the pending save once when nothing is in flight', async () => {
    store(A, 'p1', [box('a1')])
    await open('p1')
    state().commitElement('a1', { x: 7 })
    const event = fireBeforeUnload()
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(writesTo(A)).toEqual([{ pageId: 'p1', elements: [box('a1', 7)] }])
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2)
    expect(writes).toHaveLength(1)
    expect(close).not.toHaveBeenCalled()
  })
})

describe('selecting the open page again', () => {
  it('keeps the loaded content and reads nothing', async () => {
    store(A, 'p1', [box('a1')])
    await open('p1')
    const loaded = state().content
    await open('p1')
    expect(state().content).toBe(loaded)
    expect(files.readText).toHaveBeenCalledTimes(1)
  })

  it('ignores a change of the tree while the error of a failed load is shown', async () => {
    disk.set(A, '{')
    await open('p1')
    const failure = state().error
    expect(failure).not.toBeNull()
    await useNotebookStore.getState().renamePage('p2', 'Renamed')
    await settle()
    expect(files.readText).toHaveBeenCalledTimes(1)
    expect(state().error).toBe(failure)
  })

  it('loads the page again after a failed load', async () => {
    disk.set(A, '{')
    await open('p1')
    expect(state().error).not.toBeNull()
    store(A, 'p1', [box('a1')])
    await open('p1')
    expect(state()).toMatchObject({ error: null, content: { pageId: 'p1', elements: [box('a1')] } })
  })
})

describe('a failed save', () => {
  it('shows an error toast that names the file and keeps the change in memory', async () => {
    store(A, 'p1', [box('a1')])
    await open('p1')
    files.writeText.mockRejectedValueOnce(new Error('EBUSY: resource busy or locked'))
    state().deleteElement('a1')
    await settle()
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`${A}.*EBUSY`)), 'error')
    expect(state().content?.elements).toEqual([])
  })
})

describe('startContentSync', () => {
  it('loads the selection that exists when it starts', async () => {
    stop()
    store(A, 'p1', [box('a1')])
    useNotebookStore.getState().select({ kind: 'page', id: 'p1' })
    stop = startContentSync()
    await settle()
    expect(state().content).toEqual({ pageId: 'p1', elements: [box('a1')] })
  })

  it('stops following the selection and removes the close listener when stopped', async () => {
    stop()
    expect(beforeUnload).toBeUndefined()
    store(A, 'p1', [box('a1')])
    await open('p1')
    expect(state()).toMatchObject({ ref: null, content: null })
    expect(files.readText).not.toHaveBeenCalled()
  })
})
