import { useState } from 'react'
import { useExternalLinkStore } from '../../store/externalLinkStore'

/**
 * Global confirmation dialog shown before opening a hyperlink clicked inside
 * a text box. Rendered once at the app root; driven entirely by
 * useExternalLinkStore so it can be triggered from TipTap's ProseMirror
 * click handler (ExternalLinkGuard.ts), not just from React event handlers.
 */
export default function ExternalLinkConfirmDialog(): JSX.Element | null {
  const pendingUrl = useExternalLinkStore((state) => state.pendingUrl)
  const confirmOpen = useExternalLinkStore((state) => state.confirmOpen)
  const cancel = useExternalLinkStore((state) => state.cancel)
  const [rememberChoice, setRememberChoice] = useState(false)

  if (!pendingUrl) return null

  const handleCancel = (): void => {
    setRememberChoice(false)
    cancel()
  }

  const handleConfirm = (): void => {
    confirmOpen(rememberChoice)
    setRememberChoice(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Open External Link</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          This link will open outside MyNote in your default browser:
        </p>
        <p className="mt-2 break-all rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
          {pendingUrl}
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          Don&apos;t ask again and remember my choice
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            onClick={handleConfirm}
          >
            Open Link
          </button>
        </div>
      </div>
    </div>
  )
}
