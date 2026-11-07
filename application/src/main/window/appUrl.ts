import { app } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'

export function appBaseUrl(): string {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (!app.isPackaged && devUrl) return devUrl
  return pathToFileURL(join(__dirname, '../renderer/index.html')).href
}

const WINDOWS_DRIVE_PATH = /^\/[A-Za-z]:\//

// Node keeps the drive-letter case of __dirname, Chromium reports C:, so drive paths ignore case
function fileKey(url: URL): string {
  const path = decodeURIComponent(url.pathname)
  return url.host + (WINDOWS_DRIVE_PATH.test(path) ? path.toLowerCase() : path)
}

export function isAppUrl(url: string, base: string = appBaseUrl()): boolean {
  try {
    const target = new URL(url)
    const home = new URL(base)
    if (home.protocol === 'file:') {
      return target.protocol === 'file:' && fileKey(target) === fileKey(home)
    }
    const isHttp = home.protocol === 'http:' || home.protocol === 'https:'
    return isHttp && target.origin === home.origin
  } catch {
    return false
  }
}
