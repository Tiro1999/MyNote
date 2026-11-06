import { useMemo, useState } from 'react'
import type { AnyExtension, Editor, EditorOptions, JSONContent } from '@tiptap/core'
import { useEditor } from '@tiptap/react'
import { buildExtensions } from './extensions'
import type { EditorFeature } from './feature'
import './editor.css'

export interface NoteEditorOptions {
  content: JSONContent
  features: EditorFeature[]
  onUpdate(json: JSONContent): void
  onContentError(): void
}

// Without the content check TipTap loads unknown content as an empty document and the next save erases it
export function noteEditorOptions(
  extensions: AnyExtension[],
  { content, onUpdate, onContentError }: Omit<NoteEditorOptions, 'features'>
): Partial<EditorOptions> {
  return {
    extensions,
    content,
    enableContentCheck: true,
    onUpdate: ({ editor }) => {
      if (editor.isEditable) onUpdate(editor.getJSON())
    },
    onContentError: ({ editor }) => {
      // No update event: the fallback document must never reach the save
      editor.setEditable(false, false)
      onContentError()
    }
  }
}

// The editor is created once: a new `features` array only updates its options (setOptions), the schema stays
export function useNoteEditor({ content, features, ...callbacks }: NoteEditorOptions): Editor | null {
  const extensions = useMemo(() => buildExtensions(features), [features])
  const [initialContent] = useState(content)
  return useEditor(noteEditorOptions(extensions, { content: initialContent, ...callbacks }))
}
