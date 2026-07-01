import { useNotebookStore } from '../../store/notebookStore'
import ThemeToggle from '../Common/ThemeToggle'

export default function WelcomeScreen(): JSX.Element {
  const { setDataRoot } = useNotebookStore()

  const handleOpen = async (): Promise<void> => {
    const path = await window.api.dialog.openDirectory()
    if (path) await setDataRoot(path)
  }

  return (
    <div className="relative flex h-screen w-screen items-center justify-center bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="text-center max-w-md px-6">
        <h1 className="mb-3 text-5xl font-bold tracking-tight text-gray-800 dark:text-gray-100">
          MyNote
        </h1>
        <p className="mb-8 leading-relaxed text-gray-500 dark:text-gray-400">
          Your personal, customizable notebook. Choose a folder to store your notes — on your local
          disk, a network drive (NAS), or a cloud-synced folder.
        </p>
        <button
          className="rounded-lg bg-blue-600 px-8 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800"
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
