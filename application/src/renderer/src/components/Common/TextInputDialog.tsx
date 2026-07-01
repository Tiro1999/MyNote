import { useEffect, useRef, useState } from 'react'

interface Props {
  open: boolean
  title: string
  label: string
  confirmLabel?: string
  cancelLabel?: string
  initialValue?: string
  onCancel: () => void
  onConfirm: (value: string) => void | Promise<void>
}

export default function TextInputDialog({
  open,
  title,
  label,
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  initialValue = '',
  onCancel,
  onConfirm
}: Props): JSX.Element | null {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setValue(initialValue)
  }, [initialValue, open])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  if (!open) return null

  const trimmedValue = value.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trimmedValue) return
    await onConfirm(trimmedValue)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              disabled={!trimmedValue}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
