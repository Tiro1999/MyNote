import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VIEWPORT,
  DRAG_THRESHOLD,
  MIN_BOX_SIZE,
  WHEEL_ZOOM_FACTOR,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  centerOn,
  clampZoom,
  contentBounds,
  cull,
  dragOffset,
  fromMinimap,
  inflate,
  intersects,
  minimapTransform,
  movedBox,
  nextZIndex,
  panBy,
  resizedBox,
  screenToCanvas,
  stepZoom,
  toMinimap,
  visibleRect,
  wheelAction,
  zoomBy
} from './geometry'

describe('zoom', () => {
  it('keeps the limits and steps', () => {
    expect([ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, WHEEL_ZOOM_FACTOR]).toEqual([0.2, 3, 0.1, 0.001])
    expect(DEFAULT_VIEWPORT).toEqual({ panX: 40, panY: 40, zoom: 1 })
  })

  it('clamps to the limits', () => {
    expect(clampZoom(5)).toBe(3)
    expect(clampZoom(0.01)).toBe(0.2)
    expect(clampZoom(1.5)).toBe(1.5)
  })

  it('steps by 0.1 without float noise and stops at the limits', () => {
    expect(stepZoom(1, 1)).toBe(1.1)
    expect(stepZoom(0.7, 1)).toBe(0.8)
    expect(stepZoom(1, -1)).toBe(0.9)
    expect(stepZoom(2.95, 1)).toBe(3)
    expect(stepZoom(0.25, -1)).toBe(0.2)
  })

  it('zooms by a delta and clamps, keeping the pan', () => {
    const v = { panX: 5, panY: 6, zoom: 1 }
    expect(zoomBy(v, 0.5)).toEqual({ panX: 5, panY: 6, zoom: 1.5 })
    expect(zoomBy(v, 10).zoom).toBe(3)
    expect(zoomBy(v, -10).zoom).toBe(0.2)
  })
})

describe('pan', () => {
  it('moves the pan and keeps the zoom', () => {
    expect(panBy({ panX: 10, panY: 20, zoom: 2 }, -3, 4)).toEqual({ panX: 7, panY: 24, zoom: 2 })
  })

  it('centers a canvas point in the visible area', () => {
    const v = { panX: 0, panY: 0, zoom: 2 }
    const centered = centerOn(v, { x: 100, y: 50 }, { width: 800, height: 600 })
    expect(centered).toEqual({ panX: 200, panY: 200, zoom: 2 })
    expect(screenToCanvas({ x: 400, y: 300 }, centered)).toEqual({ x: 100, y: 50 })
  })
})

describe('wheelAction', () => {
  it('zooms with Ctrl or Meta, over a text box too', () => {
    expect(wheelAction(true, false)).toBe('zoom')
    expect(wheelAction(true, true)).toBe('zoom')
  })

  it('pans on the canvas', () => {
    expect(wheelAction(false, false)).toBe('pan')
  })

  it('leaves the wheel to the text box under the pointer', () => {
    expect(wheelAction(false, true)).toBe('ignore')
  })
})

describe('screenToCanvas', () => {
  it('undoes pan and zoom', () => {
    expect(screenToCanvas({ x: 110, y: 60 }, { panX: 10, panY: -40, zoom: 2 })).toEqual({ x: 50, y: 50 })
  })
})

describe('visibleRect', () => {
  it('covers the viewport in canvas units', () => {
    expect(visibleRect({ panX: 0, panY: 0, zoom: 0.5 }, 800, 600, 0)).toEqual({
      x: 0,
      y: 0,
      width: 1600,
      height: 1200
    })
  })

  it('follows pan and zoom', () => {
    expect(visibleRect({ panX: -100, panY: -50, zoom: 2 }, 800, 600, 0)).toEqual({
      x: 50,
      y: 25,
      width: 400,
      height: 300
    })
  })

  it('adds the margin as a share of the visible size on every side', () => {
    expect(visibleRect({ panX: -100, panY: -50, zoom: 2 }, 800, 600, 0.5)).toEqual({
      x: -150,
      y: -125,
      width: 800,
      height: 600
    })
  })
})

describe('intersects', () => {
  const box = { x: 0, y: 0, width: 10, height: 10 }

  it('counts touching rectangles', () => {
    expect(intersects(box, { x: 10, y: 0, width: 5, height: 5 })).toBe(true)
    expect(intersects(box, { x: 10, y: 10, width: 5, height: 5 })).toBe(true)
  })

  it('counts overlapping and containing rectangles', () => {
    expect(intersects(box, { x: 5, y: 5, width: 10, height: 10 })).toBe(true)
    expect(intersects(box, { x: -5, y: -5, width: 30, height: 30 })).toBe(true)
  })

  it('rejects rectangles that are apart on either axis', () => {
    expect(intersects(box, { x: 10.5, y: 0, width: 5, height: 5 })).toBe(false)
    expect(intersects(box, { x: 0, y: -6, width: 5, height: 5 })).toBe(false)
    expect(intersects({ x: 11, y: 0, width: 5, height: 5 }, box)).toBe(false)
  })
})

