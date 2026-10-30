import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dismissToast, notify, useToastStore } from './Toast'

const shown = (): string[] =>
  useToastStore.getState().toasts.map((toast) => `${toast.kind}: ${toast.message}`)

beforeEach(() => {
  vi.useFakeTimers()
  useToastStore.setState({ toasts: [] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('notify', () => {
  it('shows an info toast by default and hides it after 4 s', () => {
    notify('Link copied')
    expect(shown()).toEqual(['info: Link copied'])
    vi.advanceTimersByTime(3999)
    expect(shown()).toEqual(['info: Link copied'])
    vi.advanceTimersByTime(1)
    expect(shown()).toEqual([])
  })

  it('keeps an error until it is dismissed', () => {
    notify('notebooks.json: disk full', 'error')
    vi.advanceTimersByTime(60_000)
    expect(shown()).toEqual(['error: notebooks.json: disk full'])
    dismissToast(useToastStore.getState().toasts[0].id)
    expect(shown()).toEqual([])
  })

  it('hides each info toast 4 s after its own notify', () => {
    notify('first')
    vi.advanceTimersByTime(2000)
    notify('second')
    vi.advanceTimersByTime(2000)
    expect(shown()).toEqual(['info: second'])
    vi.advanceTimersByTime(2000)
    expect(shown()).toEqual([])
  })

  it('dismisses only the given toast', () => {
    notify('first', 'error')
    notify('second', 'error')
    dismissToast(useToastStore.getState().toasts[0].id)
    expect(shown()).toEqual(['error: second'])
  })

  it('ignores a message equal to a toast that is still shown', () => {
    notify('notebooks.json: disk full', 'error')
    notify('notebooks.json: disk full', 'error')
    expect(shown()).toEqual(['error: notebooks.json: disk full'])
  })

  it('ignores a repeated info message without extending its 4 s', () => {
    notify('Link copied')
    vi.advanceTimersByTime(2000)
    notify('Link copied')
    vi.advanceTimersByTime(2000)
    expect(shown()).toEqual([])
  })

  it('shows a message again once its toast is gone, and the same text of another kind', () => {
    notify('Saved')
    vi.advanceTimersByTime(4000)
    notify('Saved')
    notify('Saved', 'error')
    expect(shown()).toEqual(['info: Saved', 'error: Saved'])
  })
})
