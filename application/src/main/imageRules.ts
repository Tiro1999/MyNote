import { createHash } from 'node:crypto'
import { extname, isAbsolute, normalize } from 'node:path'

/** Extensions the `asset:` protocol will serve, with the leading dot. Mirrors
 * IMAGE_EXTENSIONS in src/renderer/src/images/source.ts — main and renderer are
 * separate TypeScript projects and cannot share a module. */
const ALLOWED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.svg',
  '.bmp',
  '.avif'
])

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/avif': 'avif'
}

/** Hard caps for remote image downloads. */
export const REMOTE_MAX_BYTES = 20 * 1024 * 1024
export const REMOTE_TIMEOUT_MS = 15_000

export type AssetPathResult =
  | { ok: true; filePath: string }
  | { ok: false; status: number; reason: string }

/**
 * Decodes and validates an `asset://img/<encoded absolute path>` URL.
 * Normalisation collapses `..` so the served path is always canonical; the actual
 * guards are that the path must be absolute and must carry an image extension.
 */
export function decodeAssetUrl(rawUrl: string): AssetPathResult {
  let pathname: string
  try {
    pathname = new URL(rawUrl).pathname
  } catch {
    return { ok: false, status: 400, reason: 'malformed url' }
  }

  let decoded: string
  try {
    decoded = decodeURIComponent(pathname.replace(/^\//, ''))
  } catch {
    return { ok: false, status: 400, reason: 'malformed escape sequence' }
  }

  if (!decoded) return { ok: false, status: 400, reason: 'empty path' }

  const filePath = normalize(decoded)
  if (!isAbsolute(filePath)) return { ok: false, status: 400, reason: 'path is not absolute' }
  if (!ALLOWED_EXTENSIONS.has(extname(filePath).toLowerCase())) {
    return { ok: false, status: 400, reason: 'unsupported file type' }
  }
  return { ok: true, filePath }
}

export function isAllowedRemoteUrl(raw: string): boolean {
  try {
    const protocol = new URL(raw).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/** Extension for a response Content-Type, or '' when it is not a supported image. */
export function extensionForContentType(contentType: string): string {
  const bareType = contentType.split(';')[0].trim().toLowerCase()
  return CONTENT_TYPE_EXTENSIONS[bareType] ?? ''
}

function urlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 32)
}

/** Cache name derivable from the URL alone, so a cache hit can skip the network
 * entirely. Null when the URL carries no usable image extension. */
export function remoteCacheFileNameFromUrl(url: string): string | null {
  const withoutQuery = url.split(/[?#]/)[0]
  const extension = withoutQuery.slice(withoutQuery.lastIndexOf('.') + 1).toLowerCase()
  if (!withoutQuery.includes('.') || !ALLOWED_EXTENSIONS.has(`.${extension}`)) return null
  return `remote-${urlHash(url)}.${extension}`
}

/** Cache name once the response Content-Type is known. Agrees with
 * remoteCacheFileNameFromUrl whenever that one returns a name. */
export function remoteCacheFileName(url: string, contentType: string): string {
  return (
    remoteCacheFileNameFromUrl(url) ?? `remote-${urlHash(url)}.${extensionForContentType(contentType)}`
  )
}
