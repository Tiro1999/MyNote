import type { Editor } from '@tiptap/react'

interface Props {
  editor: Editor
}

export default function Toolbar({ editor }: Props): JSX.Element {
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
      className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
        active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'
      }`}
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
    >
      {children}
    </button>
  )

  const Sep = () => <span className="w-px h-4 bg-gray-300 mx-0.5 self-center" />

  const handleInsertLink = async () => {
    // Prefer the native file-picker for local files; fall back to a URL prompt
    const useFile = window.confirm('Open file picker to insert a file link?\n(Cancel = type a URL)')
    if (useFile) {
      const path = await window.api.dialog.openFile([{ name: 'All Files', extensions: ['*'] }])
      if (path) {
        const href = path.match(/^https?:\/\//) ? path : `file://${path}`
        editor.chain().focus().setLink({ href }).run()
      }
    } else {
      const url = window.prompt('Enter URL:')
      if (url) editor.chain().focus().setLink({ href: url }).run()
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 px-2 py-1 border-b border-gray-200 bg-gray-50 shrink-0"
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

      {/* Link insertion — Ctrl+K equivalent via toolbar button */}
      <button
        title="Insert link (🔗)"
        className="px-1.5 py-0.5 rounded text-xs text-gray-600 hover:bg-gray-200"
        onMouseDown={(e) => {
          e.preventDefault()
          handleInsertLink()
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
  )
}
