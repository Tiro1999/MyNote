import type { Editor, JSONContent, Range } from '@tiptap/core'

export function replaceRangeWith(editor: Editor, range: Range, content: JSONContent | JSONContent[]): void {
  editor.chain().focus().deleteRange(range).insertContent(content).run()
}
