import { app, shell, BrowserWindow, ipcMain, dialog, clipboard, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import * as fs from 'fs'
import * as zlib from 'zlib'
import { registerAssetProtocol } from './assetProtocol'
import { fetchRemoteImage, imageCacheDir } from './imageCache'

// Must run before app.whenReady() resolves. `standard` gives the scheme normal
// host/path URL parsing, `secure` makes it a secure origin so it is allowed on the
// page, `stream` lets large images stream. Deliberately NOT supportFetchAPI/corsEnabled:
// only subresource loads (<img src>) may use it, renderer JS must not fetch() through it.
protocol.registerSchemesAsPrivileged([
  { scheme: 'asset', privileges: { standard: true, secure: true, stream: true } }
])

// ─── App settings ───────────────────────────────────────────────────────────
// Persisted as JSON in the OS-specific userData directory so the main process
// can read the user's preferences at startup (before any window/renderer
// exists). Auto-updates default to ON; users can opt out in Settings.

interface AppSettings {
  autoUpdateEnabled: boolean
}

const DEFAULT_SETTINGS: AppSettings = { autoUpdateEnabled: true }

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function readSettings(): AppSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf-8')) }
  } catch {
    // No file yet or unreadable/corrupt — fall back to defaults.
    return { ...DEFAULT_SETTINGS }
  }
}

function writeSettings(settings: AppSettings): void {
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}

// Check GitHub Releases for a newer version — but only in the packaged app and
// only when the user hasn't opted out. electron-updater ignores draft and
// pre-release releases, and a failed check must never block the app.
function maybeCheckForUpdates(): void {
  if (!app.isPackaged) return
  if (!readSettings().autoUpdateEnabled) {
    console.log('Automatic updates disabled in settings — skipping update check.')
    return
  }
  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.error('Update check failed:', error)
  })
}

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
  const allowedExternalProtocols = new Set(['http:', 'https:', 'mailto:'])
  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const parsedUrl = new URL(details.url)
      if (!allowedExternalProtocols.has(parsedUrl.protocol)) {
        console.warn('Blocked external link with unsupported protocol:', details.url)
        return { action: 'deny' }
      }
    } catch (error) {
      console.warn('Blocked invalid external link URL:', details.url, error)
      return { action: 'deny' }
    }

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

  registerAssetProtocol()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  maybeCheckForUpdates()

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

// fs:writeFile is utf-8 only — images need raw bytes. Uint8Array survives the
// structured clone across IPC and is wrapped back into a Buffer here.
ipcMain.handle('fs:writeBinary', async (_, filePath: string, bytes: Uint8Array) => {
  await fs.promises.mkdir(join(filePath, '..'), { recursive: true })
  await fs.promises.writeFile(filePath, Buffer.from(bytes))
})

// Size + mtime without reading the file: drives the render-cache threshold and
// the cache key.
ipcMain.handle('fs:statFile', async (_, filePath: string) => {
  try {
    const stats = await fs.promises.stat(filePath)
    if (!stats.isFile()) return null
    return { size: stats.size, mtimeMs: stats.mtimeMs }
  } catch {
    return null
  }
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

ipcMain.handle(
  'dialog:saveFile',
  async (_, options: { defaultPath?: string; filters?: Electron.FileFilter[] }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: options.defaultPath,
      filters: options.filters
    })
    return result.canceled ? null : (result.filePath ?? null)
  }
)

// ─── Image IPC ────────────────────────────────────────────────────────────────

ipcMain.handle('images:cacheDir', (): string => imageCacheDir())

ipcMain.handle('images:fetchRemote', async (_, url: string) => fetchRemoteImage(url))

// ─── .xlsx reading (dependency-free) ──────────────────────────────────────────
// An .xlsx is a ZIP of XML parts. We locate and inflate just the two parts we
// need (shared strings + first worksheet) with Node's built-in zlib, then pull
// the cell grid out with light XML parsing. Tailored to standard OOXML exports.

