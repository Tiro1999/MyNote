import { useEffect } from 'react'
import { LinkConfirmDialog, onLinkOpenFailed } from '@renderer/editor'
import { Sidebar, WelcomeScreen, useNotebookStore } from '@renderer/notebook'
import { SettingsButton, ThemeToggle } from '@renderer/settings'
import { ContextMenuHost, Toaster, notify } from '@renderer/ui'
import { ContentArea } from './ContentArea'

const actions = (
  <>
    <ThemeToggle />
    <SettingsButton />
  </>
)

export default function App(): React.JSX.Element {
  const dataRoot = useNotebookStore((state) => state.dataRoot)

  useEffect(
    () =>
      onLinkOpenFailed((url) => notify(`No browser available — link copied to clipboard: ${url}`)),
    []
  )

  return (
    <>
      {dataRoot ? (
        <div className="flex h-screen w-screen overflow-hidden bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
          <Sidebar actions={actions} />
          <main className="flex-1 overflow-hidden">
            <ContentArea />
          </main>
        </div>
      ) : (
        <WelcomeScreen actions={actions} />
      )}
      <LinkConfirmDialog />
      <ContextMenuHost />
      <Toaster />
    </>
  )
}
