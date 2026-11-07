import { BrowserWindow } from 'electron'
import { join } from 'path'
import { createLogger } from '@shared/log'
import { appBaseUrl, isAppUrl } from './appUrl'
import { registerExternalLinks } from './externalLinks'

const log = createLogger('main')

function blockForeignNavigation(event: Electron.Event<{ url: string }>): void {
  if (isAppUrl(event.url)) return
  event.preventDefault()
  log.warn('Blocked navigation to', event.url)
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'MyNote',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.on('will-navigate', blockForeignNavigation)
  win.webContents.on('will-redirect', blockForeignNavigation)

  const { session } = win.webContents
  session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  session.setPermissionCheckHandler(() => false)

  registerExternalLinks(win)
  win.loadURL(appBaseUrl()).catch((error) => log.error('Cannot load the app page:', error))
  return win
}
