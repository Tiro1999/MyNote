import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TextBox from './TextBox'
import type { TextBoxElement } from './model'

interface EditorOptions {
  onUpdate(json: Record<string, unknown>): void
  onContentError(): void
}

interface Drag {
  onMove(dx: number, dy: number): void
  onEnd?(): void
}

const { editor, drags } = vi.hoisted(() => ({
  editor: { options: null as EditorOptions | null, unreadable: false, raised: false },
  drags: [] as Drag[]
}))

vi.mock('@renderer/editor', async () => {
  const { createElement: h } = await import('react')
  return {
    Toolbar: () => h('nav', { 'data-toolbar': '' }),
    useNoteEditor: (options: EditorOptions) => {
      editor.options = options
      // The real editor reports an unreadable document once, while it is created
      if (editor.unreadable && !editor.raised) {
        editor.raised = true
        options.onContentError()
      }
      return {}
    }
  }
})

vi.mock('@tiptap/react', async () => {
  const { createElement: h } = await import('react')
  return { EditorContent: (props: { className: string }) => h('div', { className: props.className }) }
})

vi.mock('@renderer/ui', () => ({
  usePointerDrag: (onMove: Drag['onMove'], onEnd?: Drag['onEnd']) => {
    drags.push({ onMove, onEnd })
    return () => {}
  }
}))

const element: TextBoxElement = {
  id: 'b1',
  type: 'textbox',
  x: 40,
  y: 60,
  width: 320,
  height: 200,
  zIndex: 3,
  content: { type: 'doc', content: [{ type: 'paragraph' }] }
}

const callbacks = { onFocus: vi.fn(), onBlur: vi.fn(), onUpdate: vi.fn(), onCommit: vi.fn(), onDelete: vi.fn() }

function render(focused = false, zoom = 1): string {
  return renderToString(createElement(TextBox, { element, features: [], zoom, focused, ...callbacks }))
}

// The box asks for its move drag first and its resize drag second
function lastDrags(): { move: Drag; resize: Drag } {
  const [move, resize] = drags.slice(-2)
  return { move, resize }
}

beforeEach(() => {
  editor.options = null
  editor.unreadable = false
  editor.raised = false
  drags.length = 0
  vi.clearAllMocks()
})

describe('TextBox', () => {
  it('sits at its position and size, marked as a canvas element', () => {
    const html = render()
    expect(html).toContain('data-canvas-element')
    expect(html).toContain('left:40px;top:60px;width:320px;height:200px;z-index:3')
    expect(html).toContain('tiptap-editor')
  })

  it('shows the delete button while not focused and the toolbar while focused', () => {
    const idle = render(false)
    expect(idle).toContain('aria-label="Delete text box"')
    expect(idle).not.toContain('data-toolbar')
    const focused = render(true)
    expect(focused).toContain('data-toolbar')
    expect(focused).not.toContain('aria-label="Delete text box"')
  })

  it('commits a text change under the box id', () => {
    render()
    editor.options?.onUpdate({ type: 'doc', content: [] })
    expect(callbacks.onCommit).toHaveBeenCalledWith('b1', { content: { type: 'doc', content: [] } })
    expect(callbacks.onUpdate).not.toHaveBeenCalled()
  })

  describe('dragging and resizing', () => {
    it('updates while moving, divides the deltas by the zoom and commits once at the end', () => {
      render(false, 2)
      const { move } = lastDrags()
      move.onMove(20, -10)
      move.onMove(40, 10)
      expect(callbacks.onUpdate.mock.calls).toEqual([
        ['b1', { x: 50, y: 55 }],
        ['b1', { x: 60, y: 65 }]
      ])
      expect(callbacks.onCommit).not.toHaveBeenCalled()
      move.onEnd?.()
      expect(callbacks.onCommit.mock.calls).toEqual([['b1', { x: 60, y: 65 }]])
    })

    it('resizes by the deltas over the zoom, never below the minimum, and commits once', () => {
      render(false, 2)
      const { resize } = lastDrags()
      resize.onMove(40, 20)
      expect(callbacks.onUpdate).toHaveBeenLastCalledWith('b1', { width: 340, height: 210 })
      resize.onMove(-1000, -1000)
      expect(callbacks.onUpdate).toHaveBeenLastCalledWith('b1', { width: 120, height: 60 })
      expect(callbacks.onCommit).not.toHaveBeenCalled()
      resize.onEnd?.()
      expect(callbacks.onCommit.mock.calls).toEqual([['b1', { width: 120, height: 60 }]])
    })

    it('commits nothing when the pointer never moved', () => {
      render()
      const { move, resize } = lastDrags()
      move.onEnd?.()
      resize.onEnd?.()
      expect(callbacks.onCommit).not.toHaveBeenCalled()
    })

    it('commits the last patch once even if the end is reported twice', () => {
      render()
      const { move } = lastDrags()
      move.onMove(10, 0)
      move.onEnd?.()
      move.onEnd?.()
      expect(callbacks.onCommit).toHaveBeenCalledTimes(1)
    })
  })

  it('is memoized', () => {
    expect((TextBox as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'))
  })

  describe('with content this version cannot display', () => {
    beforeEach(() => {
      editor.unreadable = true
    })

    it('says it is read-only and that the stored content stays', () => {
      const html = render()
      expect(html).toContain('role="alert"')
      expect(html).toContain('Read-only: this text box contains content this version cannot display.')
      expect(html).toContain('The stored content stays unchanged.')
    })

    it('shows no toolbar, even while focused', () => {
      expect(render(true)).not.toContain('data-toolbar')
    })

    it('never commits content', () => {
      render()
      editor.options?.onUpdate({ type: 'doc', content: [] })
      expect(callbacks.onCommit).not.toHaveBeenCalled()
    })

    it('still moves and resizes, committing the position and size only', () => {
      render()
      const { move, resize } = lastDrags()
      move.onMove(10, 10)
      move.onEnd?.()
      resize.onMove(10, 10)
      resize.onEnd?.()
      expect(callbacks.onCommit.mock.calls).toEqual([
        ['b1', { x: 50, y: 70 }],
        ['b1', { width: 330, height: 210 }]
      ])
    })
  })

  it('shows no notice for readable content', () => {
    expect(render()).not.toContain('role="alert"')
  })
})