function readZipEntry(buf: Buffer, name: string): string | null {
  const EOCD_SIG = 0x06054b50
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null
  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const method = buf.readUInt16LE(off + 10)
    const compSize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const fname = buf.toString('utf8', off + 46, off + 46 + nameLen)
    if (fname === name) {
      const lNameLen = buf.readUInt16LE(localOff + 26)
      const lExtraLen = buf.readUInt16LE(localOff + 28)
      const start = localOff + 30 + lNameLen + lExtraLen
      const data = buf.subarray(start, start + compSize)
      if (method === 0) return data.toString('utf8')
      if (method === 8) return zlib.inflateRawSync(data).toString('utf8')
      return null
    }
    off += 46 + nameLen + extraLen + commentLen
  }
  return null
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = []
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g
  let m: RegExpExecArray | null
  while ((m = siRe.exec(xml)) !== null) {
    let text = ''
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g
    let tm: RegExpExecArray | null
    while ((tm = tRe.exec(m[1])) !== null) text += tm[1]
    out.push(decodeXmlEntities(text))
  }
  return out
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A'
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = []
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g
  let rm: RegExpExecArray | null
  while ((rm = rowRe.exec(xml)) !== null) {
    const cells: string[] = []
    const cRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
    let cm: RegExpExecArray | null
    while ((cm = cRe.exec(rm[1])) !== null) {
      const attrs = cm[1] ?? ''
      const body = cm[2] ?? ''
      const col = columnIndex(/r="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? '')
      const idx = col > 0 ? col - 1 : cells.length
      let value = ''
      if (/t="inlineStr"/.test(attrs)) {
        value = decodeXmlEntities(/<t\b[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] ?? '')
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
        if (v !== undefined) {
          value = /t="s"/.test(attrs) ? (shared[Number(v)] ?? '') : decodeXmlEntities(v)
        }
      }
      cells[idx] = value
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = ''
    rows.push(cells)
  }
  return rows
}

ipcMain.handle('xlsx:readSheet', async (_, filePath: string): Promise<string[][]> => {
  const buf = await fs.promises.readFile(filePath)
  const shared = parseSharedStrings(readZipEntry(buf, 'xl/sharedStrings.xml') ?? '')
  return parseSheet(readZipEntry(buf, 'xl/worksheets/sheet1.xml') ?? '', shared)
})

// ─── Settings IPC ───────────────────────────────────────────────────────────

ipcMain.handle('settings:get', (): AppSettings => readSettings())

ipcMain.handle('settings:setAutoUpdate', (_, enabled: boolean): AppSettings => {
  const settings = { ...readSettings(), autoUpdateEnabled: enabled }
  writeSettings(settings)
  // Re-enabling should feel immediate — kick off a check right away.
  if (enabled) maybeCheckForUpdates()
  return settings
})

// ─── Manual update check ──────────────────────────────────────────────────────
// Works regardless of the auto-update setting — this is how a user who opted out
// of automatic updates still checks on demand. Resolves with a discrete status so
// the UI can give clear feedback. If an update is found, autoDownload (on by
// default) fetches it and it installs on the next restart.

type UpdateCheckStatus =
  | { status: 'dev' }
  | { status: 'available'; version: string }
  | { status: 'not-available'; version: string }
  | { status: 'error'; error: string }

ipcMain.handle('updates:check', (): Promise<UpdateCheckStatus> => {
  if (!app.isPackaged) return Promise.resolve({ status: 'dev' })

  return new Promise<UpdateCheckStatus>((resolve) => {
    const cleanup = (): void => {
      autoUpdater.removeListener('update-available', onAvailable)
      autoUpdater.removeListener('update-not-available', onNotAvailable)
      autoUpdater.removeListener('error', onError)
    }
    const onAvailable = (info: { version: string }): void => {
      cleanup()
      resolve({ status: 'available', version: info.version })
    }
    const onNotAvailable = (): void => {
      cleanup()
      resolve({ status: 'not-available', version: app.getVersion() })
    }
    const onError = (error: Error): void => {
      cleanup()
      resolve({ status: 'error', error: error?.message ?? String(error) })
    }

    autoUpdater.once('update-available', onAvailable)
    autoUpdater.once('update-not-available', onNotAvailable)
    autoUpdater.once('error', onError)
    autoUpdater.checkForUpdates().catch((error) => onError(error as Error))
  })
})
