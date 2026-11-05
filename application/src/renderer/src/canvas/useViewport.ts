import { useCallback, useEffect, useRef, useState } from 'react'
import { usePointerDrag } from '@renderer/ui'
import {
  DEFAULT_VIEWPORT,
  WHEEL_ZOOM_FACTOR,
  centerOn,
  panBy,
  stepZoom,
  wheelAction,
  zoomBy,
  type Point,
  type Size,
  type Viewport
} from './geometry'

const BOX_SELECTOR = '[data-canvas-element]'

interface WheelLike {
  target: EventTarget | null
  ctrlKey: boolean
  metaKey: boolean
  deltaX: number
  deltaY: number
}

export interface ViewportControls {
  ref: React.RefObject<HTMLDivElement>
  viewport: Viewport
  size: Size
  panHandlers: {
    onPointerDown(e: React.PointerEvent): void
    onMouseDown(e: React.MouseEvent): void
  }
  step(direction: 1 | -1): void
  reset(): void
  navigateTo(point: Point): void
}

// Middle button, or the primary button with Alt
export function isPanGesture(e: { button: number; altKey: boolean }): boolean {
  return e.button === 1 || (e.button === 0 && e.altKey)
}

// The change a wheel event makes to the viewport; null when the wheel belongs to the text box under it
export function wheelUpdate(e: WheelLike): ((viewport: Viewport) => Viewport) | null {
  const overBox = e.target instanceof Element && e.target.closest(BOX_SELECTOR) !== null
  const action = wheelAction(e.ctrlKey || e.metaKey, overBox)
  const { deltaX, deltaY } = e
  if (action === 'ignore') return null
  return action === 'zoom'
    ? (viewport) => zoomBy(viewport, -deltaY * WHEEL_ZOOM_FACTOR)
    : (viewport) => panBy(viewport, -deltaX, -deltaY)
}

// Pan and zoom of one canvas, the size of its element, and the gestures that change them
export function useViewport(): ViewportControls {
  const ref = useRef<HTMLDivElement>(null)
  const panning = useRef(false)
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const onWheel = (e: WheelEvent): void => {
      const update = wheelUpdate(e)
      if (!update) return
      e.preventDefault()
      setViewport(update)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = (): void => {
      const { clientWidth: width, clientHeight: height } = element
      setSize((last) => (last.width === width && last.height === height ? last : { width, height }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // The drag keeps the viewport of the pointerdown, so its deltas always count from there
  const startPan = usePointerDrag(
    (dx, dy) => setViewport(panBy(viewport, dx, dy)),
    () => {
      panning.current = false
    }
  )

  const panHandlers = {
    onPointerDown: (e: React.PointerEvent): void => {
      if (!isPanGesture(e)) return
      panning.current = true
      startPan(e)
    },
    // A pan must start no text selection and no middle-click autoscroll
    onMouseDown: (e: React.MouseEvent): void => {
      if (panning.current) e.preventDefault()
    }
  }

  const step = useCallback(
    (direction: 1 | -1) => setViewport((last) => ({ ...last, zoom: stepZoom(last.zoom, direction) })),
    []
  )
  const reset = useCallback(() => setViewport(DEFAULT_VIEWPORT), [])
  const navigateTo = useCallback(
    (point: Point) => setViewport((last) => centerOn(last, point, size)),
    [size]
  )

  return { ref, viewport, size, panHandlers, step, reset, navigateTo }
}
