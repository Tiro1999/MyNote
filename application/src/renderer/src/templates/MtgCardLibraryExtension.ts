import { Node } from '@tiptap/core'
import type { Editor, Range } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import CardLibraryBlock from '../components/MTG/CardLibraryBlock'

/**
 * The `/mtg-cardlibrary` block.
 *
 * Holds no data of its own — the collection lives in `{dataRoot}/mtg/` and is
 * shared by every block, so two library blocks on different pages show the same
 * cards. Only the view state (the saved filter) is per-block.
 */
export const MtgCardLibrary = Node.create({
  name: 'mtgCardLibrary',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      /** JSON-encoded CardFilter, so a page can keep a saved view. */
      filter: { default: '' }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-mtg-card-library]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-mtg-card-library': '', 'data-filter': HTMLAttributes.filter }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CardLibraryBlock)
  }
})

export function insertCardLibrary(editor: Editor, range: Range): void {
  editor.chain().focus().deleteRange(range).insertContent({ type: 'mtgCardLibrary' }).run()
}

export default MtgCardLibrary
