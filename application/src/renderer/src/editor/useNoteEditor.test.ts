import { Editor, type JSONContent } from '@tiptap/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { coreBlocks } from './blocks'
import { buildExtensions } from './extensions'
import { noteEditorOptions } from './useNoteEditor'

const extensions = buildExtensions([coreBlocks])
const paragraph: JSONContent = { type: 'paragraph' }

function create(content: JSONContent): {
  editor: Editor
  onUpdate: ReturnType<typeof vi.fn>
  onContentError: ReturnType<typeof vi.fn>
  emitUpdate: () => void
} {
  const onUpdate = vi.fn()
  const onContentError = vi.fn()
  const editor = new Editor(noteEditorOptions(extensions, { content, onUpdate, onContentError }))
  const emitUpdate = (): void => {
    editor.emit('update', { editor, transaction: editor.state.tr, appendedTransactions: [] })
  }
  return { editor, onUpdate, onContentError, emitUpdate }
}

describe('noteEditorOptions', () => {
  beforeEach(() => {
    // TipTap rebuilds a rejected document from an empty HTML string, which needs a parser
    const emptyBody = { childNodes: [], firstChild: null }
    class FakeDomParser {
      parseFromString(): { body: typeof emptyBody } {
        return { body: emptyBody }
      }
    }
    vi.stubGlobal('window', { DOMParser: FakeDomParser })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads known content, stays editable and reports an update as JSON', () => {
    const { editor, onUpdate, onContentError, emitUpdate } = create({ type: 'doc', content: [paragraph] })
    emitUpdate()
    expect(onContentError).not.toHaveBeenCalled()
    expect(editor.isEditable).toBe(true)
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate.mock.calls[0][0]).toEqual(editor.getJSON())
  })

  it('loads a legacy templateLink without an error', () => {
    const link = { type: 'templateLink', attrs: { kind: 'page', targetId: 'p1', label: 'P' } }
    const { editor, onContentError } = create({
      type: 'doc',
      content: [{ type: 'paragraph', content: [link] }]
    })
    expect(onContentError).not.toHaveBeenCalled()
    expect(editor.getJSON().content?.[0].content).toEqual([link])
  })

  it('goes read-only on an unknown node, reports it once and never reports an update', () => {
    const { editor, onUpdate, onContentError, emitUpdate } = create({
      type: 'doc',
      content: [{ type: 'imageBlock' }]
    })
    emitUpdate()
    expect(onContentError).toHaveBeenCalledTimes(1)
    expect(editor.isEditable).toBe(false)
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('treats content that is no document as a content error', () => {
    const { editor, onUpdate, onContentError } = create({})
    expect(onContentError).toHaveBeenCalledTimes(1)
    expect(editor.isEditable).toBe(false)
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
