import { describe, expect, it, vi } from 'vitest'
import { startPointerDrag } from './usePointerDrag'

class FakeElement extends EventTarget {
  setPointerCapture = vi.fn()
}

function pointerEvent(type: string, clientX: number, clientY: number, pointerId = 1): Event {
  return Object.assign(new Event(type), { clientX, clientY, pointerId })
}

function startDrag(clientX: number, clientY: number) {
  const element = new FakeElement()
  const onMove = vi.fn()
  const onEnd = vi.fn()
  const pointerDown = { currentTarget: element, clientX, clientY, pointerId: 1 }
  startPointerDrag(pointerDown as unknown as React.PointerEvent, onMove, onEnd)
  return { element, onMove, onEnd }
}

describe('startPointerDrag', () => {
  it('captures the pointer on the element that got the pointerdown', () => {
    const { element } = startDrag(100, 50)
    expect(element.setPointerCapture).toHaveBeenCalledWith(1)
  })

  it('reports the deltas since the pointerdown on each move', () => {
    const { element, onMove } = startDrag(100, 50)
    element.dispatchEvent(pointerEvent('pointermove', 110, 45))
    element.dispatchEvent(pointerEvent('pointermove', 130, 80))
    expect(onMove.mock.calls).toEqual([
      [10, -5],
      [30, 30]
    ])
  })

  it('ignores the events of other pointers', () => {
    const { element, onMove, onEnd } = startDrag(100, 50)
    element.dispatchEvent(pointerEvent('pointermove', 300, 300, 2))
    element.dispatchEvent(pointerEvent('pointerup', 300, 300, 2))
    expect(onMove).not.toHaveBeenCalled()
    expect(onEnd).not.toHaveBeenCalled()
  })

  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])(
    'ends once on %s and then ignores moves',
    (type) => {
      const { element, onMove, onEnd } = startDrag(100, 50)
      element.dispatchEvent(pointerEvent(type, 120, 60))
      expect(onEnd).toHaveBeenCalledTimes(1)
      // The browser releases the capture after the pointer goes up, which must not end it again
      element.dispatchEvent(pointerEvent('lostpointercapture', 120, 60))
      element.dispatchEvent(pointerEvent('pointermove', 140, 70))
      expect(onEnd).toHaveBeenCalledTimes(1)
      expect(onMove).not.toHaveBeenCalled()
    }
  )
})
