import { useEffect, useRef, useState } from 'react'
import { useNotebookStore } from './store/notebookStore'
import Sidebar from './components/Sidebar/Sidebar'
import CanvasView from './components/Canvas/CanvasView'
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen'
import ExternalLinkConfirmDialog from './components/Common/ExternalLinkConfirmDialog'

export default function App(): JSX.Element {
  const { dataRoot, activeContentId, isDarkMode } = useNotebookStore()
  const [copiedLinkUrl, setCopiedLinkUrl] = useState<string | null>(null)
  const dismissTimeout = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  // No browser available to open the link (e.g. headless dev container) —
  // the main process already copied it to the clipboard; just surface it.
  useEffect(() => {
    const unsubscribe = window.api.onExternalLinkOpenFailed((url) => {
      setCopiedLinkUrl(url)
      clearTimeout(dismissTimeout.current)
      dismissTimeout.current = setTimeout(() => setCopiedLinkUrl(null), 5000)
    })

    return () => {
      unsubscribe()
      clearTimeout(dismissTimeout.current)
    }
  }, [])

  if (!dataRoot) {
    return <WelcomeScreen />
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        {activeContentId ? (
          <CanvasView />
        ) : (
          <div className="flex h-full items-center justify-center text-lg text-gray-400 select-none dark:text-gray-500">
            Select or create a page to start
          </div>
        )}
      </main>
      {copiedLinkUrl && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-gray-900 px-4 py-2
                     text-sm text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
          role="status"
        >
          No browser available — link copied to clipboard: {copiedLinkUrl}
        </div>
      )}
      <ExternalLinkConfirmDialog />
    </div>
  )
}
