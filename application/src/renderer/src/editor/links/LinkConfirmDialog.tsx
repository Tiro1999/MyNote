import { useState } from 'react'
import { Modal, buttonClass } from '@renderer/ui'
import { useLinkStore } from './linkStore'

// Mounted only while a link waits, and keyed by its URL, so the checkbox starts unchecked every time
function PendingLinkDialog({ url }: { url: string }): React.JSX.Element {
  const confirmOpen = useLinkStore((state) => state.confirmOpen)
  const cancel = useLinkStore((state) => state.cancel)
  const [rememberChoice, setRememberChoice] = useState(false)

  return (
    <Modal
      title="Open External Link"
      onClose={cancel}
      footer={
        <>
          <button type="button" className={buttonClass.secondary} onClick={cancel}>
            Cancel
          </button>
          <button
            type="button"
            className={buttonClass.primary}
            onClick={() => confirmOpen(rememberChoice)}
          >
            Open Link
          </button>
        </>
      }
    >
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        This link will open outside MyNote in your default browser:
      </p>
      <p className="mt-2 break-all rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
        {url}
      </p>
      <label className="mt-4 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={rememberChoice}
          onChange={(e) => setRememberChoice(e.target.checked)}
          className="rounded-sm border-gray-300 dark:border-gray-600"
        />
        Don&apos;t ask again and remember my choice
      </label>
    </Modal>
  )
}

export default function LinkConfirmDialog(): React.JSX.Element | null {
  const pendingUrl = useLinkStore((state) => state.pendingUrl)
  return pendingUrl ? <PendingLinkDialog key={pendingUrl} url={pendingUrl} /> : null
}
