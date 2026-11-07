import { createContext, useState } from 'react'
import { ConfirmDialog, TextInputDialog } from '@renderer/ui'
import type { ContentKind } from '../model'
import { useNotebookStore } from '../store'

type NodeKind = 'notebook' | ContentKind

export type SidebarDialog =
  | { type: 'addNotebook' }
  | { type: 'addSection'; notebookId: string }
  | { type: 'rename'; kind: NodeKind; id: string; name: string }
  | { type: 'delete'; kind: ContentKind; id: string; name: string }

export const NOUN: Record<NodeKind, string> = { notebook: 'notebook', section: 'chapter', page: 'page' }
export const CHILD_NOUN: Record<ContentKind, string> = { section: 'page', page: 'subpage' }

// Lets the tree nodes open a dialog without passing a callback through every level
export const OpenDialogContext = createContext<(dialog: SidebarDialog) => void>(() => undefined)

function rename(kind: NodeKind, id: string, name: string): Promise<void> {
  const store = useNotebookStore.getState()
  if (kind === 'notebook') return store.renameNotebook(id, name)
  return kind === 'section' ? store.renameSection(id, name) : store.renamePage(id, name)
}

interface DeleteDialogProps {
  dialog: Extract<SidebarDialog, { type: 'delete' }>
  onClose(): void
}

// Busy while the delete runs, so a second click cannot delete again
function DeleteDialog({ dialog, onClose }: DeleteDialogProps): React.JSX.Element {
  const { kind, id, name } = dialog
  const [busy, setBusy] = useState(false)

  const confirm = async (): Promise<void> => {
    setBusy(true)
    const store = useNotebookStore.getState()
    await (kind === 'section' ? store.deleteSection(id) : store.deletePage(id))
    onClose()
  }

  return (
    <ConfirmDialog
      title={`Delete ${NOUN[kind]}`}
      message={`Delete ${NOUN[kind]} "${name}" and all of its ${CHILD_NOUN[kind]}s? This cannot be undone.`}
      confirmLabel="Delete"
      danger
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    />
  )
}

interface SidebarDialogViewProps {
  dialog: SidebarDialog
  onClose(): void
}

export function SidebarDialogView({ dialog, onClose }: SidebarDialogViewProps): React.JSX.Element {
  switch (dialog.type) {
    case 'addNotebook':
      return (
        <TextInputDialog
          title="Create notebook"
          placeholder="Notebook name"
          confirmLabel="Create"
          onCancel={onClose}
          onConfirm={async (name) => {
            await useNotebookStore.getState().addNotebook(name)
            onClose()
          }}
        />
      )
    case 'addSection':
      return (
        <TextInputDialog
          title="Create chapter"
          placeholder="Chapter name"
          confirmLabel="Create"
          onCancel={onClose}
          onConfirm={async (name) => {
            await useNotebookStore.getState().addSection(dialog.notebookId, name)
            onClose()
          }}
        />
      )
    case 'rename':
      return (
        <TextInputDialog
          title={`Rename ${NOUN[dialog.kind]}`}
          placeholder="Name"
          confirmLabel="Rename"
          initialValue={dialog.name}
          onCancel={onClose}
          onConfirm={async (name) => {
            await rename(dialog.kind, dialog.id, name)
            onClose()
          }}
        />
      )
    case 'delete':
      return <DeleteDialog dialog={dialog} onClose={onClose} />
  }
}
