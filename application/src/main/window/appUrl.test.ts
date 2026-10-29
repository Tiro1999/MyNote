import { pathToFileURL } from 'url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { appBaseUrl, isAppUrl } from './appUrl'

const electron = vi.hoisted(() => ({ app: { isPackaged: true } }))
vi.mock('electron', () => electron)

afterEach(() => {
  vi.unstubAllEnvs()
  electron.app.isPackaged = true
})

describe('isAppUrl', () => {
  const dev = 'http://localhost:5173/'
  const prod = 'file:///app/out/renderer/index.html'

  it('accepts the dev server origin only', () => {
    expect(isAppUrl('http://localhost:5173/#x', dev)).toBe(true)
    expect(isAppUrl('http://localhost:5174/', dev)).toBe(false)
    expect(isAppUrl('https://evil.example/', dev)).toBe(false)
  })

  it('accepts the packaged page only, ignoring query and hash', () => {
    expect(isAppUrl(prod + '#/p', prod)).toBe(true)
    expect(isAppUrl(prod + '?x=1', prod)).toBe(true)
    expect(isAppUrl('file:///etc/passwd', prod)).toBe(false)
    expect(isAppUrl('file://evil-host/app/out/renderer/index.html', prod)).toBe(false)
  })

  it('rejects a missing or unparsable URL', () => {
    expect(isAppUrl('', dev)).toBe(false)
    expect(isAppUrl('', prod)).toBe(false)
    expect(isAppUrl('about:blank', dev)).toBe(false)
  })

  it('keeps POSIX paths case-sensitive', () => {
    expect(isAppUrl('file:///APP/out/renderer/index.html', prod)).toBe(false)
  })
})

describe('isAppUrl with a packaged Windows page', () => {
  const page = 'D:\\Apps\\Notizbuch äöü #1 %\\resources\\app.asar\\out\\renderer\\index.html'
  const base = pathToFileURL(page, { windows: true }).href

  it('accepts its own page despite spaces, umlauts, # and %', () => {
    expect(isAppUrl(`${base}#/p`, base)).toBe(true)
  })

  it('ignores the drive-letter case that Node keeps and Chromium uppercases', () => {
    const lowerDriveBase = pathToFileURL(`d${page.slice(1)}`, { windows: true }).href
    expect(lowerDriveBase.startsWith('file:///d:/')).toBe(true)
    expect(isAppUrl(`${base}#/p`, lowerDriveBase)).toBe(true)
  })

  it('compares decoded paths, not their escapes', () => {
    const quoted = pathToFileURL("D:\\Apps\\Rock 'n' Roll\\index.html", { windows: true }).href
    expect(isAppUrl('file:///D:/Apps/Rock%20%27n%27%20Roll/index.html', quoted)).toBe(true)
  })

  it('rejects another file on the same drive', () => {
    expect(isAppUrl('file:///D:/Apps/Other/index.html', base)).toBe(false)
  })
})

describe('appBaseUrl', () => {
  it('uses ELECTRON_RENDERER_URL only when the app is not packaged', () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173/')
    electron.app.isPackaged = false
    expect(appBaseUrl()).toBe('http://localhost:5173/')
    electron.app.isPackaged = true
    expect(appBaseUrl()).toMatch(/^file:\/\/.*\/renderer\/index\.html$/)
  })
})
