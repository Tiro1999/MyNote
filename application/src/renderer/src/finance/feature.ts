import type { EditorFeature } from '@renderer/editor'
import { FinanceLedger, insertFinanceLedger } from './ledger/ledgerNode'
import { FinanceStats, insertFinanceStats } from './statistics/statsNode'

export const financeFeature: EditorFeature = {
  name: 'finance',
  extensions: [FinanceLedger, FinanceStats],
  slashItems: [
    {
      id: 'finance-ledger',
      title: 'Finanz-Tabelle (Einnahmen/Ausgaben)',
      description: 'Fügt einen CSV-gestützten Finanz-Ledger ein',
      icon: '💶',
      keywords: ['finance', 'finanzen', 'tableusecase', 'ledger', 'einnahmen', 'ausgaben', 'budget'],
      run: (editor, range) => {
        void insertFinanceLedger(editor, range)
      }
    },
    {
      id: 'finance-statistics',
      title: 'Finanz-Statistik',
      description: 'Wertet einen Finanz-Ledger aus (Gesamt & Kategorie)',
      icon: '📊',
      keywords: ['statistics', 'statistik', 'statisticsfromtable', 'auswertung', 'charts', 'finance'],
      run: (editor, range) => insertFinanceStats(editor, range)
    }
  ]
}
