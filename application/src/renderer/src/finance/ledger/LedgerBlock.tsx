import { useEffect } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import ErrorBox from '../ErrorBox'
import { notifyFailure } from '../notifyFailure'
import { ledgerOf, useFinanceStore } from '../store'
import BalanceFooter from './BalanceFooter'
import LedgerTable from './LedgerTable'
import LedgerToolbar from './LedgerToolbar'

// A pasted or hand-edited page can carry anything as the attribute
const ledgerIdOf = (attrs: Record<string, unknown>): string =>
  typeof attrs.ledgerId === 'string' ? attrs.ledgerId : ''

export default function LedgerBlock({ node, deleteNode }: NodeViewProps): React.JSX.Element {
  const ledgerId = ledgerIdOf(node.attrs)
  const ledger = useFinanceStore((state) => ledgerOf(state.ledgers, ledgerId))
  const accounts = useFinanceStore((state) => state.accounts)
  const categories = useFinanceStore((state) => state.categories)
  const referenceError = useFinanceStore((state) => state.referenceError)

  useEffect(() => {
    const { loadReferenceData, loadLedger } = useFinanceStore.getState()
    notifyFailure(loadReferenceData())
    notifyFailure(loadLedger(ledgerId))
  }, [ledgerId])

  const title = ledger?.meta.name || 'Ledger'
  const readable = ledger?.loadError === null ? ledger : undefined

  return (
    <NodeViewWrapper className="finance-ledger" contentEditable={false}>
      <div className="rounded-lg border border-gray-300 p-3 dark:border-gray-700">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">
            {title} <span className="text-gray-400">#{ledgerId}</span>
          </span>
          <LedgerToolbar ledgerId={ledgerId} name={title} readable={readable !== undefined} onDeleted={deleteNode} />
        </div>

        {ledger === undefined && <div className="text-xs text-gray-500">Loading ledger…</div>}
        {ledger !== undefined && ledger.loadError !== null && (
          <ErrorBox>
            <div>{ledger.loadError}</div>
            <div>This ledger was not changed.</div>
          </ErrorBox>
        )}
        {referenceError !== null && (
          <ErrorBox>{`Accounts and categories could not be read: ${referenceError}. They are not changed.`}</ErrorBox>
        )}
        {readable !== undefined && readable.saveError !== null && <ErrorBox>{`Not saved: ${readable.saveError}`}</ErrorBox>}

        {readable && (
          <>
            <LedgerTable
              ledgerId={ledgerId}
              ledger={readable}
              accounts={accounts}
              categories={categories}
              referenceLocked={referenceError !== null}
            />
            {accounts.length === 0 && referenceError === null && (
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-500">
                {'No accounts yet. Add some under "Reference data", then entries can be assigned to an account.'}
              </div>
            )}
            <BalanceFooter entries={readable.entries} accounts={accounts} currency={readable.meta.currencySymbol} />
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}
