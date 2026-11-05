import { useState } from 'react'
import { messageOf } from '@shared/errors'
import { Modal, buttonClass } from '@renderer/ui'
import ErrorBox from '../ErrorBox'
import { importLedgerCsv, importMoneyManager } from './transfer'
import type { TransferResult } from './transfer'

interface Props {
  open: boolean
  onClose: () => void
  ledgerId: string
}

type Source = 'moneymanager' | 'mynote'

interface Outcome {
  text: string
  failed: boolean
}

const IMPORTERS: Record<Source, (ledgerId: string) => Promise<TransferResult | null>> = {
  moneymanager: importMoneyManager,
  mynote: importLedgerCsv
}

const describeResult = ({ imported, skipped, createdAccounts, createdCategories }: TransferResult): string =>
  `${imported} entries imported · ${skipped} skipped · ` +
  `${createdAccounts} accounts and ${createdCategories} categories created.`

export default function ImportDialog({ open, onClose, ledgerId }: Props): React.JSX.Element | null {
  return open ? <ImportModal ledgerId={ledgerId} onClose={onClose} /> : null
}

function ImportModal({ ledgerId, onClose }: Omit<Props, 'open'>): React.JSX.Element {
  const [source, setSource] = useState<Source>('moneymanager')
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const runImport = async (): Promise<void> => {
    setBusy(true)
    setOutcome(null)
    try {
      const result = await IMPORTERS[source](ledgerId)
      setOutcome(result === null ? null : { text: describeResult(result), failed: false })
    } catch (error) {
      setOutcome({ text: messageOf(error), failed: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Import"
      size="md"
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <>
          <button type="button" className={buttonClass.secondary} disabled={busy} onClick={onClose}>
            Close
          </button>
          <button type="button" className={buttonClass.primary} disabled={busy} onClick={runImport}>
            {busy ? 'Importing…' : 'Choose file and import'}
          </button>
        </>
      }
    >
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Imports into this ledger (#{ledgerId}). A Money Manager import also creates the accounts and
        categories it needs.
      </p>

      <label className="mt-4 block text-sm text-gray-700 dark:text-gray-200">
        Source
        <select
          className="mt-1 block w-full rounded-sm border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-700"
          value={source}
          disabled={busy}
          onChange={(e) => setSource(e.target.value as Source)}
        >
          <option value="moneymanager">Money Manager (.xlsx)</option>
          <option value="mynote">MyNote (.csv)</option>
        </select>
      </label>

      {outcome?.failed && (
        <div className="mt-3">
          <ErrorBox>{outcome.text}</ErrorBox>
        </div>
      )}
      {outcome && !outcome.failed && (
        <div
          role="status"
          className="mt-3 rounded-sm bg-gray-100 p-2 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          {outcome.text}
        </div>
      )}
    </Modal>
  )
}
