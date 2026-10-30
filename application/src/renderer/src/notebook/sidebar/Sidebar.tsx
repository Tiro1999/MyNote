import { useState } from 'react'
import { openContextMenu } from '@renderer/ui'
import type { Notebook } from '../model'
import { useNotebookStore } from '../store'
import { OpenDialogContext, SidebarDialogView, type SidebarDialog } from './SidebarDialog'
import { NotebookTree } from './Tree'

export function Sidebar({ actions }: { actions: React.ReactNode }): React.JSX.Element {
  const notebooks = useNotebookStore((state) => state.notebooks)
  const activeNotebookId = useNotebookStore((state) => state.activeNotebookId)
  const [dialog, setDialog] = useState<SidebarDialog | null>(null)

  // A dialog that finishes late must not close a dialog opened after it
  const close = (closed: SidebarDialog): void =>
    setDialog((current) => (current === closed ? null : current))

  const openNotebookMenu = (e: React.MouseEvent, notebook: Notebook): void => {
    e.preventDefault()
    openContextMenu(e.clientX, e.clientY, [
      {
        label: 'Rename',
        onSelect: () => setDialog({ type: 'rename', kind: 'notebook', id: notebook.id, name: notebook.name })
      }
    ])
  }

  return (
    <OpenDialogContext.Provider value={setDialog}>
      <aside className="flex h-full w-60 shrink-0 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Notebooks</span>
          <div className="flex items-center gap-2">
            {actions}
            <button
              type="button"
              className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              onClick={() => setDialog({ type: 'addNotebook' })}
            >
              + New
            </button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto">
          {notebooks.map((notebook) => (
            <div key={notebook.id}>
              <button
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  activeNotebookId === notebook.id
                    ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-200'
                }`}
                onClick={() => useNotebookStore.getState().setActiveNotebook(notebook.id)}
                onContextMenu={(e) => openNotebookMenu(e, notebook)}
              >
                <span className="h-3 w-3 shrink-0 rounded-xs" style={{ backgroundColor: notebook.color }} />
                <span className="truncate">{notebook.name}</span>
              </button>
              {activeNotebookId === notebook.id && <NotebookTree notebook={notebook} />}
            </div>
          ))}
        </nav>
      </aside>
      {dialog && <SidebarDialogView dialog={dialog} onClose={() => close(dialog)} />}
    </OpenDialogContext.Provider>
  )
}
