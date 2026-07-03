import { app, shell, BrowserWindow, ipcMain, dialog, clipboard } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import * as fs from 'fs'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    },
    title: 'MyNote'
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Open external links (e.g. clicked hyperlinks in a text box) in the
  // system's default browser instead of a new Electron window. On Linux this
  // shells out to `xdg-open`; in a headless devcontainer/Codespace without a
  // desktop session/browser there's nothing for it to launch, so as a
  // fallback we copy the URL to the clipboard and tell the renderer, instead
  // of leaving the user with just a silent console error.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url).catch((error) => {
      console.error('Failed to open external link, copied to clipboard instead:', details.url, error)
      clipboard.writeText(details.url)
      mainWindow.webContents.send('external-link-open-failed', details.url)
    })
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('io.github.tiro1999.mynote')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── Filesystem IPC ───────────────────────────────────────────────────────────

ipcMain.handle('fs:readFile', async (_, filePath: string) =>
  fs.promises.readFile(filePath, 'utf-8')
)

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
  await fs.promises.mkdir(join(filePath, '..'), { recursive: true })
  await fs.promises.writeFile(filePath, content, 'utf-8')
})

ipcMain.handle('fs:readDir', async (_, dirPath: string) => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
  } catch {
    return []
  }
})

ipcMain.handle('fs:mkdir', async (_, dirPath: string) => {
  await fs.promises.mkdir(dirPath, { recursive: true })
})

ipcMain.handle('fs:exists', async (_, targetPath: string) => {
  try {
    await fs.promises.access(targetPath)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('fs:copyFile', async (_, src: string, dest: string) => {
  await fs.promises.mkdir(join(dest, '..'), { recursive: true })
  await fs.promises.copyFile(src, dest)
})

ipcMain.handle('fs:remove', async (_, targetPath: string) => {
  await fs.promises.rm(targetPath, { recursive: true, force: true })
})

// ─── Dialog IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:openFile', async (_, filters: Electron.FileFilter[]) => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters })
  return result.canceled ? null : result.filePaths[0]
})
