import { Node } from '@tiptap/core'
import type { Editor, Range } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import StatisticsBlock from '../components/Finance/StatisticsBlock'

export const FinanceStats = Node.create({
  name: 'financeStats',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      ledgerId: { default: '' },
      mode: { default: 'overall' },
      from: { default: '' },
      to: { default: '' },
      categoryFocus: { default: '' },
      tagFilter: { default: [] }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-finance-stats]' }]
  },

  renderHTML() {
    return ['div', { 'data-finance-stats': '' }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(StatisticsBlock)
  }
})

export function insertFinanceStats(editor: Editor, range: Range): void {
  editor.chain().focus().deleteRange(range).insertContent({ type: 'financeStats' }).run()
}

export default FinanceStats
