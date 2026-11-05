import { Node } from '@tiptap/core'
import type { Editor, Range } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { replaceRangeWith } from '@renderer/editor'
import LedgerBlock from './LedgerBlock'
import { useFinanceStore } from '../store'

export const FinanceLedger = Node.create({
  name: 'financeLedger',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return { ledgerId: { default: '' } }
  },

  parseHTML() {
    return [{ tag: 'div[data-finance-ledger]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-finance-ledger': '', 'data-ledger-id': HTMLAttributes.ledgerId }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(LedgerBlock)
  }
})

/** Creates a new ledger (CSV + meta) then inserts a block referencing it. */
export async function insertFinanceLedger(editor: Editor, range: Range): Promise<void> {
  const ledgerId = await useFinanceStore.getState().createLedger('Neues Ledger', '€')
  replaceRangeWith(editor, range, { type: 'financeLedger', attrs: { ledgerId } })
}
