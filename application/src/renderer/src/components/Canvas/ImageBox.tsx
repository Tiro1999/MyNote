import { useCallback, useEffect, useRef, useState } from 'react'
import { useNotebookStore } from '../../store/notebookStore'
import { browserRenderDeps, resolveDisplayUrl } from '../../images/render'
import type { ImageElement } from '../../types'

interface Props {
  element: ImageElement
  onUpdate: (updates: Partial<ImageElement>) => void
  onDelete: () => void
}

let cacheDirPromise: Promise<string> | null = null
function cacheDir(): Promise<string> {
  if (!cacheDirPromise) cacheDirPromise = window.api.images.cacheDir()
  return cacheDirPromise
}

/**
 * A freely placed image on the canvas — the counterpart to TextBox. Resizing is
 * aspect-locked, driven by the element's own width/height ratio.
 */
export default function ImageBox({ element, onUpdate, onDelete }: Props): JSX.Element {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const dragStart = useRef({ mouseX: 0, mouseY: 0, elementX: 0, elementY: 0 })
  const resizeStart = useRef({ mouseX: 0, width: 0, ratio: 1 })

  useEffect(() => {
    let cancelled = false
    const run = async (): Promise<void> => {
      const pageDir = useNotebookStore.getState().activeContentDir()
      if (!pageDir) return
      const result = await resolveDisplayUrl(
        { mode: element.mode, src: element.src },
        browserRenderDeps(pageDir, await cacheDir())
      )
      if (cancelled) return
      if (result.ok) {
        setUrl(result.url)
        setFailed(null)
      } else {
        setUrl(null)
        setFailed(result.detail)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [element.mode, element.src])

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return
      event.stopPropagation()
      dragStart.current = {
        mouseX: event.clientX,
        mouseY: event.clientY,
        elementX: element.x,
        elementY: element.y
      }
      const move = (moveEvent: MouseEvent): void => {
        onUpdate({
          x: dragStart.current.elementX + (moveEvent.clientX - dragStart.current.mouseX),
          y: dragStart.current.elementY + (moveEvent.clientY - dragStart.current.mouseY)
        })
      }
      const up = (): void => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
    [element.x, element.y, onUpdate]
  )

  const handleResizeMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      resizeStart.current = {
        mouseX: event.clientX,
        width: element.width,
        ratio: element.height / Math.max(1, element.width)
      }
      const move = (moveEvent: MouseEvent): void => {
        const width = Math.max(
          60,
          resizeStart.current.width + (moveEvent.clientX - resizeStart.current.mouseX)
        )
        onUpdate({ width, height: Math.round(width * resizeStart.current.ratio) })
      }
      const up = (): void => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
    [element.width, element.height, onUpdate]
  )

  return (
    <div
      data-canvas-element
      className="absolute group"
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex
      }}
      onMouseDown={handleMouseDown}
    >
      {url ? (
        <img
          src={url}
          alt={element.alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-full rounded object-contain"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-gray-400 bg-white/70 p-2 text-center text-xs text-gray-500 dark:border-gray-600 dark:bg-gray-900/70 dark:text-gray-400">
          {failed ? `Bild nicht gefunden: ${failed}` : 'Bild wird geladen…'}
        </div>
      )}

      <button
        className="absolute -top-2 -right-2 hidden h-5 w-5 items-center justify-center rounded-full
                   bg-red-500 text-xs leading-none text-white opacity-0 transition-opacity
                   group-hover:flex group-hover:opacity-100"
        onMouseDown={(event) => {
          event.stopPropagation()
          onDelete()
        }}
      >
        ×
      </button>

      <div
        className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          background: 'linear-gradient(135deg, transparent 50%, #94a3b8 50%)',
          borderBottomRightRadius: '2px'
        }}
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  )
}
