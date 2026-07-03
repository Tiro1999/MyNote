import type { Editor, Range } from '@tiptap/core'

/** Replaces the `/table` command range with a 3×3 table (with a header row). */
export function insertTable(editor: Editor, range: Range): void {
  editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}
