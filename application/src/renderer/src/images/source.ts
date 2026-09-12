import type { ImageMode } from '../types'

/** Extensions the file picker offers and the `asset:` protocol will serve. */
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'avif'] as const

/** Formats copied verbatim: re-encoding would flatten an animation or rasterize a vector. */
const VERBATIM_EXTENSIONS = new Set(['gif', 'svg'])

/** The one quality profile, used both for `/Bild` copies and for render-cache entries. */
export const RENDER_PROFILE = {
  maxEdge: 2000,
  quality: 0.82,
  mimeType: 'image/webp',
  extension: 'webp'
} as const

/** Above this size a source is rendered from a downscaled cache entry, not the original. */
export const RENDER_CACHE_THRESHOLD_BYTES = 1024 * 1024

/** A stored image reference. How `mode` decides what `src` means is documented per mode
 * in `resolveStoredPath` below. */
export interface ImageSource {
  mode: ImageMode
  src: string
}

/** Lowercase extension without the dot, or '' when there is none. Query strings and
 * fragments are stripped first so URLs work too. */
export function extensionOf(pathOrUrl: string): string {
  const withoutQuery = pathOrUrl.split(/[?#]/)[0]
  const lastSeparator = Math.max(withoutQuery.lastIndexOf('/'), withoutQuery.lastIndexOf('\\'))
  const fileName = withoutQuery.slice(lastSeparator + 1)
  const lastDot = fileName.lastIndexOf('.')
  return lastDot <= 0 ? '' : fileName.slice(lastDot + 1).toLowerCase()
}

export function isReencodable(extension: string): boolean {
  return !VERBATIM_EXTENSIONS.has(extension.toLowerCase())
}

export function needsRenderCache(sizeInBytes: number): boolean {
  return sizeInBytes > RENDER_CACHE_THRESHOLD_BYTES
}

/** Scales `width`×`height` to fit inside a `maxEdge` square, preserving the aspect
 * ratio. Never upscales, never returns a zero dimension. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number } {
  const longestEdge = Math.max(width, height)
  if (longestEdge <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) }
  }
  const factor = maxEdge / longestEdge
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor))
  }
}

/** The URL form an `<img>` uses. The path travels percent-encoded in the URL *path*,
 * never as the host, so Windows drive letters and backslashes survive. */
export function assetUrl(absolutePath: string): string {
  return `asset://img/${encodeURIComponent(absolutePath)}`
}

/** 64-bit FNV-1a as zero-padded hex. A cache key, not a security hash. */
export function hashKey(input: string): string {
  const prime = 0x100000001b3n
  const mask = 0xffffffffffffffffn
  let hash = 0xcbf29ce484222325n
  for (let index = 0; index < input.length; index++) {
    hash ^= BigInt(input.charCodeAt(index))
    hash = (hash * prime) & mask
  }
  return hash.toString(16).padStart(16, '0')
}

/** Render-cache file name for a local source. Editing the original changes mtime and
 * size, hence the name — a stale entry is simply never read again. */
export function cacheFileName(absolutePath: string, mtimeMs: number, size: number): string {
  return `thumb-${hashKey(`${absolutePath}|${mtimeMs}|${size}`)}.${RENDER_PROFILE.extension}`
}

/** Absolute path of a stored reference, or null for a remote source — those resolve
 * through the download cache instead. */
export function resolveStoredPath(source: ImageSource, pageDir: string): string | null {
  if (source.mode === 'url') return null
  if (source.mode === 'link') return source.src
  return `${pageDir}/${source.src}`
}
