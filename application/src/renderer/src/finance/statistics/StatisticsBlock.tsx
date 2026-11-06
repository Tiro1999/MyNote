import { useEffect, useMemo, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import ErrorBox from '../ErrorBox'
import { formatCents, splitCategoryPath, todayISO } from '../model'
import type { Account, Entry } from '../model'
import { notifyFailure } from '../notifyFailure'
import { ledgerOf, useFinanceStore } from '../store'
import { Bars, Line, Pie } from './charts'
import { loadLedgerChoices, type LedgerChoices } from './ledgerChoices'
import {
  breakdownByCategory,
  computeAccountBalances,
  computeTotals,
  filterEntries,
  monthlyBuckets,
  parseStatsSettings,
  presetRange,
  type Preset
} from './stats'

const NO_CATEGORY_LABEL = '(no category)'
const INCOME_COLOR = '#22c55e'
const EXPENSE_COLOR = '#ef4444'
const DONUT_HOLE_RADIUS = 32

const categoryLabel = (key: string): string => key || NO_CATEGORY_LABEL

interface ViewProps {
  entries: Entry[]
  currency: string
}

function OverallView({
  entries,
  currency,
  accounts
}: ViewProps & { accounts: Account[] | null }): React.JSX.Element {
  const totals = useMemo(() => computeTotals(entries), [entries])
  const balances = useMemo(() => (accounts ? computeAccountBalances(entries, accounts) : []), [entries, accounts])
  const topCategories = useMemo(() => breakdownByCategory(entries, 1), [entries])
  const months = useMemo(() => monthlyBuckets(entries), [entries])

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-4">
        <div className="text-sm">
          Income
          <br />
          <strong className="text-green-600">{formatCents(totals.incomeCents, currency)}</strong>
        </div>
        <div className="text-sm">
          Expenses
          <br />
          <strong className="text-red-600">{formatCents(totals.expenseCents, currency)}</strong>
        </div>
        <div className="text-sm">
          Net
          <br />
          <strong>{formatCents(totals.netCents, currency)}</strong>
        </div>
        <Pie
          data={[
            { label: 'Income', value: totals.incomeCents, color: INCOME_COLOR },
            { label: 'Expenses', value: totals.expenseCents, color: EXPENSE_COLOR }
          ]}
          symbol={currency}
          innerRadius={DONUT_HOLE_RADIUS}
          centerLabel={formatCents(totals.netCents, currency)}
          legend={false}
          ariaLabel="Income versus expenses"
        />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        {balances.map((balance) => (
          <span key={balance.accountId}>
            {`${balance.name}: `}
            <strong>{formatCents(balance.balanceCents, currency)}</strong>
          </span>
        ))}
      </div>
      <Bars
        data={topCategories.map((category) => ({ label: categoryLabel(category.key), value: category.expenseCents }))}
        symbol={currency}
      />
      <Line points={months.map((month) => ({ label: month.month, value: month.incomeCents - month.expenseCents }))} />
    </div>
  )
}

