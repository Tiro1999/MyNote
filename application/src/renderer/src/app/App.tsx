import { useEffect, useRef, useState } from 'react'
import { useNotebookStore } from '@renderer/notebook'
import { Sidebar } from '@renderer/notebook'
import { CanvasView } from '@renderer/canvas'
import { WelcomeScreen } from '@renderer/notebook'
import { ExternalLinkConfirmDialog } from '@renderer/editor'
import { SettingsButton, ThemeToggle } from '@renderer/settings'
import { ContextMenuHost, Toaster } from '@renderer/ui'

export default function App(): JSX.Element {
  const dataRoot = useNotebookStore((state) => state.dataRoot)
  const selection = useNotebookStore((state) => state.selection)
  const [copiedLinkUrl, setCopiedLinkUrl] = useState<string | null>(null)
  const dismissTimeout = useRef<ReturnType<typeof setTimeout>>()

  // No browser could open the link; main already copied it to the clipboard, so just show it
  useEffect(() => {
    const unsubscribe = window.api.links.onOpenFailed((url) => {
      setCopiedLinkUrl(url)
      clearTimeout(dismissTimeout.current)
      dismissTimeout.current = setTimeout(() => setCopiedLinkUrl(null), 5000)
    })

    return () => {
      unsubscribe()
      clearTimeout(dismissTimeout.current)
    }
  }, [])

  const actions = (
    <>
      <ThemeToggle />
      <SettingsButton />
    </>
  )

  if (!dataRoot) {
    return (
      <>
        <WelcomeScreen actions={actions} />
        <Toaster />
      </>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <Sidebar actions={actions} />
      <main className="flex-1 overflow-hidden">
        {selection ? (
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
      <ContextMenuHost />
      <Toaster />
    </div>
  )
}
