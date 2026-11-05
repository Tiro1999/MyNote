import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_VIEWPORT } from './geometry'
import { isPanGesture, wheelUpdate } from './useViewport'

vi.mock('@renderer/ui', () => ({ usePointerDrag: () => () => {} }))

class FakeElement {
  constructor(private readonly insideBox: boolean) {}
  closest(selector: string): FakeElement | null {
    return selector === '[data-canvas-element]' && this.insideBox ? this : null
  }
}

type Wheel = Parameters<typeof wheelUpdate>[0]

const onCanvas = new FakeElement(false) as unknown as EventTarget
const overBox = new FakeElement(true) as unknown as EventTarget

function wheel(overrides: Partial<Wheel> = {}): Wheel {
  return { target: onCanvas, ctrlKey: false, metaKey: false, deltaX: 0, deltaY: 0, ...overrides }
}

afterEach(() => vi.unstubAllGlobals())

describe('isPanGesture', () => {
  it('is a middle press, or the primary button with Alt', () => {
    expect(isPanGesture({ button: 1, altKey: false })).toBe(true)
    expect(isPanGesture({ button: 0, altKey: true })).toBe(true)
  })

  it('is neither a plain primary press nor a secondary press', () => {
    expect(isPanGesture({ button: 0, altKey: false })).toBe(false)
    expect(isPanGesture({ button: 2, altKey: true })).toBe(false)
  })
})

describe('wheelUpdate', () => {
  it('pans the canvas against the wheel', () => {
    vi.stubGlobal('Element', FakeElement)
    const update = wheelUpdate(wheel({ deltaX: 10, deltaY: 20 }))
    expect(update?.(DEFAULT_VIEWPORT)).toEqual({ panX: 30, panY: 20, zoom: 1 })
  })

  it('zooms with Ctrl or Meta, 0.001 per wheel unit, and clamps', () => {
    vi.stubGlobal('Element', FakeElement)
    expect(wheelUpdate(wheel({ ctrlKey: true, deltaY: 100 }))?.(DEFAULT_VIEWPORT).zoom).toBeCloseTo(0.9)
    expect(wheelUpdate(wheel({ metaKey: true, deltaY: -500 }))?.(DEFAULT_VIEWPORT).zoom).toBeCloseTo(1.5)
    expect(wheelUpdate(wheel({ ctrlKey: true, deltaY: 100000 }))?.(DEFAULT_VIEWPORT).zoom).toBe(0.2)
  })

  it('leaves the wheel to the text box under the pointer', () => {
    vi.stubGlobal('Element', FakeElement)
    expect(wheelUpdate(wheel({ target: overBox, deltaY: 50 }))).toBeNull()
  })

  it('still zooms over a text box while Ctrl or Meta is held', () => {
    vi.stubGlobal('Element', FakeElement)
    const update = wheelUpdate(wheel({ target: overBox, ctrlKey: true, deltaY: 100 }))
    expect(update?.(DEFAULT_VIEWPORT).zoom).toBeCloseTo(0.9)
    expect(wheelUpdate(wheel({ target: overBox, metaKey: true, deltaY: 100 }))).not.toBeNull()
  })

  it('treats a target that is no element as the canvas', () => {
    vi.stubGlobal('Element', FakeElement)
    expect(wheelUpdate(wheel({ target: null, deltaY: 10 }))).not.toBeNull()
  })
})
