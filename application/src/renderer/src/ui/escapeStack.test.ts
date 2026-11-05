import { afterEach, describe, expect, it, vi } from 'vitest'
import { pushEscapeHandler } from './escapeStack'

const pops: Array<() => void> = []

afterEach(() => {
  for (const pop of pops.splice(0)) pop()
})

function push(target: EventTarget, onEscape: () => void): () => void {
  const pop = pushEscapeHandler(target, onEscape)
  pops.push(pop)
  return pop
}

function press(target: EventTarget, key: string, repeat = false): void {
  target.dispatchEvent(Object.assign(new Event('keydown'), { key, repeat }))
}

describe('pushEscapeHandler', () => {
  it('lets Escape close only the topmost of two modals, then the other once the top one is gone', () => {
    const fakeWindow = new EventTarget()
    const closeLower = vi.fn()
    const closeUpper = vi.fn()
    push(fakeWindow, closeLower)
    const popUpper = push(fakeWindow, closeUpper)
    press(fakeWindow, 'Escape')
    expect(closeUpper).toHaveBeenCalledTimes(1)
    expect(closeLower).not.toHaveBeenCalled()
    popUpper()
    press(fakeWindow, 'Escape')
    expect(closeLower).toHaveBeenCalledTimes(1)
    expect(closeUpper).toHaveBeenCalledTimes(1)
  })

  it('ignores an auto-repeated Escape, so a held key closes only the topmost modal', () => {
    const fakeWindow = new EventTarget()
    const closeLower = vi.fn()
    const closeUpper = vi.fn()
    push(fakeWindow, closeLower)
    const popUpper = push(fakeWindow, closeUpper)
    press(fakeWindow, 'Escape')
    popUpper()
    press(fakeWindow, 'Escape', true)
    press(fakeWindow, 'Escape', true)
    expect(closeUpper).toHaveBeenCalledTimes(1)
    expect(closeLower).not.toHaveBeenCalled()
    press(fakeWindow, 'Escape')
    expect(closeLower).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys', () => {
    const fakeWindow = new EventTarget()
    const close = vi.fn()
    push(fakeWindow, close)
    press(fakeWindow, 'Enter')
    expect(close).not.toHaveBeenCalled()
  })

  it('listens in the capture phase and stops once popped', () => {
    const fakeWindow = new EventTarget()
    const add = vi.spyOn(fakeWindow, 'addEventListener')
    const remove = vi.spyOn(fakeWindow, 'removeEventListener')
    const close = vi.fn()
    push(fakeWindow, close)()
    press(fakeWindow, 'Escape')
    expect(add).toHaveBeenCalledWith('keydown', expect.any(Function), true)
    expect(remove).toHaveBeenCalledWith('keydown', add.mock.calls[0][1], true)
    expect(close).not.toHaveBeenCalled()
  })

  it('keeps the order when a modal below the top one closes first', () => {
    const fakeWindow = new EventTarget()
    const closeBottom = vi.fn()
    const closeMiddle = vi.fn()
    const closeTop = vi.fn()
    push(fakeWindow, closeBottom)
    const popMiddle = push(fakeWindow, closeMiddle)
    const popTop = push(fakeWindow, closeTop)
    popMiddle()
    press(fakeWindow, 'Escape')
    expect(closeTop).toHaveBeenCalledTimes(1)
    popTop()
    press(fakeWindow, 'Escape')
    expect(closeBottom).toHaveBeenCalledTimes(1)
    expect(closeMiddle).not.toHaveBeenCalled()
  })

  it('ignores a second pop of the same modal', () => {
    const fakeWindow = new EventTarget()
    const closeUpper = vi.fn()
    const popLower = push(fakeWindow, vi.fn())
    push(fakeWindow, closeUpper)
    popLower()
    popLower()
    press(fakeWindow, 'Escape')
    expect(closeUpper).toHaveBeenCalledTimes(1)
  })
})
