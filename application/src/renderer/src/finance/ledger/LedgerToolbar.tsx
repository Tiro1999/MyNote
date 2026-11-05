import { useState } from 'react'
import { messageOf } from '@shared/errors'
import { ConfirmDialog, notify } from '@renderer/ui'
import ReferenceDataDialog from '../reference-data/ReferenceDataDialog'
import ImportDialog from '../transfer/ImportDialog'
import { exportLedgerCsv } from '../transfer/transfer'
import { deleteDialog, removeLedgerBlock } from './removal'

type Dialog = 'import' | 'reference' | 'delete'

const BUTTON =
  'rounded-sm border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800'
const BLUE = 'text-blue-600 dark:text-blue-400'
const RED = 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950'

interface Props {
  ledgerId: string
  name: string
  // False while the ledger loads or could not be read: only Delete stays
  readable: boolean
  onDeleted: () => void
}

export default function LedgerToolbar({ ledgerId, name, readable, onDeleted }: Props): React.JSX.Element {
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const close = (): void => setDialog(null)

  const exportCsv = async (): Promise<void> => {
    setExporting(true)
    try {
      await exportLedgerCsv(ledgerId)
    } catch (error) {
      notify(`Export failed: ${messageOf(error)}`, 'error')
    } finally {
      setExporting(false)
    }
  }

  const remove = async (): Promise<void> => {
    setDeleting(true)
    try {
      await removeLedgerBlock(ledgerId, onDeleted)
    } catch (error) {
      notify(`Could not delete ledger: ${messageOf(error)}`, 'error')
      setDeleting(false)
      close()
    }
  }

  return (
    <div className="flex items-center gap-2">
      {readable && (
        <>
          <button type="button" className={BUTTON} onClick={() => setDialog('import')}>
            Import
          </button>
          <button type="button" className={BUTTON} disabled={exporting} onClick={exportCsv}>
            Export
          </button>
          <button type="button" className={`${BUTTON} ${BLUE}`} onClick={() => setDialog('reference')}>
            Reference data
          </button>
        </>
      )}
      <button type="button" className={`${BUTTON} ${RED}`} onClick={() => setDialog('delete')}>
        Delete
      </button>
      <ImportDialog open={dialog === 'import'} onClose={close} ledgerId={ledgerId} />
      {dialog === 'reference' && <ReferenceDataDialog onClose={close} />}
      {dialog === 'delete' && (
        <ConfirmDialog {...deleteDialog(ledgerId, name)} danger busy={deleting} onConfirm={remove} onCancel={close} />
      )}
    </div>
  )
}
