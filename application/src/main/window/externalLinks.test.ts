import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow, WindowOpenHandlerResponse } from 'electron'
import { IPC } from '@shared/ipc'
import { registerExternalLinks } from './externalLinks'

const electron = vi.hoisted(() => ({
  shell: { openExternal: vi.fn() },
  clipboard: { writeText: vi.fn() }
}))
vi.mock('electron', () => electron)

const log = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }))
vi.mock('@shared/log', () => ({ createLogger: () => log }))

type OpenHandler = (details: { url: string }) => WindowOpenHandlerResponse

function fakeWindow(destroyed = false): {
  open: (url: string) => WindowOpenHandlerResponse
  send: ReturnType<typeof vi.fn>
} {
  const webContents = { setWindowOpenHandler: vi.fn(), send: vi.fn() }
  registerExternalLinks({ isDestroyed: () => destroyed, webContents } as unknown as BrowserWindow)
  const handler: OpenHandler = webContents.setWindowOpenHandler.mock.calls[0][0]
  return { open: (url) => handler({ url }), send: webContents.send }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('registerExternalLinks', () => {
  it('opens allowed links outside the app and never in a new window', () => {
    electron.shell.openExternal.mockResolvedValue(undefined)
    const { open } = fakeWindow()
    for (const url of ['https://a.de/', 'http://a.de/x', 'mailto:x@y.z']) {
      expect(open(url)).toEqual({ action: 'deny' })
    }
    expect(electron.shell.openExternal.mock.calls).toEqual([
      ['https://a.de/'],
      ['http://a.de/x'],
      ['mailto:x@y.z']
    ])
  })

  it('copies the link and tells the renderer when no browser opens it', async () => {
    electron.shell.openExternal.mockRejectedValue(new Error('xdg-open failed'))
    const { open, send } = fakeWindow()
    expect(open('https://a.de/')).toEqual({ action: 'deny' })
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith(IPC.links.openFailed, 'https://a.de/'))
    expect(electron.clipboard.writeText).toHaveBeenCalledWith('https://a.de/')
  })

  it('only copies the link when the window is already closed', async () => {
    electron.shell.openExternal.mockRejectedValue(new Error('xdg-open failed'))
    const { open, send } = fakeWindow(true)
    open('https://a.de/')
    await vi.waitFor(() => expect(electron.clipboard.writeText).toHaveBeenCalledWith('https://a.de/'))
    expect(send).not.toHaveBeenCalled()
  })

  it('blocks a URL with a tab, newline, control character or backslash, which would open another host', () => {
    const { open } = fakeWindow()
    for (const url of ['https://good.com\t@example.net/', 'https://good.com\n@example.net/', 'https://good.com\u0001@example.net/', 'https://example.net\\.good.com/']) {
      expect(open(url)).toEqual({ action: 'deny' })
    }
    expect(electron.shell.openExternal).not.toHaveBeenCalled()
    expect(log.warn).toHaveBeenCalledTimes(4)
  })

  it('blocks every other protocol with a warning', () => {
    const { open } = fakeWindow()
    for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'not a url']) {
      expect(open(url)).toEqual({ action: 'deny' })
    }
    expect(electron.shell.openExternal).not.toHaveBeenCalled()
    expect(log.warn).toHaveBeenCalledTimes(3)
  })
})
