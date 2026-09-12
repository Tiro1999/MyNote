import { useEffect, useRef, useState } from 'react'
import { useExternalImageStore } from '../../store/externalImageStore'

/**
 * Collects a web address for `/Bild aus URL`. Rendered once at the app root and driven
 * entirely by useExternalImageStore, so it can be opened from the slash command's
 * vanilla-JS context — the same arrangement ExternalLinkConfirmDialog uses.
 */
export default function ImageUrlDialog(): JSX.Element | null {
  const pendingPrompt = useExternalImageStore((state) => state.pendingPrompt)
  const submitPrompt = useExternalImageStore((state) => state.submitPrompt)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!pendingPrompt) return
    setValue('')
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [pendingPrompt])

  if (!pendingPrompt) return null

  const trimmed = value.trim()
  const isValid = /^https?:\/\/\S+$/i.test(trimmed)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-url-dialog-title"
      >
        <h2
          id="image-url-dialog-title"
          className="text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          Bild aus URL
        </h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (isValid) submitPrompt(trimmed)
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
              Webadresse des Bildes
            </span>
            <input
              ref={inputRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Das Bild wird erst beim Anzeigen geladen — und nur, wenn du externe Bilder erlaubst.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              onClick={() => submitPrompt(null)}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Einfügen
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
