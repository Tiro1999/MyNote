import { useMemo, useRef } from 'react'

interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

interface Props {
  elements: Array<{ id: string; x: number; y: number; width: number; height: number }>
  viewport: Rect
  onNavigate: (contentX: number, contentY: number) => void
}

const MAP_W = 180
const MAP_H = 120
const PAD = 60 // content-space padding around the extent

/**
 * Overview map of the canvas: every element as a small box plus a rectangle for
 * the current viewport. Clicking or dragging inside it recenters the canvas on
 * that content point — a way to find elements after panning/zooming away.
 */
export default function Minimap({ elements, viewport, onNavigate }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const bounds = useMemo(() => {
    let minX = viewport.left
    let minY = viewport.top
    let maxX = viewport.right
    let maxY = viewport.bottom
    for (const el of elements) {
      minX = Math.min(minX, el.x)
      minY = Math.min(minY, el.y)
      maxX = Math.max(maxX, el.x + el.width)
      maxY = Math.max(maxY, el.y + el.height)
    }
    return { minX: minX - PAD, minY: minY - PAD, maxX: maxX + PAD, maxY: maxY + PAD }
  }, [elements, viewport])

  const scale = Math.min(
    MAP_W / Math.max(1, bounds.maxX - bounds.minX),
    MAP_H / Math.max(1, bounds.maxY - bounds.minY)
  )
  const toMapX = (x: number): number => (x - bounds.minX) * scale
  const toMapY = (y: number): number => (y - bounds.minY) * scale

  const navigateFromEvent = (e: React.MouseEvent): void => {
    const rect = ref.current!.getBoundingClientRect()
    onNavigate(bounds.minX + (e.clientX - rect.left) / scale, bounds.minY + (e.clientY - rect.top) / scale)
  }

  return (
    <div
      ref={ref}
      className="relative cursor-pointer overflow-hidden rounded border border-gray-300 bg-white/80 shadow-sm dark:border-gray-700 dark:bg-gray-800/80"
      style={{ width: MAP_W, height: MAP_H }}
      title="Übersicht — klicken/ziehen zum Navigieren"
      onMouseDown={(e) => {
        dragging.current = true
        navigateFromEvent(e)
      }}
      onMouseMove={(e) => {
        if (dragging.current) navigateFromEvent(e)
      }}
      onMouseUp={() => {
        dragging.current = false
      }}
      onMouseLeave={() => {
        dragging.current = false
      }}
    >
      {elements.map((el) => (
        <div
          key={el.id}
          className="absolute rounded-[1px] bg-blue-400/70"
          style={{
            left: toMapX(el.x),
            top: toMapY(el.y),
            width: Math.max(2, el.width * scale),
            height: Math.max(2, el.height * scale)
          }}
        />
      ))}
      <div
        className="absolute border border-red-500 bg-red-500/10"
        style={{
          left: toMapX(viewport.left),
          top: toMapY(viewport.top),
          width: Math.max(2, (viewport.right - viewport.left) * scale),
          height: Math.max(2, (viewport.bottom - viewport.top) * scale)
        }}
      />
    </div>
  )
}
