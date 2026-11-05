import { useMemo } from 'react'
import type { Account, Entry } from '../model'
import { formatCents } from '../model'
import { computeAccountBalances } from '../statistics/stats'

interface Props {
  entries: Entry[]
  accounts: Account[]
  currency: string
}

export default function BalanceFooter({ entries, accounts, currency }: Props): React.JSX.Element | null {
  const balances = useMemo(() => computeAccountBalances(entries, accounts), [entries, accounts])
  if (balances.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-3 border-t border-gray-200 pt-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
      {balances.map(({ accountId, name, balanceCents }) => (
        <span key={accountId}>
          {`${name}: `}
          <strong>{formatCents(balanceCents, currency)}</strong>
        </span>
      ))}
    </div>
  )
}
