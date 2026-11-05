// See documentation/software/renderer/canvas/coordinate-model.drawio.svg

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export type Rect = Point & Size

// The canvas surface is drawn at translate(panX, panY) scale(zoom), with the pan in screen pixels
export interface Viewport {
  panX: number
  panY: number
  zoom: number
}

// A canvas point p lands at p * scale + offset in the minimap
export interface MapTransform {
  scale: number
  offsetX: number
  offsetY: number
}

export type WheelAction = 'zoom' | 'pan' | 'ignore'

export const ZOOM_MIN = 0.2
export const ZOOM_MAX = 3
export const ZOOM_STEP = 0.1
export const WHEEL_ZOOM_FACTOR = 0.001
export const DEFAULT_VIEWPORT: Viewport = { panX: 40, panY: 40, zoom: 1 }
// Boxes within this share of the visible size around the viewport stay mounted
export const CULL_MARGIN = 0.5
export const MIN_BOX_SIZE: Size = { width: 120, height: 60 }
// Screen pixels a pressed pointer travels before it counts as a drag
export const DRAG_THRESHOLD = 3

export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
}

// Rounded to two places so repeated steps do not drift
export function stepZoom(zoom: number, direction: 1 | -1): number {
  return clampZoom(Number((zoom + direction * ZOOM_STEP).toFixed(2)))
}

export function zoomBy(viewport: Viewport, delta: number): Viewport {
  return { ...viewport, zoom: clampZoom(viewport.zoom + delta) }
}

export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
  return { ...viewport, panX: viewport.panX + dx, panY: viewport.panY + dy }
}

// Over a text box the wheel scrolls the box; only Ctrl or Meta still acts on the canvas
export function wheelAction(zoomKey: boolean, overBox: boolean): WheelAction {
  if (zoomKey) return 'zoom'
  return overBox ? 'ignore' : 'pan'
}

// The point is relative to the top-left corner of the canvas, not to the window
export function screenToCanvas(point: Point, viewport: Viewport): Point {
  return { x: (point.x - viewport.panX) / viewport.zoom, y: (point.y - viewport.panY) / viewport.zoom }
}

export function centerOn(viewport: Viewport, point: Point, size: Size): Viewport {
  return {
    ...viewport,
    panX: size.width / 2 - point.x * viewport.zoom,
    panY: size.height / 2 - point.y * viewport.zoom
  }
}

// The canvas area shown in a width x height viewport, grown by margin times its size on every side
export function visibleRect(viewport: Viewport, width: number, height: number, margin: number): Rect {
  const origin = screenToCanvas({ x: 0, y: 0 }, viewport)
  const visibleWidth = width / viewport.zoom
  const visibleHeight = height / viewport.zoom
  return {
    x: origin.x - visibleWidth * margin,
    y: origin.y - visibleHeight * margin,
    width: visibleWidth * (1 + 2 * margin),
    height: visibleHeight * (1 + 2 * margin)
  }
}

// Rectangles that only touch count as intersecting
export function intersects(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height
}

// The boxes worth mounting: those meeting the area, and the one with keepId wherever it is
export function cull<T extends Rect & { id: string }>(boxes: T[], area: Rect, keepId: string | null): T[] {
  return boxes.filter((box) => box.id === keepId || intersects(box, area))
}

// Where the first move past the threshold lies relative to the press; null while the pointer is still close
export function dragOffset(press: Point, move: Point): Point | null {
  if (Math.hypot(move.x - press.x, move.y - press.y) < DRAG_THRESHOLD) return null
  return { x: move.x - press.x, y: move.y - press.y }
}

// Screen deltas of a drag become canvas units by dividing by the zoom
export function movedBox(start: Point, dx: number, dy: number, zoom: number): Point {
  return { x: start.x + dx / zoom, y: start.y + dy / zoom }
}

export function resizedBox(start: Size, dx: number, dy: number, zoom: number): Size {
  return {
    width: Math.max(MIN_BOX_SIZE.width, start.width + dx / zoom),
    height: Math.max(MIN_BOX_SIZE.height, start.height + dy / zoom)
  }
}

export function nextZIndex(elements: { zIndex: number }[]): number {
  if (elements.length === 0) return 1
  return elements.reduce((highest, element) => Math.max(highest, element.zIndex), -Infinity) + 1
}

// The smallest rectangle around all rects and the view
export function contentBounds(rects: Rect[], view: Rect): Rect {
  let left = view.x
  let top = view.y
  let right = view.x + view.width
  let bottom = view.y + view.height
  for (const rect of rects) {
    left = Math.min(left, rect.x)
    top = Math.min(top, rect.y)
    right = Math.max(right, rect.x + rect.width)
    bottom = Math.max(bottom, rect.y + rect.height)
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function inflate(rect: Rect, by: number): Rect {
  return { x: rect.x - by, y: rect.y - by, width: rect.width + 2 * by, height: rect.height + 2 * by }
}

// Fits the bounds into the map and anchors their top-left corner at the map's
export function minimapTransform(bounds: Rect, size: Size): MapTransform {
  const scale = Math.min(size.width / Math.max(1, bounds.width), size.height / Math.max(1, bounds.height))
  return { scale, offsetX: -bounds.x * scale, offsetY: -bounds.y * scale }
}

export function toMinimap(rect: Rect, transform: MapTransform): Rect {
  const { scale, offsetX, offsetY } = transform
  return {
    x: rect.x * scale + offsetX,
    y: rect.y * scale + offsetY,
    width: rect.width * scale,
    height: rect.height * scale
  }
}

export function fromMinimap(point: Point, transform: MapTransform): Point {
  const { scale, offsetX, offsetY } = transform
  return { x: (point.x - offsetX) / scale, y: (point.y - offsetY) / scale }
}
