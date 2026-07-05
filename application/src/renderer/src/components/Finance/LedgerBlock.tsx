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

export default function LedgerBlock({ node }: NodeViewProps): JSX.Element {
  const ledgerId = node.attrs.ledgerId as string
  const {
    ledgers,
    accounts,
    categories,
    loadLedger,
    loadReferenceData,
    addEntry,
    updateEntry,
    deleteEntry
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

  return (
    <NodeViewWrapper className="finance-ledger" contentEditable={false}>
      <div className="rounded-lg border border-gray-300 p-3 dark:border-gray-700">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">
            {ledger?.meta.name ?? 'Ledger'} <span className="text-gray-400">#{ledgerId}</span>
          </span>
          <button
            className="text-xs text-blue-600 dark:text-blue-400"
            onClick={() => setRefOpen(true)}
          >
            Konten/Kategorien
          </button>
        </div>

        <div className="max-h-80 overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-400">
              <tr>
                <th className="text-left">#</th>
                <th className="text-left">Datum</th>
                <th className="text-left">Typ</th>
                <th className="text-right">Betrag</th>
                <th className="text-left">Konto</th>
                <th className="text-left">Kategorie</th>
                <th className="text-left">Topic</th>
                <th className="text-left">Tags</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...(ledger?.entries ?? [])].reverse().map((e) => (
                <tr key={e.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td>{e.pos}</td>
                  <td>
                    <input
                      type="date"
                      value={e.date}
                      onChange={(ev) => updateEntry(ledgerId, { ...e, date: ev.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={e.type}
                      onChange={(ev) =>
                        updateEntry(ledgerId, { ...e, type: ev.target.value as EntryType })
                      }
                    >
                      <option value="expense">Ausgabe</option>
                      <option value="income">Einnahme</option>
                    </select>
                  </td>
                  <td className="text-right">
                    <input
                      className="w-16 text-right"
                      value={e.amount}
                      onChange={(ev) => updateEntry(ledgerId, { ...e, amount: ev.target.value })}
                    />
                  </td>
                  <td>
                    <select
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
                  <td>
                    <select
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
                  <td>
                    <input
                      value={e.topic}
                      onChange={(ev) => updateEntry(ledgerId, { ...e, topic: ev.target.value })}
                    />
                  </td>
                  <td>
                    <input
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
                  <td>
                    <button
                      title="Beleg verknüpfen"
                      onClick={() =>
                        pickInvoice((p) => updateEntry(ledgerId, { ...e, referenceLink: p }))
                      }
                    >
                      {e.referenceLink ? '📎' : '🔗'}
                    </button>
                  </td>
                  <td>
                    <button className="text-red-600" onClick={() => deleteEntry(ledgerId, e.id)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-gray-200 pt-2 text-xs dark:border-gray-800">
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          />
          <select
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value as EntryType })}
          >
            <option value="expense">Ausgabe</option>
            <option value="income">Einnahme</option>
          </select>
          <input
            className="w-16"
            placeholder="Betrag"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
          />
          <select
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
          <select
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
          <input
            placeholder="Topic"
            value={draft.topic}
            onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
          />
          <button className="rounded bg-blue-600 px-2 py-1 text-white" onClick={submit}>
            + Buchung
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
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
