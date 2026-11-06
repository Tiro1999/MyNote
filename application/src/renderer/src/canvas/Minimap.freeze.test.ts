import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { Children, isValidElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Minimap from './Minimap'
import { hooks } from './hooks.testing'

interface Drag {
  onMove(dx: number, dy: number): void
  onEnd?(): void
  start: ReturnType<typeof vi.fn>
}

const { drags } = vi.hoisted(() => ({ drags: [] as Drag[] }))

vi.mock('react', async (importOriginal) => {
  const { hooks: shim } = await import('./hooks.testing')
  return {
    ...(await importOriginal<typeof import('react')>()),
    useRef: (value: unknown) => shim.useRef(value),
    useState: (value: unknown) => shim.useState(value)
  }
})

vi.mock('@renderer/ui', () => ({
  usePointerDrag: (onMove: Drag['onMove'], onEnd?: Drag['onEnd']) => {
    const drag: Drag = { onMove, onEnd, start: vi.fn() }
    drags.push(drag)
    return drag.start
  }
}))

type Props = Parameters<typeof Minimap>[0]
type Tree = ReactElement<{ onPointerDown(e: unknown): void; children?: ReactNode }>

const boxes = [{ id: 'a', x: 0, y: 0, width: 100, height: 40 }]
// Fits the 180 x 120 map at scale 0.5 with an offset of 30
const view = { x: 0, y: 0, width: 240, height: 120 }
// What the canvas shows after the navigation has moved the view far to the right
const movedView = { x: 1000, y: 0, width: 240, height: 120 }
const onNavigate = vi.fn()

function render(viewNow: Props['view']): Tree {
  const inner = Minimap as unknown as (props: Props) => Tree
  return hooks.render(inner, { boxes, view: viewNow, onNavigate })
}

function styleOf(node: ReactNode, className: string): CSSProperties | undefined {
  if (!isValidElement(node)) return undefined
  const props = (node as ReactElement<{ className?: string; style?: CSSProperties; children?: ReactNode }>).props
  if (props.className?.includes(className)) return props.style
  for (const child of Children.toArray(props.children)) {
    const found = styleOf(child, className)
    if (found) return found
  }
  return undefined
}

const boxMark = (tree: Tree): CSSProperties | undefined => styleOf(tree, 'bg-blue-400')
const viewMark = (tree: Tree): CSSProperties | undefined => styleOf(tree, 'border-red-500')

function press(tree: Tree, overrides: Record<string, unknown> = {}) {
  const event = {
    button: 0,
    clientX: 130,
    clientY: 90,
    currentTarget: { getBoundingClientRect: () => ({ left: 100, top: 50 }) },
    stopPropagation: vi.fn(),
    ...overrides
  }
  tree.props.onPointerDown(event)
  return event
}

beforeEach(() => {
  hooks.reset()
  drags.length = 0
  vi.clearAllMocks()
})

describe('Minimap while it is dragged', () => {
  it('fits the boxes and the view when nothing is dragged', () => {
    const tree = render(view)
    expect(boxMark(tree)).toEqual({ left: 30, top: 30, width: 50, height: 20 })
    expect(viewMark(tree)).toEqual({ left: 30, top: 30, width: 120, height: 60 })
  })

  it('rescales to the live view while nothing is dragged', () => {
    const moved = boxMark(render(movedView))
    expect(moved?.left).not.toBe(30)
  })

  it('keeps its bounds from the press until the end, however far the view moves', () => {
    const first = render(view)
    press(first)
    const during = render(movedView)
    expect(boxMark(during)).toEqual({ left: 30, top: 30, width: 50, height: 20 })
    expect(viewMark(during)).toEqual({ left: 530, top: 30, width: 120, height: 60 })

    drags[0].onEnd?.()
    const after = render(movedView)
    expect(boxMark(after)?.left).not.toBe(30)
  })

  it('navigates by the transform of the press while the pointer moves', () => {
    press(render(view))
    expect(onNavigate).toHaveBeenLastCalledWith({ x: 0, y: 20 })
    expect(drags[0].start).toHaveBeenCalledTimes(1)
    render(movedView)
    drags[0].onMove(10, 10)
    expect(onNavigate).toHaveBeenLastCalledWith({ x: 20, y: 40 })
    drags[0].onMove(-30, 0)
    expect(onNavigate).toHaveBeenLastCalledWith({ x: -60, y: 20 })
  })

  it('keeps the press from reaching the canvas', () => {
    const event = press(render(view))
    expect(event.stopPropagation).toHaveBeenCalled()
  })

  it('ignores a button other than the primary one', () => {
    const tree = render(view)
    const event = press(tree, { button: 2 })
    expect(event.stopPropagation).not.toHaveBeenCalled()
    expect(onNavigate).not.toHaveBeenCalled()
    expect(drags[0].start).not.toHaveBeenCalled()
    expect(boxMark(render(movedView))?.left).not.toBe(30)
  })
})
