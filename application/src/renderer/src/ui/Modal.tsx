import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { buttonClass } from './buttons'
import { pushEscapeHandler } from './escapeStack'

type ModalSize = 'sm' | 'md' | 'lg'

const PANEL_WIDTH: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg'
}

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  size?: ModalSize
}

// React events bubble through a portal along the React tree, so the modal stops them before its opener sees them
function stopPropagation(e: React.SyntheticEvent): void {
  e.stopPropagation()
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  size = 'sm'
}: ModalProps): React.JSX.Element {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const pressedOnBackdrop = useRef(false)
  const onCloseRef = useRef(onClose)

  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  // Pushed once on mount, so a re-render never moves this modal above one opened later
  useEffect(() => pushEscapeHandler(window, () => onCloseRef.current()), [])

  useEffect(() => {
    const panel = panelRef.current
    if (panel && !panel.contains(document.activeElement)) panel.focus()
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onPointerDown={(e) => {
        e.stopPropagation()
        pressedOnBackdrop.current = e.target === e.currentTarget
      }}
      onMouseDown={(e) => {
        e.stopPropagation()
        // A press on the backdrop keeps the focus in the modal, so Tab stays in it
        if (e.target === e.currentTarget) e.preventDefault()
      }}
      onClick={(e) => {
        e.stopPropagation()
        // A press that starts in the panel, e.g. a text selection, never closes the modal
        if (pressedOnBackdrop.current && e.target === e.currentTarget) onClose()
      }}
      onDoubleClick={stopPropagation}
      onContextMenu={stopPropagation}
      onWheel={stopPropagation}
      onKeyDown={stopPropagation}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`max-h-[80vh] w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl outline-hidden dark:border-gray-700 dark:bg-gray-900 ${PANEL_WIDTH[size]}`}
      >
        <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        {children}
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!busy) onCancel()
      }}
      footer={
        <>
          <button type="button" className={buttonClass.secondary} disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? buttonClass.danger : buttonClass.primary}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{message}</p>
    </Modal>
  )
}

interface TextInputDialogProps {
  title: string
  initialValue?: string
  placeholder?: string
  confirmLabel: string
  onConfirm: (value: string) => void | Promise<void>
  onCancel: () => void
}

export function TextInputDialog({
  title,
  initialValue = '',
  placeholder,
  confirmLabel,
  onConfirm,
  onCancel
}: TextInputDialogProps): React.JSX.Element {
  const formId = useId()
  const [value, setValue] = useState(initialValue)
  const [confirming, setConfirming] = useState(false)
  const trimmed = value.trim()

  const confirm = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!trimmed || confirming) return
    setConfirming(true)
    try {
      await onConfirm(trimmed)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={buttonClass.secondary} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            className={buttonClass.primary}
            disabled={!trimmed || confirming}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <form id={formId} className="mt-4" onSubmit={confirm}>
        <input
          autoFocus
          aria-label={title}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-hidden transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900"
        />
      </form>
    </Modal>
  )
}
