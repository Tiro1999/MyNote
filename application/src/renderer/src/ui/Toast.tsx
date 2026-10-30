import { createPortal } from 'react-dom'
import { create } from 'zustand'

type ToastKind = 'info' | 'error'

interface Toast {
  id: number
  message: string
  kind: ToastKind
}

const INFO_DURATION_MS = 4000

const KIND_CLASS: Record<ToastKind, string> = {
  info: 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900',
  error: 'bg-red-600 text-white'
}

let lastId = 0

export const useToastStore = create<{ toasts: Toast[] }>(() => ({ toasts: [] }))

export function notify(message: string, kind: ToastKind = 'info'): void {
  const { toasts } = useToastStore.getState()
  if (toasts.some((toast) => toast.message === message && toast.kind === kind)) return
  const id = ++lastId
  useToastStore.setState((state) => ({ toasts: [...state.toasts, { id, message, kind }] }))
  if (kind === 'info') setTimeout(() => dismissToast(id), INFO_DURATION_MS)
}

export function dismissToast(id: number): void {
  useToastStore.setState((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
}

export function Toaster(): React.JSX.Element {
  const toasts = useToastStore((state) => state.toasts)
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-60 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex max-w-xl items-start gap-3 rounded-md px-4 py-2 text-sm shadow-lg wrap-anywhere ${KIND_CLASS[toast.kind]}`}
        >
          <span>{toast.message}</span>
          {toast.kind === 'error' && (
            <button
              type="button"
              aria-label="Dismiss"
              className="shrink-0 opacity-80 hover:opacity-100"
              onClick={() => dismissToast(toast.id)}
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body
  )
}
