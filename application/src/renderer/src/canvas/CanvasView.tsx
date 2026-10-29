import { useRef, useState, useCallback, useEffect } from 'react'
import { nanoid } from 'nanoid'
import { useNotebookStore } from '@renderer/notebook'
import TextBox from './TextBox'
import Minimap from './Minimap'
import type { TextBoxElement } from '@renderer/notebook'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 3.0

export default function CanvasView(): JSX.Element {
  const { pageContent, addElement, updateElement, deleteElement, savePageContent } =
    useNotebookStore()

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 40, y: 40 })
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })
  const isPanning = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const viewportRef = useRef<HTMLDivElement>(null)

  // Ctrl+Scroll → zoom; plain scroll → pan
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.001)))
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
    }
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Track the viewport size so we can render only the elements currently in view.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = (): void => setViewportSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle-click or Alt+Left-click → pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true
      lastMouse.current = { x: e.clientX, y: e.clientY }
      e.preventDefault()
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
  }

  const handleMouseUp = () => {
    isPanning.current = false
  }

  // Viewport culling: render only elements whose box intersects the visible
  // canvas rectangle (plus half a screen of buffer so panning never pops in).
  // Before the size is measured, render everything to avoid a blank first paint.
  const elements = pageContent?.elements ?? []
  const culling = viewportSize.w > 0 && viewportSize.h > 0
  const marginX = (viewportSize.w / zoom) * 0.5
  const marginY = (viewportSize.h / zoom) * 0.5
  const viewLeft = -pan.x / zoom - marginX
  const viewTop = -pan.y / zoom - marginY
  const viewRight = (viewportSize.w - pan.x) / zoom + marginX
  const viewBottom = (viewportSize.h - pan.y) / zoom + marginY
  const visibleElements = culling
    ? elements.filter(
        (el) =>
          el.x < viewRight &&
          el.x + el.width > viewLeft &&
          el.y < viewBottom &&
          el.y + el.height > viewTop
      )
    : elements

  // The actual visible canvas rectangle (no cull buffer) for the minimap.
  const viewRect = {
    left: -pan.x / zoom,
    top: -pan.y / zoom,
    right: (viewportSize.w - pan.x) / zoom,
    bottom: (viewportSize.h - pan.y) / zoom
  }
  const navigateTo = (cx: number, cy: number): void => {
    setPan({ x: viewportSize.w / 2 - cx * zoom, y: viewportSize.h / 2 - cy * zoom })
  }

  // Double-click on the background → create a new text box at cursor position
  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-canvas-element]')) return
    const rect = viewportRef.current!.getBoundingClientRect()
    const x = (e.clientX - rect.left - pan.x) / zoom
    const y = (e.clientY - rect.top - pan.y) / zoom
    const el: TextBoxElement = {
      id: nanoid(),
      type: 'textbox',
      x,
      y,
      width: 320,
      height: 200,
      zIndex: (pageContent?.elements.length ?? 0) + 1,
      content: { type: 'doc', content: [{ type: 'paragraph' }] }
    }
    addElement(el)
    setTimeout(() => savePageContent(), 50)
  }

  return (
    <div
      ref={viewportRef}
      className="relative h-full w-full overflow-hidden bg-[#f0f0f0] dark:bg-[#111827]"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Transformed canvas surface */}
      <div
        className="absolute origin-top-left"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {visibleElements.map((el) => {
          if (el.type === 'textbox') {
            return (
              <TextBox
                key={el.id}
                element={el}
                onUpdate={(updates) => {
                  updateElement(el.id, updates)
                  savePageContent()
                }}
                onDelete={() => {
                  deleteElement(el.id)
                  savePageContent()
                }}
              />
            )
          }
          return null
        })}
      </div>

      {/* Bottom-right: overview minimap + zoom/pan HUD */}
      <div className="absolute bottom-3 right-4 flex flex-col items-end gap-2 select-none">
        {elements.length > 0 && viewportSize.w > 0 && (
          <Minimap
            elements={elements.map((el) => ({
              id: el.id,
              x: el.x,
              y: el.y,
              width: el.width,
              height: el.height
            }))}
            viewport={viewRect}
            onNavigate={navigateTo}
          />
        )}
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-300">
          <button
            className="rounded-sm border border-gray-200 bg-white px-2 py-0.5 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.1).toFixed(2)))}
          >
            −
          </button>
          <span className="w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            className="rounded-sm border border-gray-200 bg-white px-2 py-0.5 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.1).toFixed(2)))}
          >
            +
          </button>
          <button
            className="ml-1 rounded-sm border border-gray-200 bg-white px-2 py-0.5 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
            onClick={() => {
              setZoom(1)
              setPan({ x: 40, y: 40 })
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Empty-page hint */}
      {(!pageContent || pageContent.elements.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-gray-400 select-none dark:text-gray-500">
            Double-click anywhere to add a text box
          </p>
        </div>
      )}
    </div>
  )
}
