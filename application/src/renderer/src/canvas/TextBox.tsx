import { memo, useRef, useState } from 'react'
import { EditorContent } from '@tiptap/react'
import { Toolbar, useNoteEditor, type EditorFeature } from '@renderer/editor'
import { usePointerDrag } from '@renderer/ui'
import { dragOffset, movedBox, resizedBox, type Point } from './geometry'
import type { TextBoxElement, TextBoxPatch } from './model'

interface Props {
  element: TextBoxElement
  features: EditorFeature[]
  zoom: number
  focused: boolean
  onFocus(id: string): void
  onBlur(id: string): void
  onUpdate(id: string, patch: TextBoxPatch): void
  onCommit(id: string, patch: TextBoxPatch): void
  onDelete(id: string): void
}

const READ_ONLY_NOTICE =
  'Read-only: this text box contains content this version cannot display. The stored content stays unchanged.'

function TextBox({
  element,
  features,
  zoom,
  focused,
  onFocus,
  onBlur,
  onUpdate,
  onCommit,
  onDelete
}: Props): React.JSX.Element {
  const { id } = element
  const [unreadable, setUnreadable] = useState(false)
  const press = useRef<Point | null>(null)
  // How far the pointer had come from the press when the drag started
  const lead = useRef<Point>({ x: 0, y: 0 })
  const moved = useRef(false)
  const changed = useRef<TextBoxPatch | null>(null)

  const editor = useNoteEditor({
    content: element.content,
    features,
    onUpdate: (json) => {
      if (!unreadable) onCommit(id, { content: json as Record<string, unknown> })
    },
    onContentError: () => setUnreadable(true)
  })

  // The patch changes the store while dragging; one commit at the end saves it
  const change = (patch: TextBoxPatch): void => {
    moved.current = true
    changed.current = patch
    onUpdate(id, patch)
  }
  const finish = (): void => {
    if (changed.current) onCommit(id, changed.current)
    changed.current = null
  }

  // Each drag keeps the element of its start, so the deltas always count from there
  const dragBox = usePointerDrag(
    (dx, dy) => change(movedBox(element, dx + lead.current.x, dy + lead.current.y, zoom)),
    finish
  )
  const dragCorner = usePointerDrag((dx, dy) => change(resizedBox(element, dx, dy, zoom)), finish)

  const handlePointerDown = (e: React.PointerEvent): void => {
    if (focused || e.button !== 0) return
    e.stopPropagation()
    moved.current = false
    press.current = { x: e.clientX, y: e.clientY }
  }

  // See documentation/software/renderer/canvas/canvas.md (why a drag starts after a few pixels)
  const handlePointerMove = (e: React.PointerEvent): void => {
    const from = press.current
    if (!from) return
    if ((e.buttons & 1) === 0) {
      press.current = null
      return
    }
    const offset = dragOffset(from, { x: e.clientX, y: e.clientY })
    if (!offset) return
    press.current = null
    lead.current = offset
    dragBox(e)
  }

  const handleCornerPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    moved.current = false
    dragCorner(e)
  }

  return (
    <div
      data-canvas-element
      className="absolute group"
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => {
        press.current = null
      }}
    >
      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-sm border bg-white text-gray-900 transition-shadow dark:bg-gray-900 dark:text-gray-100 ${
          focused
            ? 'border-blue-400 shadow-lg ring-1 ring-blue-300 dark:border-blue-500 dark:ring-blue-500/60'
            : 'border-transparent hover:border-gray-300 hover:shadow-xs dark:hover:border-gray-700'
        }`}
        onClick={() => {
          if (!moved.current) onFocus(id)
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onBlur(id)
        }}
        tabIndex={0}
      >
        {unreadable && (
          <p
            role="alert"
            className="bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            {READ_ONLY_NOTICE}
          </p>
        )}
        {focused && !unreadable && editor && <Toolbar editor={editor} />}
        <EditorContent
          editor={editor}
          className="tiptap-editor flex-1 cursor-text overflow-auto p-2 text-gray-900 dark:text-gray-100"
          onPointerDown={(e) => {
            if (focused) e.stopPropagation()
          }}
        />
      </div>

      {!focused && (
        <button
          aria-label="Delete text box"
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs
                     items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity
                     hidden group-hover:flex leading-none"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(id)}
        >
          ×
        </button>
      )}

      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize
                   opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: 'linear-gradient(135deg, transparent 50%, #94a3b8 50%)',
          borderBottomRightRadius: '2px'
        }}
        onPointerDown={handleCornerPointerDown}
      />
    </div>
  )
}

export default memo(TextBox)