function CategoryView({
  entries,
  currency,
  allEntries,
  focus,
  onFocus
}: ViewProps & { allEntries: Entry[]; focus: string; onFocus: (path: string) => void }): React.JSX.Element {
  const focusDepth = splitCategoryPath(focus).length
  const drill = useMemo(() => breakdownByCategory(entries, focusDepth + 1, focus), [entries, focusDepth, focus])
  const paths = useMemo(() => [...new Set(allEntries.map((entry) => entry.categoryPath).filter(Boolean))], [allEntries])
  const data = drill.map((category) => ({ label: categoryLabel(category.key), value: category.expenseCents }))

  return (
    <div className="mt-3 space-y-3">
      <select aria-label="Category" value={focus} onChange={(e) => onFocus(e.target.value)} className="text-xs">
        <option value="">All main categories</option>
        {paths.map((path) => (
          <option key={path} value={path}>
            {path}
          </option>
        ))}
      </select>
      <Pie data={data} symbol={currency} />
      <Bars data={data} symbol={currency} />
      <table className="w-full text-xs">
        <thead className="text-gray-400">
          <tr>
            <th className="text-left">Category</th>
            <th className="text-right">Expenses</th>
            <th className="text-right">Count</th>
            <th className="text-right">Avg</th>
          </tr>
        </thead>
        <tbody>
          {drill.map((category) => (
            <tr key={category.key} className="border-t border-gray-100 dark:border-gray-800">
              <td>{categoryLabel(category.key)}</td>
              <td className="text-right">{formatCents(category.expenseCents, currency)}</td>
              <td className="text-right">{category.count}</td>
              <td className="text-right">
                {formatCents(category.count ? Math.round(category.expenseCents / category.count) : 0, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function StatisticsBlock({ node, updateAttributes }: NodeViewProps): React.JSX.Element {
  const settings = useMemo(() => parseStatsSettings(node.attrs), [node.attrs])
  const { ledgerId } = settings
  const ledger = useFinanceStore((state) => ledgerOf(state.ledgers, ledgerId))
  const accounts = useFinanceStore((state) => state.accounts)
  const referenceError = useFinanceStore((state) => state.referenceError)
  const [preset, setPreset] = useState<Preset>('month')
  const [choices, setChoices] = useState<LedgerChoices>({ choices: [], error: null })

  useEffect(() => {
    const { loadReferenceData, listLedgers } = useFinanceStore.getState()
    notifyFailure(loadReferenceData())
    let active = true
    void loadLedgerChoices(listLedgers).then((result) => {
      if (active) setChoices(result)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (ledgerId !== '') notifyFailure(useFinanceStore.getState().loadLedger(ledgerId))
  }, [ledgerId])

  const range = useMemo(
    () => presetRange(preset, todayISO(), { from: settings.from, to: settings.to }),
    [preset, settings.from, settings.to]
  )
  const readable = ledger !== undefined && ledger.loadError === null ? ledger : undefined
  const entries = useMemo(
    () => (readable ? filterEntries(readable.entries, { range, tags: settings.tagFilter }) : []),
    [readable, range, settings.tagFilter]
  )

  const messages: string[] = []
  if (choices.error !== null) messages.push(`The ledger list could not be read: ${choices.error}`)
  if (ledger !== undefined && ledger.loadError !== null) {
    messages.push(`This ledger could not be read: ${ledger.loadError}`)
  }
  if (referenceError !== null) messages.push(`Accounts could not be read: ${referenceError}. The balances are not shown.`)

  const listed = choices.choices.some((choice) => choice.id === ledgerId)

  return (
    <NodeViewWrapper className="finance-stats" contentEditable={false}>
      <div className="rounded-lg border border-gray-300 p-3 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select aria-label="Ledger" value={ledgerId} onChange={(e) => updateAttributes({ ledgerId: e.target.value })}>
            <option value="">Choose ledger…</option>
            {choices.choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {`${choice.name} #${choice.id}`}
              </option>
            ))}
            {ledgerId !== '' && !listed && (
              <option value={ledgerId}>{`${ledger?.meta.name ?? ledgerId} #${ledgerId}`}</option>
            )}
          </select>
          <select aria-label="View" value={settings.mode} onChange={(e) => updateAttributes({ mode: e.target.value })}>
            <option value="overall">Overall</option>
            <option value="category">Category</option>
          </select>
          <select aria-label="Period" value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
            <option value="month">This month</option>
            <option value="year">This year</option>
            <option value="custom">Custom range…</option>
          </select>
          {preset === 'custom' && (
            <>
              <input
                type="date"
                aria-label="From"
                value={settings.from}
                onChange={(e) => updateAttributes({ from: e.target.value })}
              />
              <input
                type="date"
                aria-label="To"
                value={settings.to}
                onChange={(e) => updateAttributes({ to: e.target.value })}
              />
            </>
          )}
        </div>

        {messages.length > 0 && (
          <div className="mt-3">
            {messages.map((message) => (
              <ErrorBox key={message}>{message}</ErrorBox>
            ))}
          </div>
        )}

        {ledgerId === '' && <div className="mt-3 text-xs text-gray-400">No ledger selected.</div>}
        {ledgerId !== '' && ledger === undefined && <div className="mt-3 text-xs text-gray-400">Loading ledger…</div>}

        {readable && settings.mode === 'overall' && (
          <OverallView
            entries={entries}
            currency={readable.meta.currencySymbol}
            accounts={referenceError === null ? accounts : null}
          />
        )}
        {readable && settings.mode === 'category' && (
          <CategoryView
            entries={entries}
            currency={readable.meta.currencySymbol}
            allEntries={readable.entries}
            focus={settings.categoryFocus}
            onFocus={(path) => updateAttributes({ categoryFocus: path })}
          />
        )}
      </div>
    </NodeViewWrapper>
  )
}
