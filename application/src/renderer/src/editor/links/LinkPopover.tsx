import { useState } from 'react'
import type { Editor } from '@tiptap/core'
import { applyLinkInput } from './linkInput'

interface Props {
  editor: Editor
  onClose: () => void
}

export default function LinkPopover({ editor, onClose }: Props): React.JSX.Element {
  const [value, setValue] = useState<string>(() => editor.getAttributes('link').href ?? '')
  const [rejected, setRejected] = useState(false)

  const submit = (): void => {
    if (applyLinkInput(editor, value)) onClose()
    else setRejected(true)
  }

  return (
    <div
      className="absolute left-0 top-full z-50 mt-1 rounded-md border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div className="flex gap-1">
        <input
          autoFocus
          type="url"
          aria-label="Link URL"
          placeholder="https://…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setRejected(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          className="w-48 rounded-sm border border-gray-300 bg-white px-2 py-0.5 text-xs outline-hidden focus:border-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <button
          type="button"
          className="rounded-sm bg-blue-500 px-2 py-0.5 text-xs text-white hover:bg-blue-600"
          onClick={submit}
        >
          OK
        </button>
        <button
          type="button"
          aria-label="Close"
          className="rounded-sm px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      {rejected && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          Enter a web address or a mailto: link.
        </p>
      )}
    </div>
  )
}
