import { app, net } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import {
  REMOTE_MAX_BYTES,
  REMOTE_TIMEOUT_MS,
  isAllowedRemoteUrl,
  remoteCacheFileName,
  remoteCacheFileNameFromUrl
} from './imageRules'

/**
 * Derived, disposable, machine-local data — deliberately in userData rather than in
 * the notebook folder, so the on-disk notebook format (application/schema/) stays
 * untouched and a synced notebook carries no per-machine junk.
 */
export function imageCacheDir(): string {
  const directory = join(app.getPath('userData'), 'image-cache')
  fs.mkdirSync(directory, { recursive: true })
  return directory
}

/**
 * Downloads a remote image into the cache and returns its local path. The renderer
 * never talks to the remote host itself — that keeps the CSP free of `https:` in
 * `img-src` and leaves exactly one rendering path for all image modes.
 * Failures resolve to an error string; they never throw into the renderer.
 */
export async function fetchRemoteImage(url: string): Promise<{ path: string } | { error: string }> {
  if (!isAllowedRemoteUrl(url)) return { error: 'Nur http(s)-Adressen werden unterstützt.' }

  const cacheDirectory = imageCacheDir()
  const knownName = remoteCacheFileNameFromUrl(url)
  if (knownName) {
    const knownPath = join(cacheDirectory, knownName)
    if (fs.existsSync(knownPath)) return { path: knownPath }
  }

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), REMOTE_TIMEOUT_MS)
  try {
    const response = await net.fetch(url, { signal: abortController.signal })
    if (!response.ok) return { error: `Server antwortete mit ${response.status}.` }

    const contentType = response.headers.get('content-type') ?? ''
    const fileName = remoteCacheFileName(url, contentType)
    // remoteCacheFileName appends the content-type extension, which is '' for
    // anything that is not a supported image — so a trailing dot means "unsupported".
    if (fileName.endsWith('.')) {
      return { error: `Kein unterstütztes Bildformat (${contentType || 'unbekannt'}).` }
    }

    const declaredSize = Number(response.headers.get('content-length') ?? '0')
    if (declaredSize > REMOTE_MAX_BYTES) return { error: 'Bild ist größer als 20 MB.' }

    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength > REMOTE_MAX_BYTES) return { error: 'Bild ist größer als 20 MB.' }

    const target = join(cacheDirectory, fileName)
    await fs.promises.writeFile(target, bytes)
    return { path: target }
  } catch (error) {
    if (abortController.signal.aborted) return { error: 'Zeitüberschreitung beim Laden.' }
    return { error: error instanceof Error ? error.message : String(error) }
  } finally {
    clearTimeout(timeout)
  }
}
