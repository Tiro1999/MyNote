import { clipboard, shell, type BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import { isAllowedExternalUrl } from '@shared/links'
import { createLogger } from '@shared/log'

const log = createLogger('links')

// Without a browser (e.g. a headless devcontainer) the user gets the URL on the clipboard
function openOrCopy(win: BrowserWindow, url: string): void {
  shell.openExternal(url).catch((error) => {
    log.warn('Cannot open the link, copied it to the clipboard instead:', url, error)
    clipboard.writeText(url)
    if (!win.isDestroyed()) win.webContents.send(IPC.links.openFailed, url)
  })
}

export function registerExternalLinks(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) openOrCopy(win, url)
    else log.warn('Blocked a link with an unsupported protocol:', url)
    return { action: 'deny' }
  })
}
