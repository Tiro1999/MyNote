import { ReactNodeViewRenderer } from '@tiptap/react'
import { replaceRangeWith, type EditorFeature } from '@renderer/editor'
import { newId } from '@renderer/storage'
import LedgerBlock from './ledger/LedgerBlock'
import { FinanceLedgerNode, FinanceStatsNode } from './nodes'
import { reportFailure } from './reportFailure'
import StatisticsBlock from './statistics/StatisticsBlock'
import { useFinanceStore } from './store'

export const financeFeature: EditorFeature = {
  name: 'finance',
  extensions: [
    FinanceLedgerNode.extend({ addNodeView: () => ReactNodeViewRenderer(LedgerBlock) }),
    FinanceStatsNode.extend({ addNodeView: () => ReactNodeViewRenderer(StatisticsBlock) })
  ],
  slashItems: [
    {
      id: 'ledger',
      title: 'Ledger (income and expenses)',
      description: 'Insert a ledger for income and expenses, stored as a CSV file',
      icon: '💶',
      keywords: ['finance', 'ledger', 'income', 'expenses', 'budget'],
      run: (editor, range) => {
        const ledgerId = newId()
        replaceRangeWith(editor, range, { type: 'financeLedger', attrs: { ledgerId } })
        reportFailure(useFinanceStore.getState().createLedger(ledgerId, 'New ledger'))
      }
    },
    {
      id: 'statistics',
      title: 'Statistics',
      description: 'Evaluate a ledger: totals, balances and charts by category',
      icon: '📊',
      keywords: ['statistics', 'charts', 'evaluation', 'finance'],
      run: (editor, range) => replaceRangeWith(editor, range, { type: 'financeStats' })
    }
  ]
}
