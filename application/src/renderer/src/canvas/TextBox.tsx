import { useCallback, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import {
  Callout,
  TemplateLink,
  HeadingWithId,
  SlashCommand,
  TocBlock,
  PageHierarchyBlock,
  ExternalLinkGuard,
  TableWithControls
} from '@renderer/editor'
// eslint-disable-next-line no-restricted-imports -- removed in phase 4
import { FinanceLedger, FinanceStats } from '@renderer/finance'
import { Toolbar } from '@renderer/editor'
import { useContentStore } from './contentStore'
import type { TextBoxElement } from './model'

interface Props {
  element: TextBoxElement
  onUpdate: (updates: Partial<TextBoxElement>) => void
  onDelete: () => void
}

export default function TextBox({ element, onUpdate, onDelete }: Props): JSX.Element {
  const [focused, setFocused] = useState(false)
  const dragStart = useRef({ mouseX: 0, mouseY: 0, elX: 0, elY: 0 })
  const resizeStart = useRef({ mouseX: 0, mouseY: 0, elW: 0, elH: 0 })
  const didMove = useRef(false)

  // Anchors the slash command's page hierarchy to this content; a content switch remounts every box
  const contentRef = useContentStore((state) => state.ref)

  const editor = useEditor({
    extensions: [
      // Link and Underline follow below (Link for the link guard), so StarterKit's copies are off
      StarterKit.configure({ heading: false, link: false, underline: false }),
      HeadingWithId,
      Underline,
      Link.configure({ openOnClick: false }),
      ExternalLinkGuard,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Callout,
      TemplateLink,
      TocBlock,
      PageHierarchyBlock,
      TableWithControls.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      FinanceLedger,
      FinanceStats,
      SlashCommand.configure({ context: { kind: contentRef?.kind ?? null, id: contentRef?.id ?? null } })
    ],
    content: element.content as object,
    onUpdate: ({ editor }) => {
      onUpdate({ content: editor.getJSON() as Record<string, unknown> })
    }
  })

  // Drag the whole box when not in focused (text-edit) mode
  const handleBoxMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (focused || e.button !== 0) return
      e.stopPropagation()
      didMove.current = false
      dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, elX: element.x, elY: element.y }

      const move = (ev: MouseEvent) => {
        didMove.current = true
        onUpdate({
          x: dragStart.current.elX + (ev.clientX - dragStart.current.mouseX),
          y: dragStart.current.elY + (ev.clientY - dragStart.current.mouseY)
        })
      }
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
    [focused, element.x, element.y, onUpdate]
  )

  // Resize from the bottom-right handle
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      resizeStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        elW: element.width,
        elH: element.height
      }
      const move = (ev: MouseEvent) => {
        onUpdate({
          width: Math.max(120, resizeStart.current.elW + (ev.clientX - resizeStart.current.mouseX)),
          height: Math.max(60, resizeStart.current.elH + (ev.clientY - resizeStart.current.mouseY))
        })
      }
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
    [element.width, element.height, onUpdate]
  )

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
      onMouseDown={handleBoxMouseDown}
    >
      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-sm border bg-white text-gray-900 transition-shadow dark:bg-gray-900 dark:text-gray-100 ${
          focused
            ? 'border-blue-400 shadow-lg ring-1 ring-blue-300 dark:border-blue-500 dark:ring-blue-500/60'
            : 'border-transparent hover:border-gray-300 hover:shadow-xs dark:hover:border-gray-700'
        }`}
        onClick={() => {
          if (!didMove.current) setFocused(true)
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false)
        }}
        tabIndex={0}
      >
        {focused && editor && <Toolbar editor={editor} />}
        <EditorContent
          editor={editor}
          className="tiptap-editor flex-1 cursor-text overflow-auto p-2 text-gray-900 dark:text-gray-100"
          onMouseDown={(e) => {
            if (focused) e.stopPropagation()
          }}
        />
      </div>

      {/* Delete button — visible on hover when not in text-edit mode */}
      {!focused && (
        <button
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs
                     items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity
                     hidden group-hover:flex leading-none"
          onMouseDown={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          ×
        </button>
      )}

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize
                   opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: 'linear-gradient(135deg, transparent 50%, #94a3b8 50%)',
          borderBottomRightRadius: '2px'
        }}
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  )
}
