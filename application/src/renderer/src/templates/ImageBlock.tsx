import { useCallback, useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useNotebookStore } from '../store/notebookStore'
import { useExternalImageStore } from '../store/externalImageStore'
import { browserRenderDeps, resolveDisplayUrl } from '../images/render'
import { IMAGE_FILE_FILTERS } from '../images/import'
import { detachImageToCanvas } from '../images/detach'
import type { NotebookImageAttrs, NotebookImageOptions } from './NotebookImageExtension'

const MIN_WIDTH = 80
const MAX_WIDTH = 2000

/** Asked once per session — the path never changes while the app runs. */
let cacheDirPromise: Promise<string> | null = null
function cacheDir(): Promise<string> {
  if (!cacheDirPromise) cacheDirPromise = window.api.images.cacheDir()
  return cacheDirPromise
}

type Resolution =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'failed'; reason: 'missing' | 'remote'; detail: string }

/** Host of a URL for the consent placeholder, or the raw string if it does not parse. */
function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * Node view for `notebookImage`. Resolves the stored reference to an `asset:` URL
 * when it comes into existence, renders lazily, and shows an explanatory placeholder
 * rather than a broken image when the source is gone.
 */
export default function ImageBlock(props: NodeViewProps): JSX.Element {
  const attrs = props.node.attrs as NotebookImageAttrs
  const [resolution, setResolution] = useState<Resolution>({ status: 'loading' })
  const resizeStart = useRef({ mouseX: 0, width: 0 })
  const trustExternalImages = useExternalImageStore((state) => state.trustExternalImages)
  const trustAll = useExternalImageStore((state) => state.trustAll)
  const [allowedOnce, setAllowedOnce] = useState(false)
  const remoteBlocked = attrs.mode === 'url' && !trustExternalImages && !allowedOnce

  useEffect(() => {
    let cancelled = false
    setResolution({ status: 'loading' })

    const run = async (): Promise<void> => {
      const pageDir = useNotebookStore.getState().activeContentDir()
      if (!pageDir) return
      if (remoteBlocked) return
      const result = await resolveDisplayUrl(
        { mode: attrs.mode, src: attrs.src },
        browserRenderDeps(pageDir, await cacheDir())
      )
      if (cancelled) return
      setResolution(
        result.ok
          ? { status: 'ready', url: result.url }
          : { status: 'failed', reason: result.reason, detail: result.detail }
      )
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [attrs.mode, attrs.src, remoteBlocked])

  const handleResizeMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      resizeStart.current = {
        mouseX: event.clientX,
        width: attrs.width ?? attrs.naturalWidth ?? 320
      }
      const move = (moveEvent: MouseEvent): void => {
        const next = resizeStart.current.width + (moveEvent.clientX - resizeStart.current.mouseX)
        props.updateAttributes({
          width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(next)))
        })
      }
      const up = (): void => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
    [attrs.width, attrs.naturalWidth, props]
  )

  const relink = useCallback(async () => {
    const picked = await window.api.dialog.openFile(IMAGE_FILE_FILTERS)
    if (picked) props.updateAttributes({ src: picked, mode: 'link' })
  }, [props])

  const aspectRatio =
    attrs.naturalWidth && attrs.naturalHeight
      ? `${attrs.naturalWidth} / ${attrs.naturalHeight}`
      : undefined

  return (
    <NodeViewWrapper className="notebook-image" data-notebook-image="">
      <div className="notebook-image-frame" style={{ width: attrs.width ?? undefined }}>
        {remoteBlocked && (
          <div className="notebook-image-placeholder">
            <p className="notebook-image-placeholder-title">Externes Bild</p>
            <p className="notebook-image-placeholder-detail">{hostOf(attrs.src)}</p>
            <div className="notebook-image-placeholder-actions">
              <button type="button" onClick={() => setAllowedOnce(true)}>
                Laden
              </button>
              <button type="button" onClick={trustAll}>
                Immer laden
              </button>
            </div>
          </div>
        )}

        {!remoteBlocked && resolution.status === 'ready' && (
          <img
            src={resolution.url}
            alt={attrs.alt}
            loading="lazy"
            decoding="async"
            style={{ aspectRatio }}
            onLoad={(event) => {
              if (attrs.naturalWidth) return
              props.updateAttributes({
                naturalWidth: event.currentTarget.naturalWidth,
                naturalHeight: event.currentTarget.naturalHeight
              })
            }}
          />
        )}

        {!remoteBlocked && resolution.status === 'loading' && (
          <div className="notebook-image-placeholder" style={{ aspectRatio }}>
            Bild wird geladen…
          </div>
        )}

        {!remoteBlocked && resolution.status === 'failed' && (
          <div className="notebook-image-placeholder">
            <p className="notebook-image-placeholder-title">
              {resolution.reason === 'missing'
                ? 'Bilddatei nicht gefunden'
                : 'Bild konnte nicht geladen werden'}
            </p>
            <p className="notebook-image-placeholder-detail">{resolution.detail}</p>
            {resolution.reason === 'missing' && (
              <button type="button" onClick={() => void relink()}>
                Neu verknüpfen…
              </button>
            )}
          </div>
        )}

        {!remoteBlocked && resolution.status === 'ready' && (
          <button
            type="button"
            className="notebook-image-detach"
            title="Bild aufs Canvas lösen"
            onClick={() => {
              const { hostElementId } = props.extension.options as NotebookImageOptions
              detachImageToCanvas(attrs, hostElementId)
              props.deleteNode()
            }}
          >
            Lösen
          </button>
        )}

        <div
          className="notebook-image-handle"
          onMouseDown={handleResizeMouseDown}
          title="Breite ziehen"
        />
      </div>
    </NodeViewWrapper>
  )
}
