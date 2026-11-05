import { useCallback, useMemo, useState } from 'react'
import type { EditorFeature } from '@renderer/editor'
import { CULL_MARGIN, cull, nextZIndex, screenToCanvas, visibleRect } from './geometry'
import Minimap from './Minimap'
import { isTextBox, newTextBox } from './model'
import TextBox from './TextBox'
import { useContentStore } from './contentStore'
import { useViewport } from './useViewport'
import ZoomControls from './ZoomControls'

interface Props {
  features: EditorFeature[]
}

export default function CanvasView({ features }: Props): React.JSX.Element {
  const content = useContentStore((state) => state.content)
  const error = useContentStore((state) => state.error)
  const addElement = useContentStore((state) => state.addElement)
  const updateElement = useContentStore((state) => state.updateElement)
  const commitElement = useContentStore((state) => state.commitElement)
  const deleteElement = useContentStore((state) => state.deleteElement)

  const { ref, viewport, size, panHandlers, step, reset, navigateTo } = useViewport()
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const focus = useCallback((id: string) => setFocusedId(id), [])
  const blur = useCallback((id: string) => setFocusedId((current) => (current === id ? null : current)), [])

  // Only text boxes are drawn; other elements stay in the content and are saved with it
  const boxes = useMemo(() => (content?.elements ?? []).filter(isTextBox), [content])
  const measured = size.width > 0 && size.height > 0
  const mounted = measured
    ? cull(boxes, visibleRect(viewport, size.width, size.height, CULL_MARGIN), focusedId)
    : boxes

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget) return
    const origin = e.currentTarget.getBoundingClientRect()
    const point = screenToCanvas({ x: e.clientX - origin.left, y: e.clientY - origin.top }, viewport)
    addElement(newTextBox(point, nextZIndex(boxes)))
  }

  const isEmpty = content !== null && content.elements.length === 0

  return (
    <div
      ref={ref}
      className="relative h-full w-full overflow-hidden bg-[#f0f0f0] dark:bg-[#111827]"
      onPointerDown={panHandlers.onPointerDown}
      onMouseDown={panHandlers.onMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`
        }}
      >
        {mounted.map((box) => (
          <TextBox
            key={box.id}
            element={box}
            features={features}
            zoom={viewport.zoom}
            focused={box.id === focusedId}
            onFocus={focus}
            onBlur={blur}
            onUpdate={updateElement}
            onCommit={commitElement}
            onDelete={deleteElement}
          />
        ))}
      </div>

      <div className="absolute bottom-3 right-4 flex flex-col items-end gap-2 select-none">
        {boxes.length > 0 && measured && (
          <Minimap
            boxes={boxes}
            view={visibleRect(viewport, size.width, size.height, 0)}
            onNavigate={navigateTo}
          />
        )}
        <ZoomControls zoom={viewport.zoom} onStep={step} onReset={reset} />
      </div>

      {(error || isEmpty) && (
        <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
          {error ? (
            <p role="alert" className="text-sm wrap-anywhere text-red-600 dark:text-red-400">
              {`Couldn't open this page: ${error}`}
            </p>
          ) : (
            <p className="text-sm text-gray-400 select-none dark:text-gray-500">
              Double-click anywhere to add a text box
            </p>
          )}
        </div>
      )}
    </div>
  )
}
