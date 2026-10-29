import { useState } from 'react'
import { useNotebookStore } from './store'
// eslint-disable-next-line no-restricted-imports -- removed in phase 4
import { ThemeToggle } from '@renderer/settings'
// eslint-disable-next-line no-restricted-imports -- removed in phase 4
import { SettingsDialog } from '@renderer/settings'

export default function WelcomeScreen(): JSX.Element {
  const { setDataRoot } = useNotebookStore()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleOpen = async (): Promise<void> => {
    const path = await window.api.dialogs.openNotebookFolder()
    if (path) await setDataRoot(path)
  }

  return (
    <div className="relative flex h-screen w-screen items-center justify-center bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <ThemeToggle />
        <button
          type="button"
          title="Settings"
          aria-label="Settings"
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          onClick={() => setSettingsOpen(true)}
        >
          <span aria-hidden="true">⚙️</span>
        </button>
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <div className="text-center max-w-md px-6">
        <h1 className="mb-3 text-5xl font-bold tracking-tight text-gray-800 dark:text-gray-100">
          MyNote
        </h1>
        <p className="mb-8 leading-relaxed text-gray-500 dark:text-gray-400">
          Your personal, customizable notebook. Choose a folder to store your notes — on your local
          disk, a network drive (NAS), or a cloud-synced folder.
        </p>
        <button
          className="rounded-lg bg-blue-600 px-8 py-3 text-base font-medium text-white shadow-xs transition-colors hover:bg-blue-700 active:bg-blue-800"
          onClick={handleOpen}
        >
          Open or Create Notebook Folder
        </button>
        <p className="mt-6 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
          Double-click the canvas to add a text box
          <br />
          Ctrl+Scroll to zoom · Alt+Drag to pan
        </p>
      </div>
    </div>
  )
}
