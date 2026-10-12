import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'

interface Props {
  editor: Editor
}

type LinkDialog =
  | { phase: 'idle' }
  | { phase: 'choose' }
  | { phase: 'url'; value: string }

export default function Toolbar({ editor }: Props): JSX.Element {
  const [linkDialog, setLinkDialog] = useState<LinkDialog>({ phase: 'idle' })
  const urlInputRef = useRef<HTMLInputElement>(null)

  // Focus the URL input whenever that phase becomes active
  useEffect(() => {
    if (linkDialog.phase === 'url') urlInputRef.current?.focus()
  }, [linkDialog.phase])

  // Close dialog on Escape
  useEffect(() => {
    if (linkDialog.phase === 'idle') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLinkDialog({ phase: 'idle' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [linkDialog.phase])

  const Btn = ({
    active,
    title,
    onClick,
    children
  }: {
    active: boolean
    title: string
    onClick: () => void
    children: React.ReactNode
  }) => (
    <button
      title={title}
      className={`px-1.5 py-0.5 rounded-sm text-xs font-medium transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
          : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
    >
      {children}
    </button>
  )

  const Sep = () => <span className="mx-0.5 h-4 w-px self-center bg-gray-300 dark:bg-gray-700" />

  const handlePickFile = async () => {
    setLinkDialog({ phase: 'idle' })
    const path = await window.api.dialog.openFile([{ name: 'All Files', extensions: ['*'] }])
    if (path) {
      const href = path.match(/^https?:\/\//) ? path : `file://${path}`
      editor.chain().focus().setLink({ href }).run()
    }
  }

  const handleConfirmUrl = () => {
    if (linkDialog.phase !== 'url') return
    const href = linkDialog.value.trim()
    if (href) editor.chain().focus().setLink({ href }).run()
    setLinkDialog({ phase: 'idle' })
  }

  return (
    <div className="relative">
      <div
        className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-700 dark:bg-gray-800"
        onMouseDown={(e) => e.preventDefault()}
      >
        <Btn active={editor.isActive('bold')} title="Bold (Ctrl+B)" onClick={() => editor.chain().focus().toggleBold().run()}>
          <b>B</b>
        </Btn>
        <Btn active={editor.isActive('italic')} title="Italic (Ctrl+I)" onClick={() => editor.chain().focus().toggleItalic().run()}>
          <i>I</i>
        </Btn>
        <Btn active={editor.isActive('underline')} title="Underline (Ctrl+U)" onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <u>U</u>
        </Btn>
        <Btn active={editor.isActive('strike')} title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}>
          <s>S</s>
        </Btn>

        <Sep />

        <Btn active={editor.isActive('heading', { level: 1 })} title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Btn>
        <Btn active={editor.isActive('heading', { level: 2 })} title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
        <Btn active={editor.isActive('heading', { level: 3 })} title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>

        <Sep />

        <Btn active={editor.isActive('bulletList')} title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</Btn>
        <Btn active={editor.isActive('orderedList')} title="Ordered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</Btn>
        <Btn active={editor.isActive('codeBlock')} title="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()}>&lt;/&gt;</Btn>

        <Sep />

        {/* Link insertion */}
        <button
          title="Insert link (🔗)"
          className={`rounded-sm px-1.5 py-0.5 text-xs transition-colors ${
            linkDialog.phase !== 'idle'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
          onMouseDown={(e) => {
            e.preventDefault()
            setLinkDialog(linkDialog.phase === 'idle' ? { phase: 'choose' } : { phase: 'idle' })
          }}
        >
          🔗
        </button>
        {editor.isActive('link') && (
          <Btn active={false} title="Remove link" onClick={() => editor.chain().focus().unsetLink().run()}>
            🔗✕
          </Btn>
        )}
      </div>

      {/* Link popover — replaces window.confirm / window.prompt (both frozen in Electron) */}
      {linkDialog.phase !== 'idle' && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-md border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {linkDialog.phase === 'choose' && (
            <div className="flex gap-1">
              <button
                className="rounded-sm bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                onMouseDown={(e) => { e.preventDefault(); handlePickFile() }}
              >
                📁 File
              </button>
              <button
                className="rounded-sm bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                onMouseDown={(e) => { e.preventDefault(); setLinkDialog({ phase: 'url', value: '' }) }}
              >
                🌐 URL
              </button>
              <button
                className="rounded-sm px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                onMouseDown={(e) => { e.preventDefault(); setLinkDialog({ phase: 'idle' }) }}
              >
                ✕
              </button>
            </div>
          )}
          {linkDialog.phase === 'url' && (
            <div className="flex gap-1">
              <input
                ref={urlInputRef}
                type="url"
                placeholder="https://…"
                value={linkDialog.value}
                onChange={(e) => setLinkDialog({ phase: 'url', value: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmUrl() }}
                className="w-48 rounded-sm border border-gray-300 bg-white px-2 py-0.5 text-xs outline-hidden focus:border-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              <button
                className="rounded-sm bg-blue-500 px-2 py-0.5 text-xs text-white hover:bg-blue-600"
                onMouseDown={(e) => { e.preventDefault(); handleConfirmUrl() }}
              >
                OK
              </button>
              <button
                className="rounded-sm px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                onMouseDown={(e) => { e.preventDefault(); setLinkDialog({ phase: 'idle' }) }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
