import { useCallback } from 'react'

type DragMove = (dx: number, dy: number) => void

const END_EVENTS = ['pointerup', 'pointercancel', 'lostpointercapture'] as const

// dx/dy are CSS-pixel deltas since the pointerdown; a caller with a zoom divides them by it
export function usePointerDrag(
  onMove: DragMove,
  onEnd?: () => void
): (e: React.PointerEvent) => void {
  return useCallback((e: React.PointerEvent) => startPointerDrag(e, onMove, onEnd), [onMove, onEnd])
}

export function startPointerDrag(e: React.PointerEvent, onMove: DragMove, onEnd?: () => void): void {
  const target = e.currentTarget as HTMLElement
  const { pointerId, clientX: startX, clientY: startY } = e
  const move = (event: PointerEvent): void => {
    if (event.pointerId === pointerId) onMove(event.clientX - startX, event.clientY - startY)
  }
  const end = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return
    target.removeEventListener('pointermove', move)
    for (const type of END_EVENTS) target.removeEventListener(type, end)
    onEnd?.()
  }
  target.setPointerCapture(pointerId)
  target.addEventListener('pointermove', move)
  for (const type of END_EVENTS) target.addEventListener(type, end)
}
