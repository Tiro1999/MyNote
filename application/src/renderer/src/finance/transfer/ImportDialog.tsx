import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useFinanceStore } from '../store'
import { parseLedgerCsv } from '../csv'
import { mapMoneyManager } from './moneyManager'

interface Props {
  open: boolean
  onClose: () => void
  ledgerId: string
}

type Source = 'moneymanager' | 'mynote'

export default function ImportDialog({ open, onClose, ledgerId }: Props): JSX.Element | null {
  const { importEntries, ensureAccounts, ensureCategories, loadReferenceData } = useFinanceStore()
  const [source, setSource] = useState<Source>('moneymanager')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  if (!open) return null

  const runImport = async (): Promise<void> => {
    setBusy(true)
    setResult(null)
    try {
      if (source === 'mynote') {
        const text = await window.api.files.importText([{ name: 'MyNote CSV', extensions: ['csv'] }])
        if (text === null) return
        const parsed = parseLedgerCsv(text)
        const entries = parsed.map((e) => ({
          date: e.date,
          type: e.type,
          amount: e.amount,
          accountId: e.accountId,
          categoryPath: e.categoryPath,
          topic: e.topic,
          tags: e.tags,
          referenceLink: e.referenceLink
        }))
        await importEntries(ledgerId, entries)
        setResult(`${entries.length} Buchungen importiert.`)
      } else {
        const grid = await window.api.xlsx.importSheet()
        if (grid === null) return
        const { entries, accountNames, categoryPaths, skipped } = mapMoneyManager(grid)
        const nameToId = await ensureAccounts(accountNames)
        await ensureCategories(categoryPaths)
        const resolved = entries.map((e) => ({
          date: e.date,
          type: e.type,
          amount: e.amount,
          accountId: nameToId[e.accountName] ?? '',
          categoryPath: e.categoryPath,
          topic: e.topic,
          tags: e.tags,
          referenceLink: e.referenceLink
        }))
        await importEntries(ledgerId, resolved)
        await loadReferenceData()
        setResult(
          `${resolved.length} Buchungen importiert · ${skipped} übersprungen (Transfers/ungültig) · ` +
            `${accountNames.length} Konten und ${categoryPaths.length} Kategorien angelegt/ergänzt.`
        )
      }
    } catch (error) {
      setResult(`Import fehlgeschlagen: ${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Import</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Importiert in dieses Ledger (#{ledgerId}). Fehlende Konten und Kategorien werden dabei
          automatisch angelegt.
        </p>

        <label className="mt-4 block text-sm text-gray-700 dark:text-gray-200">
          Quelle
          <select
            className="mt-1 block w-full rounded-sm border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-700"
            value={source}
            onChange={(e) => setSource(e.target.value as Source)}
          >
            <option value="moneymanager">MoneyManager (.xlsx)</option>
            <option value="mynote">MyNote (.csv)</option>
          </select>
        </label>

        {result && (
          <div className="mt-3 rounded-sm bg-gray-100 p-2 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {result}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
            onClick={onClose}
          >
            Schließen
          </button>
          <button
            disabled={busy}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={runImport}
          >
            {busy ? 'Importiere…' : 'Datei wählen & importieren'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
