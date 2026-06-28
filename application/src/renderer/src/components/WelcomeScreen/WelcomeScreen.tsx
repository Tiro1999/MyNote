import { useNotebookStore } from '../../store/notebookStore'

export default function WelcomeScreen(): JSX.Element {
  const { setDataRoot } = useNotebookStore()

  const handleOpen = async (): Promise<void> => {
    const path = await window.api.dialog.openDirectory()
    if (path) await setDataRoot(path)
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-white">
      <div className="text-center max-w-md px-6">
        <h1 className="text-5xl font-bold text-gray-800 mb-3 tracking-tight">MyNote</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Your personal, customizable notebook. Choose a folder to store your notes — on your local
          disk, a network drive (NAS), or a cloud-synced folder.
        </p>
        <button
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium text-base shadow-sm"
          onClick={handleOpen}
        >
          Open or Create Notebook Folder
        </button>
        <p className="text-xs text-gray-400 mt-6 leading-relaxed">
          Double-click the canvas to add a text box
          <br />
          Ctrl+Scroll to zoom · Alt+Drag to pan
        </p>
      </div>
    </div>
  )
}
