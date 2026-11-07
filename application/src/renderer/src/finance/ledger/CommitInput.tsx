import { useEffect, useId, useRef, useState } from 'react'
import { normalizeAmount, parseTags } from '../model'

export type Validation = { value: string } | { error: string }
// Gives the normalized text to store, or the message to show next to the input
export type Validate = (raw: string) => Validation

export type CommitResult =
  | { kind: 'unchanged' }
  | { kind: 'commit'; value: string }
  | { kind: 'invalid'; message: string }

const UNCHANGED: CommitResult = { kind: 'unchanged' }

// What to do with the text of an input that lost the focus; the typed text is never stored as it is when a validator exists
export function resolveCommit(raw: string, stored: string, validate?: Validate): CommitResult {
  if (raw === stored) return UNCHANGED
  const checked: Validation = validate ? validate(raw) : { value: raw }
  if ('error' in checked) return { kind: 'invalid', message: checked.error }
  return checked.value === stored ? UNCHANGED : { kind: 'commit', value: checked.value }
}

const amountValidator =
  (allowNegative: boolean, error: string): Validate =>
  (raw) => {
    const value = normalizeAmount(raw, allowNegative)
    return value === null ? { error } : { value }
  }

export const positiveAmount = amountValidator(false, 'Enter an amount above 0, e.g. 12.50')
export const signedAmount = amountValidator(true, 'Enter a number, e.g. -120.50')
export const tagList: Validate = (raw) => ({ value: parseTags(raw).join(', ') })

// The text being typed and the stored value it started from; null = not editing
export interface Edit {
  text: string
  base: string
  error: string | null
}

export const beginEdit = (stored: string): Edit => ({ text: stored, base: stored, error: null })

export const typeText = (stored: string, text: string): Edit => ({ text, base: stored, error: null })

// An edit that started from an older stored value no longer applies
export const activeEdit = (edit: Edit | null, stored: string): Edit | null =>
  edit !== null && edit.base === stored ? edit : null

export interface Settled {
  edit: Edit | null
  commit: string | null
}

// Blur or Enter: an invalid text stays as the edit with its message, anything else ends the edit
export function settleEdit(edit: Edit | null, stored: string, validate?: Validate): Settled {
  if (edit === null) return { edit: null, commit: null }
  const result = resolveCommit(edit.text, stored, validate)
  if (result.kind === 'invalid') return { edit: { ...edit, error: result.message }, commit: null }
  return { edit: null, commit: result.kind === 'commit' ? result.value : null }
}

// Closing the window: a valid, changed text is committed, an invalid one is not
export const unloadCommit = (edit: Edit | null, stored: string, validate?: Validate): string | null =>
  settleEdit(edit, stored, validate).commit

// Capture phase, so it runs before the listeners that check for unsent writes (see canvas/contentStore.ts)
export function watchUnload(target: EventTarget, onUnload: () => void): () => void {
  const options = { capture: true }
  target.addEventListener('beforeunload', onUnload, options)
  return () => target.removeEventListener('beforeunload', onUnload, options)
}

interface Props {
  value: string
  label: string
  onCommit: (value: string) => void
  validate?: Validate
  format?: (stored: string) => string
  className?: string
  placeholder?: string
  onInvalidChange?: (invalid: boolean) => void
}

export default function CommitInput({
  value,
  label,
  onCommit,
  validate,
  format,
  className = '',
  placeholder,
  onInvalidChange
}: Props): React.JSX.Element {
  const [edit, setEdit] = useState<Edit | null>(null)
  const errorId = useId()
  const current = activeEdit(edit, value)
  const error = current?.error ?? null
  const invalid = error !== null

  useEffect(() => {
    if (edit !== null && current === null) setEdit(null)
  }, [edit, current])

  const report = useRef(onInvalidChange)
  useEffect(() => {
    report.current = onInvalidChange
  })
  useEffect(() => {
    if (!invalid) return
    report.current?.(true)
    return () => report.current?.(false)
  }, [invalid])

  // The unload listener reads the latest props, so it is added only while an edit is active
  const latest = useRef({ current, value, validate, onCommit })
  useEffect(() => {
    latest.current = { current, value, validate, onCommit }
  })
  const editing = current !== null
  useEffect(() => {
    if (!editing) return
    return watchUnload(window, () => {
      const { current: pending, value: stored, validate: check, onCommit: commit } = latest.current
      const text = unloadCommit(pending, stored, check)
      if (text === null) return
      // A held close fires the event again before the next render; the text is committed once
      latest.current = { ...latest.current, current: null }
      commit(text)
    })
  }, [editing])

  const finish = (): void => {
    const settled = settleEdit(current, value, validate)
    setEdit(settled.edit)
    if (settled.commit !== null) onCommit(settled.commit)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') setEdit(beginEdit(value))
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    e.preventDefault()
    // An invalid text keeps the focus, so it can be fixed at once
    if (settleEdit(current, value, validate).edit !== null) finish()
    else e.currentTarget.blur()
  }

  return (
    <>
      <input
        className={invalid ? `${className} ring-1 ring-red-500` : className}
        value={current ? current.text : format ? format(value) : value}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        onFocus={() => {
          if (current === null) setEdit(beginEdit(value))
        }}
        onChange={(e) => setEdit(typeText(value, e.target.value))}
        onBlur={finish}
        onKeyDown={handleKeyDown}
      />
      {error !== null && (
        <div id={errorId} role="alert" className="max-w-64 text-[10px] leading-tight whitespace-normal text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </>
  )
}
