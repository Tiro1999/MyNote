import { useRef, useState } from 'react'
import { usePointerDrag } from '@renderer/ui'
import {
  contentBounds,
  fromMinimap,
  inflate,
  minimapTransform,
  toMinimap,
  type Point,
  type Rect,
  type Size
} from './geometry'

interface Props {
  boxes: Array<Rect & { id: string }>
  view: Rect
  onNavigate(point: Point): void
}

const MAP_SIZE: Size = { width: 180, height: 120 }
const PADDING = 60
const MIN_MARK = 2

function markStyle(rect: Rect): React.CSSProperties {
  return {
    left: rect.x,
    top: rect.y,
    width: Math.max(MIN_MARK, rect.width),
    height: Math.max(MIN_MARK, rect.height)
  }
}

// See documentation/software/renderer/canvas/coordinate-model.drawio.svg
export default function Minimap({ boxes, view, onNavigate }: Props): React.JSX.Element {
  const [frozen, setFrozen] = useState<Rect | null>(null)
  const pressed = useRef<Point>({ x: 0, y: 0 })
  const bounds = frozen ?? inflate(contentBounds(boxes, view), PADDING)
  const transform = minimapTransform(bounds, MAP_SIZE)

  // The drag keeps the transform of the pointerdown, so the map stands still while it is dragged
  const startDrag = usePointerDrag(
    (dx, dy) => onNavigate(fromMinimap({ x: pressed.current.x + dx, y: pressed.current.y + dy }, transform)),
    () => setFrozen(null)
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    const map = e.currentTarget.getBoundingClientRect()
    pressed.current = { x: e.clientX - map.left, y: e.clientY - map.top }
    setFrozen(bounds)
    onNavigate(fromMinimap(pressed.current, transform))
    startDrag(e)
  }

  return (
    <div
      className="relative cursor-pointer overflow-hidden rounded-sm border border-gray-300 bg-white/80 shadow-xs dark:border-gray-700 dark:bg-gray-800/80"
      style={MAP_SIZE}
      title="Overview — click or drag to navigate"
      onPointerDown={handlePointerDown}
    >
      {boxes.map((box) => (
        <div
          key={box.id}
          className="absolute rounded-[1px] bg-blue-400/70"
          style={markStyle(toMinimap(box, transform))}
        />
      ))}
      <div
        className="absolute border border-red-500 bg-red-500/10"
        style={markStyle(toMinimap(view, transform))}
      />
    </div>
  )
}
