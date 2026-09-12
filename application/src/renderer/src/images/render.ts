import {
  RENDER_PROFILE,
  assetUrl,
  cacheFileName,
  fitWithin,
  needsRenderCache,
  resolveStoredPath,
  type ImageSource
} from './source'

export interface RenderDeps {
  /** Absolute folder of the page the image sits on — a `copy` src is relative to it. */
  pageDir: string
  /** Absolute render-cache folder, from window.api.images.cacheDir(). */
  cacheDir: string
  stat(path: string): Promise<{ size: number; mtimeMs: number } | null>
  exists(path: string): Promise<boolean>
  /** Decodes `sourceUrl`, downscales it to RENDER_PROFILE and writes it to `targetPath`. */
  writeThumbnail(sourceUrl: string, targetPath: string): Promise<void>
  fetchRemote(url: string): Promise<{ path: string } | { error: string }>
}

export type RenderResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'missing' | 'remote'; detail: string }

/** Keyed by target cache path: two nodes showing the same source must not race on
 * the same file, and the expensive decode must happen once. */
const inFlightThumbnails = new Map<string, Promise<void>>()

function ensureThumbnail(sourceUrl: string, targetPath: string, deps: RenderDeps): Promise<void> {
  const running = inFlightThumbnails.get(targetPath)
  if (running) return running
  const started = deps
    .writeThumbnail(sourceUrl, targetPath)
    .finally(() => inFlightThumbnails.delete(targetPath))
  inFlightThumbnails.set(targetPath, started)
  return started
}

/** Renders a local file, going through the render cache when it is large. */
async function resolveLocalPath(filePath: string, deps: RenderDeps): Promise<RenderResult> {
  const stats = await deps.stat(filePath)
  if (!stats) return { ok: false, reason: 'missing', detail: filePath }

  if (!needsRenderCache(stats.size)) return { ok: true, url: assetUrl(filePath) }

  const cachePath = `${deps.cacheDir}/${cacheFileName(filePath, stats.mtimeMs, stats.size)}`
  if (await deps.exists(cachePath)) return { ok: true, url: assetUrl(cachePath) }

  try {
    await ensureThumbnail(assetUrl(filePath), cachePath, deps)
    return { ok: true, url: assetUrl(cachePath) }
  } catch (error) {
    // A heavy image beats no image — the cache is an optimisation, not a requirement.
    console.warn('Could not build a render-cache entry for', filePath, error)
    return { ok: true, url: assetUrl(filePath) }
  }
}

/**
 * Turns a stored reference into a URL an `<img>` can display. A remote source is
 * downloaded into the cache first and then follows exactly the same local path, so
 * an oversized download is downscaled like any other large file.
 */
export async function resolveDisplayUrl(
  source: ImageSource,
  deps: RenderDeps
): Promise<RenderResult> {
  if (source.mode === 'url') {
    const downloaded = await deps.fetchRemote(source.src)
    if ('error' in downloaded) return { ok: false, reason: 'remote', detail: downloaded.error }
    return resolveLocalPath(downloaded.path, deps)
  }

  const filePath = resolveStoredPath(source, deps.pageDir)
  if (!filePath) return { ok: false, reason: 'missing', detail: source.src }
  return resolveLocalPath(filePath, deps)
}

/** Wires RenderDeps to the real preload bridge and the DOM canvas encoder. */
export function browserRenderDeps(pageDir: string, cacheDir: string): RenderDeps {
  return {
    pageDir,
    cacheDir,
    stat: (path) => window.api.fs.statFile(path),
    exists: (path) => window.api.fs.exists(path),
    fetchRemote: (url) => window.api.images.fetchRemote(url),
    writeThumbnail: async (sourceUrl, targetPath) => {
      const image = new Image()
      image.src = sourceUrl
      await image.decode()
      const target = fitWithin(image.naturalWidth, image.naturalHeight, RENDER_PROFILE.maxEdge)
      const canvas = document.createElement('canvas')
      canvas.width = target.width
      canvas.height = target.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('2d canvas context unavailable')
      context.drawImage(image, 0, 0, target.width, target.height)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, RENDER_PROFILE.mimeType, RENDER_PROFILE.quality)
      )
      if (!blob) throw new Error('webp encoding unavailable')
      await window.api.fs.writeBinary(targetPath, new Uint8Array(await blob.arrayBuffer()))
    }
  }
}
