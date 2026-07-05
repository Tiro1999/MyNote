import { useEffect, useMemo, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useFinanceStore } from '../../finance/store'
import type { CategoryNode, Entry, EntryType } from '../../finance/model'
import { formatCents } from '../../finance/model'
import { computeAccountSaldos } from '../../finance/stats'
import ReferenceDataDialog from './ReferenceDataDialog'

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
// field-sizing:content makes text inputs grow to fit their own text, so the
// auto-layout table sizes each column to its widest value (bounded by min/max).
const field = 'bg-transparent [field-sizing:content] min-w-[3.5rem] max-w-[24rem]'
// Selects don't honour field-sizing reliably; let them take their natural width
// (as wide as the longest option) so the selected value is never clipped.
const selectField = 'bg-transparent max-w-[24rem]'

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
    deleteLedger
  } = useFinanceStore()
  const [refOpen, setRefOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft())

  useEffect(() => {
    loadReferenceData()
    loadLedger(ledgerId)
  }, [ledgerId, loadLedger, loadReferenceData])

  const ledger = ledgers[ledgerId]
  const categoryPaths = useMemo(() => flattenCategories(categories), [categories])
  const currency = ledger?.meta.currencySymbol ?? '€'
  const saldos = useMemo(
    () => (ledger ? computeAccountSaldos(ledger.entries, accounts) : []),
    [ledger, accounts]
  )

  const accountName = (id: string): string =>
    accounts.find((a) => a.id === id)?.name ?? '(gelöschtes Konto)'

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

  return (
    <NodeViewWrapper className="finance-ledger" contentEditable={false}>
      <div className="rounded-lg border border-gray-300 p-3 dark:border-gray-700">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">
            {ledger?.meta.name ?? 'Ledger'} <span className="text-gray-400">#{ledgerId}</span>
          </span>
          <div className="flex items-center gap-2">
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
                <th className={`${cell} text-left`}>Datum</th>
                <th className={`${cell} text-left`}>Typ</th>
                <th className={`${cell} text-right`}>Betrag</th>
                <th className={`${cell} text-left`}>Konto</th>
                <th className={`${cell} text-left`}>Kategorie</th>
                <th className={`${cell} text-left`}>Topic</th>
                <th className={`${cell} text-left`}>Tags</th>
                <th className={`${cell} w-6`}></th>
                <th className={`${cell} w-6`}></th>
              </tr>
            </thead>
            <tbody>
              {[...(ledger?.entries ?? [])].reverse().map((e) => (
                <tr key={e.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className={cell}>{e.pos}</td>
                  <td className={cell}>
                    <input
                      className={field}
                      type="date"
                      value={e.date}
                      onChange={(ev) => updateEntry(ledgerId, { ...e, date: ev.target.value })}
                    />
                  </td>
                  <td className={cell}>
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
                  <td className={`${cell} text-right`}>
                    <input
                      className={`${field} text-right`}
                      value={e.amount}
                      onChange={(ev) => updateEntry(ledgerId, { ...e, amount: ev.target.value })}
                    />
                  </td>
                  <td className={cell}>
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
                  <td className={cell}>
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
                  <td className={cell}>
                    <input
                      className={field}
                      value={e.topic}
                      onChange={(ev) => updateEntry(ledgerId, { ...e, topic: ev.target.value })}
                    />
                  </td>
                  <td className={cell}>
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
    </NodeViewWrapper>
  )
}
