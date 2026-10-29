import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '@shared/ipc'
import { invokeIpc } from '../ipc.testing'
import { writeSettings } from '../settings/settings'
import { checkForUpdatesIfEnabled, registerUpdatesIpc } from './updates'

const electron = vi.hoisted(() => {
  const showNotification = vi.fn()
  return {
    showNotification,
    app: { isPackaged: true, getVersion: () => '0.1.0', getPath: vi.fn() },
    ipcMain: { handle: vi.fn() },
    Notification: vi.fn(function () {
      return { show: showNotification }
    })
  }
})
vi.mock('electron', () => electron)

const updater = await vi.hoisted(async () => {
  const { EventEmitter } = await import('events')
  return { autoUpdater: Object.assign(new EventEmitter(), { checkForUpdates: vi.fn() }) }
})
vi.mock('electron-updater', () => updater)

const log = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }))
vi.mock('@shared/log', () => ({ createLogger: () => log }))

const realPlatform = process.platform
let userData: string

function setPlatform(value: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value })
}

function updateFound(downloadPromise: Promise<string[]>): void {
  updater.autoUpdater.checkForUpdates.mockResolvedValueOnce({
    isUpdateAvailable: true,
    updateInfo: { version: '0.2.0' },
    downloadPromise
  })
}

const check = (): Promise<unknown> => invokeIpc(electron.ipcMain.handle, IPC.updates.check)

beforeEach(async () => {
  vi.clearAllMocks()
  updater.autoUpdater.checkForUpdates.mockReset().mockResolvedValue(null)
  updater.autoUpdater.removeAllListeners()
  electron.app.isPackaged = true
  setPlatform('linux')
  userData = await mkdtemp(join(tmpdir(), 'mynote-updates-'))
  electron.app.getPath.mockReturnValue(userData)
  registerUpdatesIpc()
})

afterEach(async () => {
  setPlatform(realPlatform)
  await rm(userData, { recursive: true, force: true })
})

describe('updates:check', () => {
  it('reports dev when the app is not packaged', async () => {
    electron.app.isPackaged = false
    expect(await check()).toEqual({ status: 'dev' })
    expect(updater.autoUpdater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('reports unsupported on macOS', async () => {
    setPlatform('darwin')
    expect(await check()).toEqual({ status: 'unsupported' })
    expect(updater.autoUpdater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('reports an available update with its version', async () => {
    updateFound(Promise.resolve(['/cache/MyNote-0.2.0.exe']))
    expect(await check()).toEqual({ status: 'available', version: '0.2.0' })
  })

  it('reports the running version when there is no update', async () => {
    updater.autoUpdater.checkForUpdates.mockResolvedValueOnce({
      isUpdateAvailable: false,
      updateInfo: { version: '0.0.9' }
    })
    expect(await check()).toEqual({ status: 'not-available', version: '0.1.0' })
    updater.autoUpdater.checkForUpdates.mockResolvedValueOnce(null)
    expect(await check()).toEqual({ status: 'not-available', version: '0.1.0' })
  })

  it('reports the error message when the check fails', async () => {
    const offline = new Error('net::ERR_INTERNET_DISCONNECTED')
    updater.autoUpdater.checkForUpdates.mockRejectedValueOnce(offline)
    expect(await check()).toEqual({ status: 'error', error: 'net::ERR_INTERNET_DISCONNECTED' })
  })

  it('logs a failed download instead of leaving it unhandled', async () => {
    updateFound(Promise.reject(new Error('disk full')))
    expect(await check()).toEqual({ status: 'available', version: '0.2.0' })
    await vi.waitFor(() => expect(log.warn).toHaveBeenCalledOnce())
  })
})

describe('updater errors', () => {
  it('are logged, so an error event from the quit handler never throws', () => {
    expect(() => updater.autoUpdater.emit('error', new Error('install failed'))).not.toThrow()
    expect(log.warn).toHaveBeenCalledOnce()
  })
})

describe('checkForUpdatesIfEnabled', () => {
  it('checks a packaged app with updates enabled', () => {
    checkForUpdatesIfEnabled()
    expect(updater.autoUpdater.checkForUpdates).toHaveBeenCalledOnce()
  })

  it.each([
    ['updates are turned off', () => writeSettings({ autoUpdateEnabled: false })],
    ['the app is not packaged', () => void (electron.app.isPackaged = false)],
    ['the platform is macOS', () => setPlatform('darwin')]
  ])('skips the check when %s', async (_, arrange) => {
    await arrange()
    checkForUpdatesIfEnabled()
    expect(updater.autoUpdater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('logs a failed check instead of rejecting', async () => {
    updater.autoUpdater.checkForUpdates.mockRejectedValueOnce(new Error('offline'))
    checkForUpdatesIfEnabled()
    await vi.waitFor(() => expect(log.error).toHaveBeenCalledOnce())
  })

  it('tells the user when the downloaded update is ready', async () => {
    updateFound(Promise.resolve(['/cache/MyNote-0.2.0.exe']))
    checkForUpdatesIfEnabled()
    await vi.waitFor(() => expect(electron.showNotification).toHaveBeenCalledOnce())
    expect(electron.Notification).toHaveBeenCalledWith({
      title: 'Update ready',
      body: 'MyNote 0.2.0 will be installed when you quit.'
    })
  })

  it('logs a failed download instead of leaving it unhandled', async () => {
    updateFound(Promise.reject(new Error('disk full')))
    checkForUpdatesIfEnabled()
    await vi.waitFor(() => expect(log.warn).toHaveBeenCalledOnce())
    expect(electron.Notification).not.toHaveBeenCalled()
  })
})
