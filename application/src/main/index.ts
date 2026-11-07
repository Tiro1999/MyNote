import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { APP_ID } from '@shared/app'
import { FEATURE_FINANCE } from '@shared/features'
import { createLogger } from '@shared/log'
import { hasPendingWrites, pendingWrites } from './files/atomicWrite'
import { registerFileIpc } from './files/files'
import { registerXlsxIpc } from './finance/xlsx'
import { registerSettingsIpc } from './settings/settings'
import { checkForUpdatesIfEnabled, registerUpdatesIpc } from './updates/updates'
import { createMainWindow } from './window/mainWindow'

// A stalled network folder must not keep the app alive forever
const QUIT_WRITE_TIMEOUT_MS = 10_000
const log = createLogger('main')
let waitedForWrites = false

function focusMainWindow(): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
}

function waitForPendingWrites(): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      log.warn(`Writes still pending after ${QUIT_WRITE_TIMEOUT_MS} ms, quitting anyway`)
      resolve()
    }, QUIT_WRITE_TIMEOUT_MS)
    pendingWrites().then(() => {
      clearTimeout(timer)
      resolve()
    })
  })
}

// Waits at most once, so the will-quit that app.quit() emits next passes through
function quitAfterPendingWrites(event: Electron.Event): void {
  if (waitedForWrites || !hasPendingWrites()) return
  waitedForWrites = true
  event.preventDefault()
  waitForPendingWrites().then(() => app.quit())
}

if (!app.requestSingleInstanceLock()) {
  log.info('MyNote is already running, focusing that window instead')
  app.quit()
} else {
  app.on('second-instance', focusMainWindow)

  app.whenReady().then(() => {
    electronApp.setAppUserModelId(APP_ID)
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

    registerFileIpc()
    registerSettingsIpc(checkForUpdatesIfEnabled)
    registerUpdatesIpc()
    if (FEATURE_FINANCE) registerXlsxIpc()

    createMainWindow()
    checkForUpdatesIfEnabled()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', quitAfterPendingWrites)
}
