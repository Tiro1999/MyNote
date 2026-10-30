import { useState } from 'react'
import { SettingsDialog } from './SettingsDialog'

export function SettingsButton(): React.JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        title="Settings"
        aria-label="Settings"
        className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">⚙️</span>
      </button>
      {open && <SettingsDialog onClose={() => setOpen(false)} />}
    </>
  )
}
