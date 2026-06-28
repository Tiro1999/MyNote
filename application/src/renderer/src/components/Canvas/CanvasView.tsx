import { useRef, useState, useCallback, useEffect } from 'react'
import { nanoid } from 'nanoid'
import { useNotebookStore } from '../../store/notebookStore'
import TextBox from './TextBox'
import type { TextBoxElement } from '../../types'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 3.0

export default function CanvasView(): JSX.Element {
  const { pageContent, addElement, updateElement, deleteElement, savePageContent } =
    useNotebookStore()

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 40, y: 40 })
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
      className="relative w-full h-full overflow-hidden bg-[#f0f0f0]"
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
        {pageContent?.elements.map((el) => {
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

      {/* Zoom / pan HUD */}
      <div className="absolute bottom-3 right-4 flex items-center gap-1 text-xs text-gray-500 select-none">
        <button
          className="px-2 py-0.5 bg-white border border-gray-200 rounded hover:bg-gray-50"
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.1).toFixed(2)))}
        >
          −
        </button>
        <span className="w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button
          className="px-2 py-0.5 bg-white border border-gray-200 rounded hover:bg-gray-50"
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.1).toFixed(2)))}
        >
          +
        </button>
        <button
          className="ml-1 px-2 py-0.5 bg-white border border-gray-200 rounded hover:bg-gray-50"
          onClick={() => {
            setZoom(1)
            setPan({ x: 40, y: 40 })
          }}
        >
          Reset
        </button>
      </div>

      {/* Empty-page hint */}
      {(!pageContent || pageContent.elements.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-gray-400 text-sm select-none">
            Double-click anywhere to add a text box
          </p>
        </div>
      )}
    </div>
  )
}