describe('moving and resizing a box', () => {
  it('divides the screen deltas by the zoom', () => {
    expect(movedBox({ x: 100, y: 100 }, 20, -10, 2)).toEqual({ x: 110, y: 95 })
    expect(resizedBox({ width: 320, height: 200 }, 40, 20, 2)).toEqual({ width: 340, height: 210 })
  })

  it('keeps a resized box at its minimum size', () => {
    expect(MIN_BOX_SIZE).toEqual({ width: 120, height: 60 })
    expect(resizedBox({ width: 320, height: 200 }, -1000, -1000, 1)).toEqual({ width: 120, height: 60 })
  })

})

describe('dragOffset', () => {
  const press = { x: 100, y: 100 }

  it('is null until the pointer is 3 px away from the press', () => {
    expect(DRAG_THRESHOLD).toBe(3)
    expect(dragOffset(press, press)).toBeNull()
    expect(dragOffset(press, { x: 102, y: 100 })).toBeNull()
    expect(dragOffset(press, { x: 102, y: 102 })).toBeNull()
  })

  it('is the distance from the press where the threshold is crossed', () => {
    expect(dragOffset(press, { x: 103, y: 100 })).toEqual({ x: 3, y: 0 })
    expect(dragOffset(press, { x: 100, y: 103 })).toEqual({ x: 0, y: 3 })
    expect(dragOffset(press, { x: 103, y: 102 })).toEqual({ x: 3, y: 2 })
  })

  it('keeps the whole jump of a fast flick', () => {
    expect(dragOffset(press, { x: 140, y: 90 })).toEqual({ x: 40, y: -10 })
  })

  it('points up and to the left for a drag up or to the left', () => {
    expect(dragOffset(press, { x: 100, y: 88 })).toEqual({ x: 0, y: -12 })
    expect(dragOffset(press, { x: 97, y: 100 })).toEqual({ x: -3, y: 0 })
    expect(dragOffset(press, { x: 95, y: 96 })).toEqual({ x: -5, y: -4 })
  })
})

describe('nextZIndex', () => {
  it('is the highest zIndex plus one', () => {
    expect(nextZIndex([{ zIndex: 1 }, { zIndex: 5 }])).toBe(6)
    expect(nextZIndex([{ zIndex: 5 }, { zIndex: 2 }])).toBe(6)
  })

  it('starts at 1 on an empty canvas', () => {
    expect(nextZIndex([])).toBe(1)
  })

  it('does not repeat a zIndex after a delete', () => {
    expect(nextZIndex([{ zIndex: 1 }, { zIndex: 3 }])).toBe(4)
  })
})

describe('contentBounds', () => {
  it('spans the rectangles and the view', () => {
    const rects = [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 100, y: 50, width: 20, height: 20 }
    ]
    const view = { x: -5, y: 5, width: 50, height: 200 }
    expect(contentBounds(rects, view)).toEqual({ x: -5, y: 0, width: 125, height: 205 })
  })

  it('is the view when there are no rectangles', () => {
    const view = { x: 1, y: 2, width: 3, height: 4 }
    expect(contentBounds([], view)).toEqual(view)
  })

  it('grows by the same amount on every side', () => {
    expect(inflate({ x: 0, y: 10, width: 100, height: 50 }, 60)).toEqual({
      x: -60,
      y: -50,
      width: 220,
      height: 170
    })
  })
})

describe('minimap', () => {
  const size = { width: 180, height: 120 }

  it('fits the bounds into the map and anchors them at its corner', () => {
    expect(minimapTransform({ x: -60, y: -60, width: 360, height: 240 }, size)).toEqual({
      scale: 0.5,
      offsetX: 30,
      offsetY: 30
    })
  })

  it('takes the tighter axis for the scale', () => {
    const wide = minimapTransform({ x: 0, y: 0, width: 1800, height: 100 }, size)
    expect(wide.scale).toBeCloseTo(0.1)
    const tall = minimapTransform({ x: 0, y: 0, width: 100, height: 2400 }, size)
    expect(tall.scale).toBeCloseTo(0.05)
  })

  it('survives empty bounds', () => {
    const t = minimapTransform({ x: 0, y: 0, width: 0, height: 0 }, size)
    expect(Number.isFinite(t.scale)).toBe(true)
    expect(t.scale).toBeGreaterThan(0)
  })

  it('maps a rectangle into the map and a map point back to the canvas', () => {
    const t = minimapTransform({ x: -60, y: -60, width: 360, height: 240 }, size)
    expect(toMinimap({ x: 0, y: 0, width: 100, height: 40 }, t)).toEqual({ x: 30, y: 30, width: 50, height: 20 })
    expect(fromMinimap({ x: 30, y: 30 }, t)).toEqual({ x: 0, y: 0 })
    expect(fromMinimap({ x: 180, y: 120 }, t)).toEqual({ x: 300, y: 180 })
  })
})

describe('cull', () => {
  const area = { x: 0, y: 0, width: 100, height: 100 }
  const inside = { id: 'in', x: 10, y: 10, width: 20, height: 20 }
  const touching = { id: 'edge', x: 100, y: 0, width: 20, height: 20 }
  const outside = { id: 'out', x: 500, y: 500, width: 20, height: 20 }

  it('keeps the boxes that meet the area', () => {
    expect(cull([inside, outside, touching], area, null)).toEqual([inside, touching])
  })

  it('never drops the box with the given id', () => {
    expect(cull([inside, outside], area, 'out')).toEqual([inside, outside])
  })

  it('keeps the order and returns nothing for no boxes', () => {
    expect(cull([outside, inside], area, null).map((box) => box.id)).toEqual(['in'])
    expect(cull([], area, 'x')).toEqual([])
  })
})
