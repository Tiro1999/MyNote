import { net, protocol } from 'electron'
import { pathToFileURL } from 'node:url'
import { decodeAssetUrl } from './imageRules'

/**
 * Serves local image files to the renderer as `asset://img/<encoded absolute path>`.
 *
 * Why a custom scheme rather than `file://`: in development the renderer is served
 * from http://localhost, and Chromium blocks file:// subresources on an http page —
 * so a `<img src="file://…">` works only in the packaged app. `asset:` behaves the
 * same in both, streams from disk instead of copying bytes through the IPC bridge,
 * and takes part in Chromium's normal image cache.
 *
 * Read-only, and only for image extensions: this must not become a second, broader
 * file-read channel next to `fs:readFile`.
 */
export function registerAssetProtocol(): void {
  protocol.handle('asset', async (request) => {
    const decoded = decodeAssetUrl(request.url)
    if (!decoded.ok) {
      console.warn('Blocked asset request:', request.url, '—', decoded.reason)
      return new Response(decoded.reason, { status: decoded.status })
    }
    try {
      return await net.fetch(pathToFileURL(decoded.filePath).toString())
    } catch (error) {
      console.warn('Asset not readable:', decoded.filePath, error)
      return new Response('not found', { status: 404 })
    }
  })
}
