import type { ReactElement, ReactNode } from 'react'
import { Children, isValidElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TextBox from './TextBox'
import type { TextBoxElement, TextBoxPatch } from './model'
import { hooks } from './testHooks'

interface Drag {
  onMove(dx: number, dy: number): void
  onEnd?(): void
  start: ReturnType<typeof vi.fn>
  origin: { x: number; y: number } | null
}

const { drags } = vi.hoisted(() => ({ drags: [] as Drag[] }))

vi.mock('react', async (importOriginal) => {
  const { hooks: shim } = await import('./testHooks')
  return {
    ...(await importOriginal<typeof import('react')>()),
    useRef: (value: unknown) => shim.useRef(value),
    useState: (value: unknown) => shim.useState(value)
  }
})

vi.mock('@renderer/editor', () => ({ Toolbar: () => null, useNoteEditor: () => ({}) }))
vi.mock('@tiptap/react', () => ({ EditorContent: () => null }))

// Like usePointerDrag: the deltas count from the event the drag was started with
vi.mock('@renderer/ui', () => ({
  usePointerDrag: (onMove: Drag['onMove'], onEnd?: Drag['onEnd']) => {
    const drag: Drag = {
      onMove,
      onEnd,
      origin: null,
      start: vi.fn((e: { clientX: number; clientY: number }) => {
        drag.origin = { x: e.clientX, y: e.clientY }
      })
    }
    drags.push(drag)
    return drag.start
  }
}))

type Props = Parameters<typeof TextBox>[0]
type Handlers = Record<string, ((e: unknown) => void) | undefined>

const element: TextBoxElement = {
  id: 'b1',
  type: 'textbox',
  x: 40,
  y: 60,
  width: 320,
  height: 200,
  zIndex: 3,
  content: { type: 'doc', content: [] }
}

const callbacks = { onFocus: vi.fn(), onBlur: vi.fn(), onUpdate: vi.fn(), onCommit: vi.fn(), onDelete: vi.fn() }

function pointer(clientX: number, clientY: number, overrides: Record<string, unknown> = {}) {
  return { button: 0, buttons: 1, clientX, clientY, stopPropagation: vi.fn(), ...overrides }
}

function findHandlers(node: ReactNode, className: string): Handlers | null {
  if (!isValidElement(node)) return null
  const props = (node as ReactElement<Handlers & { className?: string; children?: ReactNode }>).props
  if (typeof props.className === 'string' && props.className.includes(className)) return props
  for (const child of Children.toArray(props.children)) {
    const found = findHandlers(child, className)
    if (found) return found
  }
  return null
}

// Renders the box once and returns what a pointer can reach on it
function mount(overrides: Partial<Props> = {}) {
  drags.length = 0
  const inner = (TextBox as unknown as { type: (props: Props) => ReactElement }).type
  const props = { element, features: [], zoom: 1, focused: false, ...callbacks, ...overrides }
  const tree = hooks.render(inner, props)
  const box = (tree.props as Handlers)
  const [boxDrag, cornerDrag] = drags.slice(-2)
  return { box, corner: findHandlers(tree, 'cursor-se-resize') as Handlers, boxDrag, cornerDrag }
}

// The pointer goes to (x, y); the drag reports the way from where it started
function dragTo(drag: Drag, x: number, y: number): void {
  if (!drag.origin) throw new Error('the drag has not started')
  drag.onMove(x - drag.origin.x, y - drag.origin.y)
}

beforeEach(() => {
  hooks.reset()
  vi.clearAllMocks()
})

describe('a press on an unfocused box', () => {
  it('stays a click while the pointer stays within 3 px', () => {
    const { box, boxDrag } = mount()
    box.onPointerDown?.(pointer(100, 100))
    box.onPointerMove?.(pointer(102, 101))
    box.onPointerUp?.(pointer(102, 101))
    box.onPointerMove?.(pointer(130, 130, { buttons: 0 }))
    expect(boxDrag.start).not.toHaveBeenCalled()
    expect(callbacks.onUpdate).not.toHaveBeenCalled()
  })

  it('keeps the press from reaching the canvas, which would pan on Alt', () => {
    const { box } = mount()
    const down = pointer(100, 100, { altKey: true })
    box.onPointerDown?.(down)
    expect(down.stopPropagation).toHaveBeenCalled()
  })

  it('starts the drag at the first move 3 px away, and the box stays under the pointer', () => {
    const { box, boxDrag } = mount()
    box.onPointerDown?.(pointer(100, 100))
    box.onPointerMove?.(pointer(103, 100))
    expect(boxDrag.start).toHaveBeenCalledTimes(1)
    expect(callbacks.onUpdate).not.toHaveBeenCalled()
    dragTo(boxDrag, 110, 100)
    expect(callbacks.onUpdate).toHaveBeenLastCalledWith('b1', { x: 50, y: 60 })
    dragTo(boxDrag, 130, 140)
    expect(callbacks.onUpdate).toHaveBeenLastCalledWith('b1', { x: 70, y: 100 })
  })

  it('counts a fast flick from the press, not from the move that crossed the threshold', () => {
    const { box, boxDrag } = mount()
    box.onPointerDown?.(pointer(100, 100))
    box.onPointerMove?.(pointer(160, 100))
    dragTo(boxDrag, 160, 100)
    expect(callbacks.onUpdate).toHaveBeenLastCalledWith('b1', { x: 100, y: 60 })
  })

  it('follows a drag up and to the left', () => {
    const { box, boxDrag } = mount()
    box.onPointerDown?.(pointer(100, 100))
    box.onPointerMove?.(pointer(96, 99))
    dragTo(boxDrag, 70, 80)
    expect(callbacks.onUpdate).toHaveBeenLastCalledWith('b1', { x: 10, y: 40 })
  })

  it('divides the whole way from the press by the zoom', () => {
    const { box, boxDrag } = mount({ zoom: 2 })
    box.onPointerDown?.(pointer(100, 100))
    box.onPointerMove?.(pointer(108, 100))
    dragTo(boxDrag, 120, 110)
    expect(callbacks.onUpdate).toHaveBeenLastCalledWith('b1', { x: 50, y: 65 })
  })

  it('saves nothing while moving and commits the last position once on release', () => {
    const { box, boxDrag } = mount()
    box.onPointerDown?.(pointer(100, 100))
    box.onPointerMove?.(pointer(104, 100))
    dragTo(boxDrag, 110, 100)
    dragTo(boxDrag, 120, 130)
    expect(callbacks.onCommit).not.toHaveBeenCalled()
    boxDrag.onEnd?.()
    expect(callbacks.onCommit.mock.calls).toEqual([['b1', { x: 60, y: 90 }]])
  })

  it('starts one drag only, however many moves follow', () => {
    const { box, boxDrag } = mount()
    box.onPointerDown?.(pointer(100, 100))
    box.onPointerMove?.(pointer(105, 100))
    box.onPointerMove?.(pointer(120, 100))
    box.onPointerMove?.(pointer(140, 100))
    expect(boxDrag.start).toHaveBeenCalledTimes(1)
  })

  it('is dropped when the button was released outside the box', () => {
    const { box, boxDrag } = mount()
    box.onPointerDown?.(pointer(100, 100))
    box.onPointerMove?.(pointer(150, 150, { buttons: 0 }))
    box.onPointerMove?.(pointer(160, 160))
    expect(boxDrag.start).not.toHaveBeenCalled()
  })

  it('is ignored for a secondary button', () => {
    const { box, boxDrag } = mount()
    const down = pointer(100, 100, { button: 2 })
    box.onPointerDown?.(down)
    box.onPointerMove?.(pointer(160, 100))
    expect(down.stopPropagation).not.toHaveBeenCalled()
    expect(boxDrag.start).not.toHaveBeenCalled()
  })
})

describe('a press on a focused box', () => {
  it('neither drags nor stops the press, so the text can be selected', () => {
    const { box, boxDrag } = mount({ focused: true })
    const down = pointer(100, 100)
    box.onPointerDown?.(down)
    box.onPointerMove?.(pointer(160, 100))
    expect(down.stopPropagation).not.toHaveBeenCalled()
    expect(boxDrag.start).not.toHaveBeenCalled()
  })
})

describe('the resize handle', () => {
  it('starts the drag at the press, so the corner stays under the pointer', () => {
    const { corner, cornerDrag } = mount({ zoom: 2 })
    const down = pointer(300, 250)
    corner.onPointerDown?.(down)
    expect(down.stopPropagation).toHaveBeenCalled()
    expect(cornerDrag.start).toHaveBeenCalledTimes(1)
    dragTo(cornerDrag, 340, 270)
    expect(callbacks.onUpdate).toHaveBeenLastCalledWith('b1', { width: 340, height: 210 })
  })

  it('commits once on release', () => {
    const { corner, cornerDrag } = mount()
    corner.onPointerDown?.(pointer(300, 250))
    dragTo(cornerDrag, 310, 260)
    cornerDrag.onEnd?.()
    const patch: TextBoxPatch = { width: 330, height: 210 }
    expect(callbacks.onCommit.mock.calls).toEqual([['b1', patch]])
  })

  it('ignores a secondary button', () => {
    const { corner, cornerDrag } = mount()
    corner.onPointerDown?.(pointer(300, 250, { button: 2 }))
    expect(cornerDrag.start).not.toHaveBeenCalled()
  })
})
