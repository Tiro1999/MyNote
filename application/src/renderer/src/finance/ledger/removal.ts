import { isValidId } from '@renderer/storage'
import { useFinanceStore } from '../store'

interface DeleteDialog {
  title: string
  message: string
  confirmLabel: string
}

// A block without a valid ledger id has no file, so removing it only takes the block out of the page
export function deleteDialog(ledgerId: string, name: string): DeleteDialog {
  if (!isValidId(ledgerId)) {
    return {
      title: 'Remove block',
      message: 'Remove this block? It has no valid ledger id, so no file is deleted.',
      confirmLabel: 'Remove'
    }
  }
  return {
    title: 'Delete ledger',
    message: `Delete ledger "${name}" (#${ledgerId}) and its data file permanently?`,
    confirmLabel: 'Delete'
  }
}

// The only deletion of a ledger in the app; the block stays when the deletion rejects
export async function removeLedgerBlock(ledgerId: string, onDeleted: () => void): Promise<void> {
  if (isValidId(ledgerId)) await useFinanceStore.getState().deleteLedger(ledgerId)
  onDeleted()
}
