import { useState } from 'react'
import type { ChainedCommands, Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import LinkPopover from './links/LinkPopover'
import { toolbarState } from './toolbarState'

interface Props {
  editor: Editor
}

interface BtnProps {
  active: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
}

function Btn({ active, title, onClick, children }: BtnProps): React.JSX.Element {
  return (
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
}

function Sep(): React.JSX.Element {
  return <span className="mx-0.5 h-4 w-px self-center bg-gray-300 dark:bg-gray-700" />
}

export default function Toolbar({ editor }: Props): React.JSX.Element {
  const [linkOpen, setLinkOpen] = useState(false)
  const state = useEditorState({ editor, selector: (snapshot) => toolbarState(snapshot.editor) })
  const chain = (): ChainedCommands => editor.chain().focus()

  return (
    <div className="relative">
      <div
        className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-700 dark:bg-gray-800"
        onMouseDown={(e) => e.preventDefault()}
      >
        <Btn active={state.bold} title="Bold (Ctrl+B)" onClick={() => chain().toggleBold().run()}>
          <b>B</b>
        </Btn>
        <Btn
          active={state.italic}
          title="Italic (Ctrl+I)"
          onClick={() => chain().toggleItalic().run()}
        >
          <i>I</i>
        </Btn>
        <Btn
          active={state.underline}
          title="Underline (Ctrl+U)"
          onClick={() => chain().toggleUnderline().run()}
        >
          <u>U</u>
        </Btn>
        <Btn active={state.strike} title="Strikethrough" onClick={() => chain().toggleStrike().run()}>
          <s>S</s>
        </Btn>

        <Sep />

        <Btn
          active={state.heading1}
          title="Heading 1"
          onClick={() => chain().toggleHeading({ level: 1 }).run()}
        >
          H1
        </Btn>
        <Btn
          active={state.heading2}
          title="Heading 2"
          onClick={() => chain().toggleHeading({ level: 2 }).run()}
        >
          H2
        </Btn>
        <Btn
          active={state.heading3}
          title="Heading 3"
          onClick={() => chain().toggleHeading({ level: 3 }).run()}
        >
          H3
        </Btn>

        <Sep />

        <Btn
          active={state.bulletList}
          title="Bullet list"
          onClick={() => chain().toggleBulletList().run()}
        >
          • List
        </Btn>
        <Btn
          active={state.orderedList}
          title="Ordered list"
          onClick={() => chain().toggleOrderedList().run()}
        >
          1. List
        </Btn>
        <Btn
          active={state.codeBlock}
          title="Code block"
          onClick={() => chain().toggleCodeBlock().run()}
        >
          &lt;/&gt;
        </Btn>

        <Sep />

        <Btn
          active={linkOpen}
          title={state.link ? 'Edit link' : 'Insert link'}
          onClick={() => setLinkOpen((open) => !open)}
        >
          🔗
        </Btn>
        {state.link && (
          <Btn active={false} title="Remove link" onClick={() => chain().unsetLink().run()}>
            🔗✕
          </Btn>
        )}
      </div>

      {linkOpen && <LinkPopover editor={editor} onClose={() => setLinkOpen(false)} />}
    </div>
  )
}
