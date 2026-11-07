import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_ID } from '@shared/app'

type Listener = (...args: unknown[]) => unknown

const electron = vi.hoisted(() => {
  const listeners: Record<string, Listener> = {}
  const win = { isMinimized: vi.fn(() => true), restore: vi.fn(), focus: vi.fn() }
  return {
    listeners,
    win,
    app: {
      requestSingleInstanceLock: vi.fn(() => true),
      whenReady: vi.fn(() => Promise.resolve()),
      on: vi.fn((name: string, listener: Listener) => {
        listeners[name] = listener
      }),
      quit: vi.fn()
    },
    BrowserWindow: { getAllWindows: vi.fn(() => [win]) }
  }
})
vi.mock('electron', () => electron)

const toolkit = vi.hoisted(() => ({
  electronApp: { setAppUserModelId: vi.fn() },
  optimizer: { watchWindowShortcuts: vi.fn() }
}))
vi.mock('@electron-toolkit/utils', () => toolkit)

const main = vi.hoisted(() => ({
  hasPendingWrites: vi.fn(() => false),
  pendingWrites: vi.fn(() => Promise.resolve()),
  registerFileIpc: vi.fn(),
  registerSettingsIpc: vi.fn(),
  registerUpdatesIpc: vi.fn(),
  checkForUpdatesIfEnabled: vi.fn(),
  registerXlsxIpc: vi.fn(),
  createMainWindow: vi.fn()
}))
vi.mock('./files/atomicWrite', () => ({
  hasPendingWrites: main.hasPendingWrites,
  pendingWrites: main.pendingWrites
}))
vi.mock('./files/files', () => ({ registerFileIpc: main.registerFileIpc }))
vi.mock('./settings/settings', () => ({ registerSettingsIpc: main.registerSettingsIpc }))
vi.mock('./finance/xlsx', () => ({ registerXlsxIpc: main.registerXlsxIpc }))
vi.mock('./window/mainWindow', () => ({ createMainWindow: main.createMainWindow }))
vi.mock('./updates/updates', () => ({
  registerUpdatesIpc: main.registerUpdatesIpc,
  checkForUpdatesIfEnabled: main.checkForUpdatesIfEnabled
}))

const log = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }))
vi.mock('@shared/log', () => ({ createLogger: () => log }))

async function start(): Promise<void> {
  vi.resetModules()
  await import('./index')
}

function quitEvent(): { preventDefault: ReturnType<typeof vi.fn> } {
  return { preventDefault: vi.fn() }
}

beforeEach(() => {
  vi.clearAllMocks()
  main.hasPendingWrites.mockReturnValue(false)
})

afterEach(() => {
  vi.useRealTimers()
  vi.doUnmock('@shared/features')
})

describe('startup', () => {
  it('quits at once when another instance holds the lock', async () => {
    electron.app.requestSingleInstanceLock.mockReturnValueOnce(false)
    await start()
    expect(electron.app.quit).toHaveBeenCalled()
    expect(electron.app.whenReady).not.toHaveBeenCalled()
  })

  it('registers the IPC, then opens the window, then checks for updates', async () => {
    await start()
    await vi.waitFor(() => expect(main.checkForUpdatesIfEnabled).toHaveBeenCalled())
    expect(toolkit.electronApp.setAppUserModelId).toHaveBeenCalledWith(APP_ID)
    expect(main.registerSettingsIpc).toHaveBeenCalledWith(main.checkForUpdatesIfEnabled)
    const order = [
      main.registerFileIpc,
      main.registerSettingsIpc,
      main.registerUpdatesIpc,
      main.registerXlsxIpc,
      main.createMainWindow,
      main.checkForUpdatesIfEnabled
    ].map((fn) => fn.mock.invocationCallOrder[0])
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('leaves the xlsx IPC out when finance is excluded', async () => {
    vi.doMock('@shared/features', () => ({ FEATURE_FINANCE: false }))
    await start()
    await vi.waitFor(() => expect(main.createMainWindow).toHaveBeenCalled())
    expect(main.registerXlsxIpc).not.toHaveBeenCalled()
  })

  it('restores and focuses the window for a second instance', async () => {
    await start()
    electron.listeners['second-instance']()
    expect(electron.win.restore).toHaveBeenCalled()
    expect(electron.win.focus).toHaveBeenCalled()
  })
})

describe('quit', () => {
  it('passes straight through when no write is pending', async () => {
    await start()
    const event = quitEvent()
    electron.listeners['will-quit'](event)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(main.pendingWrites).not.toHaveBeenCalled()
    expect(electron.app.quit).not.toHaveBeenCalled()
  })

  it('waits for pending writes, then quits exactly once', async () => {
    main.hasPendingWrites.mockReturnValue(true)
    let finishWrites: () => void = () => undefined
    main.pendingWrites.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishWrites = () => resolve()
      })
    )
    await start()
    const first = quitEvent()
    electron.listeners['will-quit'](first)
    expect(first.preventDefault).toHaveBeenCalled()
    await Promise.resolve()
    expect(electron.app.quit).not.toHaveBeenCalled()

    finishWrites()
    await vi.waitFor(() => expect(electron.app.quit).toHaveBeenCalledTimes(1))
    const second = quitEvent()
    electron.listeners['will-quit'](second)
    expect(second.preventDefault).not.toHaveBeenCalled()
    expect(main.pendingWrites).toHaveBeenCalledTimes(1)
    expect(electron.app.quit).toHaveBeenCalledTimes(1)
  })

  it('quits after the timeout when a write never settles', async () => {
    vi.useFakeTimers()
    main.hasPendingWrites.mockReturnValue(true)
    main.pendingWrites.mockReturnValueOnce(new Promise<void>(() => undefined))
    await start()
    electron.listeners['will-quit'](quitEvent())
    await vi.advanceTimersByTimeAsync(9_999)
    expect(electron.app.quit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(electron.app.quit).toHaveBeenCalledTimes(1)
    expect(log.warn).toHaveBeenCalled()
  })
})
