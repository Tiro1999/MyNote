import { useEffect, useMemo, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useFinanceStore } from '../../finance/store'
import type { CategoryNode, Entry, EntryType } from '../../finance/model'
import { formatCents } from '../../finance/model'
import { serializeLedgerCsv } from '../../finance/csv'
import { computeAccountSaldos } from '../../finance/stats'
import type { Align, ColumnConfig } from '../../lib/columnConfig'
import { applyColumnFormat } from '../../lib/format'
import ReferenceDataDialog from './ReferenceDataDialog'
import ImportDialog from './ImportDialog'
import ColumnConfigPopover from '../Common/ColumnConfigPopover'

function flattenCategories(nodes: CategoryNode[], prefix = ''): string[] {
  return nodes.flatMap((n) => {
    const path = prefix ? `${prefix}/${n.name}` : n.name
    return [path, ...flattenCategories(n.children, path)]
  })
}

const emptyDraft = (): Omit<Entry, 'id' | 'pos'> => ({
  date: new Date().toISOString().slice(0, 10),
  type: 'expense',
  amount: '',
  accountId: '',
  categoryPath: '',
  topic: '',
  tags: [],
  referenceLink: ''
})

const cell = 'px-2 py-0.5 align-middle whitespace-nowrap'
const field = 'bg-transparent [field-sizing:content] min-w-[3.5rem] max-w-[24rem]'
const selectField = 'bg-transparent max-w-[24rem]'

// Configurable columns (the '#', link and delete columns stay structural).
const LEDGER_COLUMNS: { id: string; label: string }[] = [
  { id: 'date', label: 'Datum' },
  { id: 'type', label: 'Typ' },
  { id: 'amount', label: 'Betrag' },
  { id: 'account', label: 'Konto' },
  { id: 'category', label: 'Kategorie' },
  { id: 'topic', label: 'Topic' },
  { id: 'tags', label: 'Tags' }
]

const alignClass = (a: Align | undefined): string =>
  a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left'

// Displays the column-formatted value when not focused, and the raw editable
// text while focused — non-destructive display formatting.
function FormattedInput({
  value,
  col,
  className,
  onCommit
}: {
  value: string
  col: ColumnConfig
  className: string
  onCommit: (raw: string) => void
}): JSX.Element {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(value)
  return (
    <input
      className={className}
      value={focused ? draft : applyColumnFormat(value, col)}
      onFocus={() => {
        setDraft(value)
        setFocused(true)
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false)
        if (draft !== value) onCommit(draft)
      }}
    />
  )
}

