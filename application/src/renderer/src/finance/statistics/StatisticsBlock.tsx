import { useEffect, useMemo, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useFinanceStore } from '../store'
import { formatCents, splitCategoryPath } from '../model'
import {
  computeTotals,
  computeAccountSaldos,
  breakdownByCategory,
  monthlyBuckets,
  filterEntries,
  type DateRange
} from './stats'
import Donut from './charts/Donut'
import Pie from './charts/Pie'
import Bars from './charts/Bars'
import Line from './charts/Line'

type Preset = 'month' | 'year' | 'custom'

function presetRange(preset: Preset, from: string, to: string): DateRange {
  const now = new Date()
  const y = now.getFullYear()
  const pad = (n: number): string => String(n).padStart(2, '0')
  if (preset === 'month')
    return { from: `${y}-${pad(now.getMonth() + 1)}-01`, to: `${y}-${pad(now.getMonth() + 1)}-31` }
  if (preset === 'year') return { from: `${y}-01-01`, to: `${y}-12-31` }
  return { from: from || '0000-01-01', to: to || '9999-12-31' }
}

export default function StatisticsBlock({ node, updateAttributes }: NodeViewProps): JSX.Element {
  const attrs = node.attrs as {
    ledgerId: string
    mode: 'overall' | 'category'
    from: string
    to: string
    categoryFocus: string
    tagFilter: string[]
  }
  const { ledgers, accounts, loadLedger, loadReferenceData, listLedgers, deleteLedger } =
    useFinanceStore()
  const [sources, setSources] = useState<Array<{ id: string; name: string }>>([])
  const [preset, setPreset] = useState<Preset>('month')

  useEffect(() => {
    loadReferenceData()
    listLedgers().then(setSources)
  }, [loadReferenceData, listLedgers])

  useEffect(() => {
    if (attrs.ledgerId) loadLedger(attrs.ledgerId)
  }, [attrs.ledgerId, loadLedger])

  const ledger = ledgers[attrs.ledgerId]
  const currency = ledger?.meta.currencySymbol ?? '€'
  const range = presetRange(preset, attrs.from, attrs.to)
  const entries = useMemo(
    () => (ledger ? filterEntries(ledger.entries, { range, tags: attrs.tagFilter }) : []),
    [ledger, range, attrs.tagFilter]
  )
  const totals = useMemo(() => computeTotals(entries), [entries])
  const saldos = useMemo(() => computeAccountSaldos(entries, accounts), [entries, accounts])
  const topCats = useMemo(() => breakdownByCategory(entries, 1), [entries])
  const months = useMemo(() => monthlyBuckets(entries, range), [entries, range])
  const focusDepth = splitCategoryPath(attrs.categoryFocus).length
  const drill = useMemo(
    () => breakdownByCategory(entries, focusDepth + 1, attrs.categoryFocus || undefined),
    [entries, focusDepth, attrs.categoryFocus]
  )
  const allCats = useMemo(
    () => [...new Set((ledger?.entries ?? []).map((e) => e.categoryPath).filter(Boolean))],
    [ledger]
  )

  const handleDeleteSource = async (): Promise<void> => {
    if (!attrs.ledgerId) return
    if (!window.confirm(`Ledger #${attrs.ledgerId} und seine Datendatei endgültig löschen?`)) return
    await deleteLedger(attrs.ledgerId)
    updateAttributes({ ledgerId: '' })
    setSources(await listLedgers())
  }

  return (
    <NodeViewWrapper className="finance-stats" contentEditable={false}>
      <div className="rounded-lg border border-gray-300 p-3 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={attrs.ledgerId}
            onChange={(e) => updateAttributes({ ledgerId: e.target.value })}
          >
            <option value="">Quelle wählen…</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} #{s.id}
              </option>
            ))}
          </select>
          {attrs.ledgerId && (
            <button
              type="button"
              title="Diese Quelle (Ledger-Datei) endgültig löschen"
              className="text-red-600"
              onClick={handleDeleteSource}
            >
              🗑
            </button>
          )}
          <select value={attrs.mode} onChange={(e) => updateAttributes({ mode: e.target.value })}>
            <option value="overall">Gesamt</option>
            <option value="category">Kategorie</option>
          </select>
          <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
            <option value="month">Dieser Monat</option>
            <option value="year">Dieses Jahr</option>
            <option value="custom">Zeitraum…</option>
          </select>
          {preset === 'custom' && (
            <>
              <input
                type="date"
                value={attrs.from}
                onChange={(e) => updateAttributes({ from: e.target.value })}
              />
              <input
                type="date"
                value={attrs.to}
                onChange={(e) => updateAttributes({ to: e.target.value })}
              />
            </>
          )}
        </div>

        {!ledger && <div className="mt-3 text-xs text-gray-400">Keine Quelle gewählt.</div>}

        {ledger && attrs.mode === 'overall' && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-4">
              <div className="text-sm">
                Einnahmen
                <br />
                <strong className="text-green-600">{formatCents(totals.incomeCents, currency)}</strong>
              </div>
              <div className="text-sm">
                Ausgaben
                <br />
                <strong className="text-red-600">{formatCents(totals.expenseCents, currency)}</strong>
              </div>
              <div className="text-sm">
                Netto
                <br />
                <strong>{formatCents(totals.netCents, currency)}</strong>
              </div>
              <Donut income={totals.incomeCents} expense={totals.expenseCents} symbol={currency} />
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              {saldos.map((s) => (
                <span key={s.accountId}>
                  {s.name}: <strong>{formatCents(s.saldoCents, currency)}</strong>
                </span>
              ))}
            </div>
            <Bars data={topCats.map((c) => ({ label: c.key, value: c.expenseCents }))} symbol={currency} />
            <Line points={months.map((m) => ({ label: m.month, value: m.incomeCents - m.expenseCents }))} />
          </div>
        )}

        {ledger && attrs.mode === 'category' && (
          <div className="mt-3 space-y-3">
            <select
              value={attrs.categoryFocus}
              onChange={(e) => updateAttributes({ categoryFocus: e.target.value })}
              className="text-xs"
            >
              <option value="">Alle Hauptkategorien</option>
              {allCats.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Pie data={drill.map((c) => ({ label: c.key, value: c.expenseCents }))} symbol={currency} />
            <Bars data={drill.map((c) => ({ label: c.key, value: c.expenseCents }))} symbol={currency} />
            <table className="w-full text-xs">
              <thead className="text-gray-400">
                <tr>
                  <th className="text-left">Kategorie</th>
                  <th className="text-right">Ausgaben</th>
                  <th className="text-right">Anzahl</th>
                  <th className="text-right">Ø</th>
                </tr>
              </thead>
              <tbody>
                {drill.map((c) => (
                  <tr key={c.key} className="border-t border-gray-100 dark:border-gray-800">
                    <td>{c.key}</td>
                    <td className="text-right">{formatCents(c.expenseCents, currency)}</td>
                    <td className="text-right">{c.count}</td>
                    <td className="text-right">
                      {formatCents(c.count ? Math.round(c.expenseCents / c.count) : 0, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
