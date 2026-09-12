import { nanoid } from 'nanoid'
import { useNotebookStore } from '../store/notebookStore'
import type { ImageElement } from '../types'
import type { NotebookImageAttrs } from '../templates/NotebookImageExtension'

const DEFAULT_WIDTH = 320
const DEFAULT_RATIO = 0.75
const MIN_WIDTH = 80
const MAX_WIDTH = 1200
const GAP = 24

interface HostBox {
  x: number
  y: number
  width: number
  height: number
}

/** Geometry for an image detached from a text box: to the right of its host, at the
 * image's own aspect ratio. Pure so the placement maths is testable. */
export function placeDetachedImage(
  host: HostBox,
  attrs: NotebookImageAttrs,
  id: string,
  zIndex: number
): ImageElement {
  const requested = attrs.width ?? attrs.naturalWidth ?? DEFAULT_WIDTH
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(requested)))
  const ratio =
    attrs.naturalWidth && attrs.naturalHeight
      ? attrs.naturalHeight / attrs.naturalWidth
      : DEFAULT_RATIO
  return {
    id,
    type: 'image',
    x: host.x + host.width + GAP,
    y: host.y,
    width,
    height: Math.round(width * ratio),
    zIndex,
    mode: attrs.mode,
    src: attrs.src,
    alt: attrs.alt
  }
}

/**
 * Moves an image out of a text box onto the free canvas. Nothing is copied or
 * re-encoded — the canvas element carries exactly the same reference.
 */
export function detachImageToCanvas(attrs: NotebookImageAttrs, hostElementId: string): void {
  const store = useNotebookStore.getState()
  const elements = store.pageContent?.elements ?? []
  const host = elements.find((element) => element.id === hostElementId)
  if (!host) return
  store.addElement(placeDetachedImage(host, attrs, nanoid(), elements.length + 1))
  void store.savePageContent()
}