export default function LedgerBlock({ node, deleteNode }: NodeViewProps): JSX.Element {
  const ledgerId = node.attrs.ledgerId as string
  const {
    ledgers,
    accounts,
    categories,
    loadLedger,
    loadReferenceData,
    addEntry,
    updateEntry,
    deleteEntry,
    deleteLedger,
    saveLedgerColumns
  } = useFinanceStore()
  const [refOpen, setRefOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [configCol, setConfigCol] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft())

  useEffect(() => {
    loadReferenceData()
    loadLedger(ledgerId)
  }, [ledgerId, loadLedger, loadReferenceData])

  const ledger = ledgers[ledgerId]
  const categoryPaths = useMemo(() => flattenCategories(categories), [categories])
  const currency = ledger?.meta.currencySymbol ?? '€'
  const columns = ledger?.meta.columns ?? {}
  const saldos = useMemo(
    () => (ledger ? computeAccountSaldos(ledger.entries, accounts) : []),
    [ledger, accounts]
  )

  const accountName = (id: string): string =>
    accounts.find((a) => a.id === id)?.name ?? '(gelöschtes Konto)'

  // Only the amount column carries a real display type (number); the rest are
  // alignment/width only (the native date picker keeps its own display).
  const colConfig = (id: string): ColumnConfig => {
    const base = columns[id] ?? {}
    if (id === 'amount') {
      return {
        ...base,
        type: 'number',
        number: base.number ?? {
          decimals: 2,
          thousands: true,
          currencySymbol: currency,
          symbolPosition: 'after'
        }
      }
    }
    return { ...base, type: 'text' }
  }
  const updateColConfig = (id: string, next: ColumnConfig): void => {
    saveLedgerColumns(ledgerId, { ...columns, [id]: next })
  }
  const startResize = (id: string, startX: number, startWidth: number): void => {
    const move = (ev: MouseEvent): void => {
      const width = Math.max(48, startWidth + (ev.clientX - startX))
      saveLedgerColumns(ledgerId, { ...columns, [id]: { ...(columns[id] ?? {}), width } })
    }
    const up = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const renderHeader = (id: string, label: string): JSX.Element => (
    <th
      key={id}
      className={`${cell} relative ${alignClass(columns[id]?.align)}`}
      style={columns[id]?.width ? { width: columns[id]?.width } : undefined}
    >
      <button className="hover:underline" onClick={() => setConfigCol(id)} title="Spalte konfigurieren">
        {label} ▾
      </button>
      <span
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none"
        onMouseDown={(e) => {
          e.preventDefault()
          startResize(id, e.clientX, (e.currentTarget.parentElement as HTMLElement).offsetWidth)
        }}
      />
    </th>
  )

  const pickInvoice = async (apply: (path: string) => void): Promise<void> => {
    const path = await window.api.dialog.openFile([
      { name: 'Belege', extensions: ['pdf', 'png', 'jpg', 'jpeg'] }
    ])
    if (path) apply(path)
  }

  const submit = async (): Promise<void> => {
    if (!draft.amount || !draft.accountId) return
    await addEntry(ledgerId, draft)
    setDraft(emptyDraft())
  }

  const handleDeleteLedger = async (): Promise<void> => {
    if (!window.confirm(`Ledger #${ledgerId} und seine Datendatei endgültig löschen?`)) return
    await deleteLedger(ledgerId)
    deleteNode()
  }

  const handleExport = async (): Promise<void> => {
    if (!ledger) return
    const path = await window.api.dialog.saveFile({
      defaultPath: `${ledger.meta.name || 'ledger'}-${ledgerId}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (path) await window.api.fs.writeFile(path, serializeLedgerCsv(ledger.entries))
  }

  return (
    <NodeViewWrapper className="finance-ledger" contentEditable={false}>
      <div className="rounded-lg border border-gray-300 p-3 dark:border-gray-700">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">
            {ledger?.meta.name ?? 'Ledger'} <span className="text-gray-400">#{ledgerId}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              onClick={() => setImportOpen(true)}
            >
              Import
            </button>
            <button
              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              onClick={handleExport}
            >
              Export
            </button>
            <button
              className="rounded border border-gray-300 px-2 py-1 text-xs text-blue-600 hover:bg-gray-50 dark:border-gray-700 dark:text-blue-400 dark:hover:bg-gray-800"
              onClick={() => setRefOpen(true)}
            >
              Konten/Kategorien verwalten
            </button>
            <button
              className="rounded border border-gray-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-gray-700 dark:hover:bg-red-950"
              onClick={handleDeleteLedger}
            >
              Ledger löschen
            </button>
          </div>
        </div>

        <div className="max-h-96 overflow-auto">
          <table className="w-full table-auto border-collapse text-xs">
            <thead className="text-gray-400">
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className={`${cell} w-8 text-left`}>#</th>
                {LEDGER_COLUMNS.map((c) => renderHeader(c.id, c.label))}
                <th className={`${cell} w-6`}></th>
                <th className={`${cell} w-6`}></th>
              </tr>
            </thead>
            <tbody>
              {[...(ledger?.entries ?? [])].reverse().map((e) => (
                <tr key={e.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className={cell}>{e.pos}</td>
                  <td className={`${cell} ${alignClass(columns['date']?.align)}`}>
                    <input
                      className={field}
                      type="date"
                      value={e.date}
                      onChange={(ev) => updateEntry(ledgerId, { ...e, date: ev.target.value })}
                    />
                  </td>
                  <td className={`${cell} ${alignClass(columns['type']?.align)}`}>
                    <select
                      className={selectField}
                      value={e.type}
                      onChange={(ev) =>
                        updateEntry(ledgerId, { ...e, type: ev.target.value as EntryType })
                      }
                    >
                      <option value="expense">Ausgabe</option>
                      <option value="income">Einnahme</option>
                    </select>
                  </td>
                  <td className={`${cell} ${alignClass(columns['amount']?.align ?? 'right')}`}>
                    <FormattedInput
                      className={`${field} ${columns['amount']?.align === 'left' ? '' : 'text-right'}`}
                      value={e.amount}
                      col={colConfig('amount')}
                      onCommit={(raw) => updateEntry(ledgerId, { ...e, amount: raw })}
                    />
                  </td>
                  <td className={`${cell} ${alignClass(columns['account']?.align)}`}>
                    <select
                      className={selectField}
                      value={e.accountId}
                      onChange={(ev) => updateEntry(ledgerId, { ...e, accountId: ev.target.value })}
                    >
                      <option value="">{accountName(e.accountId)}</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`${cell} ${alignClass(columns['category']?.align)}`}>
                    <select
                      className={selectField}
                      value={e.categoryPath}
                      onChange={(ev) =>
                        updateEntry(ledgerId, { ...e, categoryPath: ev.target.value })
                      }
                    >
                      <option value="">—</option>
                      {categoryPaths.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`${cell} ${alignClass(columns['topic']?.align)}`}>
                    <input
                      className={field}
                      value={e.topic}
                      onChange={(ev) => updateEntry(ledgerId, { ...e, topic: ev.target.value })}
                    />
                  </td>
                  <td className={`${cell} ${alignClass(columns['tags']?.align)}`}>
                    <input
                      className={field}
                      value={e.tags.join(',')}
                      onChange={(ev) =>
                        updateEntry(ledgerId, {
                          ...e,
                          tags: ev.target.value
                            .split(',')
                            .map((t) => t.trim())
                            .filter(Boolean)
                        })
                      }
                    />
                  </td>
                  <td className={`${cell} text-center`}>
                    <button
                      title="Beleg verknüpfen"
                      onClick={() =>
                        pickInvoice((p) => updateEntry(ledgerId, { ...e, referenceLink: p }))
                      }
                    >
                      {e.referenceLink ? '📎' : '🔗'}
                    </button>
                  </td>
                  <td className={`${cell} text-center`}>
                    <button className="text-red-600" onClick={() => deleteEntry(ledgerId, e.id)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 dark:border-gray-700">
                <td className={`${cell} text-gray-400`}>＋</td>
                <td className={cell}>
                  <input
                    className={field}
                    type="date"
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  />
                </td>
                <td className={cell}>
                  <select
                    className={selectField}
                    value={draft.type}
                    onChange={(e) => setDraft({ ...draft, type: e.target.value as EntryType })}
                  >
                    <option value="expense">Ausgabe</option>
                    <option value="income">Einnahme</option>
                  </select>
                </td>
                <td className={`${cell} text-right`}>
                  <input
                    className={`${field} text-right`}
                    placeholder="0,00"
                    value={draft.amount}
                    onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  />
                </td>
                <td className={cell}>
                  <select
                    className={selectField}
                    value={draft.accountId}
                    onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}
                  >
                    <option value="">Konto…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={cell}>
                  <select
                    className={selectField}
                    value={draft.categoryPath}
                    onChange={(e) => setDraft({ ...draft, categoryPath: e.target.value })}
                  >
                    <option value="">Kategorie…</option>
                    {categoryPaths.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={cell}>
                  <input
                    className={field}
                    placeholder="Topic"
                    value={draft.topic}
                    onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
                  />
                </td>
                <td className={cell}>
                  <input
                    className={field}
                    placeholder="tag1,tag2"
                    value={draft.tags.join(',')}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        tags: e.target.value
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean)
                      })
                    }
                  />
                </td>
                <td className={cell}></td>
                <td className={cell}></td>
              </tr>
              <tr>
                <td colSpan={10} className="px-2 pt-2">
                  <button
                    className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
                    onClick={submit}
                  >
                    + Buchung hinzufügen
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {accounts.length === 0 && (
          <div className="mt-2 text-xs text-amber-600 dark:text-amber-500">
            Noch keine Konten angelegt — über „Konten/Kategorien verwalten“ hinzufügen, dann lassen
            sich Buchungen einem Konto zuordnen.
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-3 border-t border-gray-200 pt-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {saldos.map((s) => (
            <span key={s.accountId}>
              {s.name}: <strong>{formatCents(s.saldoCents, currency)}</strong>
            </span>
          ))}
        </div>
      </div>
      <ReferenceDataDialog open={refOpen} onClose={() => setRefOpen(false)} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} ledgerId={ledgerId} />
      {configCol && (
        <ColumnConfigPopover
          open={true}
          title={LEDGER_COLUMNS.find((c) => c.id === configCol)?.label ?? configCol}
          value={colConfig(configCol)}
          allowType={false}
          onChange={(next) => updateColConfig(configCol, next)}
          onResetWidth={() =>
            updateColConfig(configCol, { ...colConfig(configCol), width: undefined })
          }
          onClose={() => setConfigCol(null)}
        />
      )}
    </NodeViewWrapper>
  )
}
