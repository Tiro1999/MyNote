import { CanvasView } from '@renderer/canvas'
import { useNotebookStore, type ContentRef } from '@renderer/notebook'

export function contentKey(ref: ContentRef): string {
  return `${ref.kind}:${ref.id}`
}

export function ContentArea(): React.JSX.Element {
  const selection = useNotebookStore((state) => state.selection)
  if (!selection) {
    return (
      <div className="flex h-full items-center justify-center text-lg text-gray-400 select-none dark:text-gray-500">
        Select or create a page to start
      </div>
    )
  }
  // The key gives every content a fresh canvas (pan, zoom, editors)
  return <CanvasView key={contentKey(selection)} />
}
