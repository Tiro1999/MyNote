import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appBaseUrl } from './appUrl'
import { registerExternalLinks } from './externalLinks'
import { createMainWindow } from './mainWindow'

const electron = vi.hoisted(() => {
  const session = { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() }
  const win = {
    on: vi.fn(),
    show: vi.fn(),
    loadURL: vi.fn(() => Promise.resolve()),
    webContents: { on: vi.fn(), session }
  }
  return {
    win,
    session,
    app: { isPackaged: true },
    BrowserWindow: vi.fn(function (_options: unknown) {
      return win
    })
  }
})
vi.mock('electron', () => electron)
vi.mock('./externalLinks', () => ({ registerExternalLinks: vi.fn() }))
vi.mock('@shared/log', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

function listener(target: { on: ReturnType<typeof vi.fn> }, name: string): (...args: unknown[]) => unknown {
  const call = target.on.mock.calls.find(([event]) => event === name)
  if (!call) throw new Error(`No listener for ${name}`)
  return call[1]
}

beforeEach(() => {
  vi.clearAllMocks()
  createMainWindow()
})

describe('createMainWindow', () => {
  it('keeps the window size and title and sandboxes the renderer', () => {
    expect(electron.BrowserWindow.mock.calls[0][0]).toMatchObject({
      width: 1400,
      height: 900,
      minWidth: 900,
      minHeight: 600,
      show: false,
      autoHideMenuBar: true,
      title: 'MyNote',
      webPreferences: {
        preload: expect.stringMatching(/preload[\\/]index\.js$/),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
  })

  it('loads the app page, shows it when ready and handles its links', () => {
    expect(electron.win.loadURL).toHaveBeenCalledWith(appBaseUrl())
    listener(electron.win, 'ready-to-show')()
    expect(electron.win.show).toHaveBeenCalled()
    expect(registerExternalLinks).toHaveBeenCalledWith(electron.win)
  })

  it('blocks navigation and redirects away from the app page', () => {
    for (const name of ['will-navigate', 'will-redirect']) {
      const guard = listener(electron.win.webContents, name)
      const foreign = { url: 'https://evil.example/', preventDefault: vi.fn() }
      const own = { url: `${appBaseUrl()}#/page`, preventDefault: vi.fn() }
      guard(foreign)
      guard(own)
      expect(foreign.preventDefault).toHaveBeenCalled()
      expect(own.preventDefault).not.toHaveBeenCalled()
    }
  })

  it('denies every permission request and check', () => {
    const request = electron.session.setPermissionRequestHandler.mock.calls[0][0]
    const callback = vi.fn()
    request({}, 'media', callback, {})
    expect(callback).toHaveBeenCalledWith(false)
    const check = electron.session.setPermissionCheckHandler.mock.calls[0][0]
    expect(check({}, 'clipboard-read', 'file://', {})).toBe(false)
  })
})
