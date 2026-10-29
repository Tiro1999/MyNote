import { BrowserWindow, dialog, type IpcMainInvokeEvent, type OpenDialogOptions } from 'electron'
import { readFile, readdir, rm, stat } from 'fs/promises'
import { basename } from 'path'
import { IPC, type DirEntry, type FileFilter } from '@shared/ipc'
import { createLogger } from '@shared/log'
import { handle, handleWithEvent } from '../ipc'
import { writeFileAtomic } from './atomicWrite'
import { resolveInRoot } from './scope'

const MAX_IMPORT_BYTES = 10 * 1024 * 1024
const log = createLogger('files')

// Set only by the folder dialog, see documentation/software/main/files.md
let dataRoot: string | null = null

function requireDataRoot(): string {
  if (dataRoot === null) throw new Error('No notebook folder is open')
  return dataRoot
}

function inRoot(relPath: string): string {
  return resolveInRoot(requireDataRoot(), relPath)
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT'
}

function asString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`Invalid argument: ${name}`)
  return value
}

function isFileFilter(value: unknown): value is FileFilter {
  const filter = value as Partial<FileFilter> | null
  return (
    typeof filter?.name === 'string' &&
    Array.isArray(filter.extensions) &&
    filter.extensions.every((extension) => typeof extension === 'string')
  )
}

function asFilters(value: unknown): FileFilter[] {
  if (!Array.isArray(value) || !value.every(isFileFilter)) {
    throw new Error('Invalid argument: filters')
  }
  return value
}

async function readText(relPath: string): Promise<string | null> {
  try {
    return await readFile(inRoot(relPath), 'utf-8')
  } catch (error) {
    if (isMissing(error)) return null
    throw error
  }
}

async function list(relDir: string): Promise<DirEntry[]> {
  try {
    const entries = await readdir(inRoot(relDir), { withFileTypes: true })
    return entries.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }))
  } catch (error) {
    if (isMissing(error)) return []
    throw error
  }
}

async function remove(relPath: string): Promise<void> {
  await rm(inRoot(relPath), { recursive: true, force: true })
  log.debug('Removed', relPath)
}

function senderWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win === null) throw new Error('No window for this request')
  return win
}

async function showOpenDialog(
  event: IpcMainInvokeEvent,
  options: OpenDialogOptions
): Promise<string | null> {
  const result = await dialog.showOpenDialog(senderWindow(event), options)
  return result.canceled ? null : (result.filePaths[0] ?? null)
}

export function pickFile(event: IpcMainInvokeEvent, filters: FileFilter[]): Promise<string | null> {
  return showOpenDialog(event, { properties: ['openFile'], filters })
}

// Open dialog plus size-checked read; null = cancelled
export async function importFile(
  event: IpcMainInvokeEvent,
  filters: FileFilter[],
  maxBytes: number
): Promise<Buffer | null> {
  const file = await pickFile(event, filters)
  if (file === null) return null
  if ((await stat(file)).size > maxBytes) throw new Error('The file is too large to import')
  return readFile(file)
}

async function importText(
  event: IpcMainInvokeEvent,
  filters: FileFilter[]
): Promise<string | null> {
  requireDataRoot()
  const data = await importFile(event, filters, MAX_IMPORT_BYTES)
  return data === null ? null : data.toString('utf-8')
}

async function exportText(
  event: IpcMainInvokeEvent,
  defaultName: string,
  filters: FileFilter[],
  text: string
): Promise<boolean> {
  requireDataRoot()
  const options = { defaultPath: basename(defaultName), filters }
  const result = await dialog.showSaveDialog(senderWindow(event), options)
  if (result.canceled || !result.filePath) return false
  await writeFileAtomic(result.filePath, text)
  return true
}

async function openNotebookFolder(event: IpcMainInvokeEvent): Promise<string | null> {
  const folder = await showOpenDialog(event, { properties: ['openDirectory', 'createDirectory'] })
  if (folder !== null) {
    dataRoot = folder
    log.info('Notebook folder opened:', folder)
  }
  return folder
}

// IPC arguments come from the renderer and are checked before use
export function registerFileIpc(): void {
  handle(IPC.files.readText, (path: unknown) => readText(asString(path, 'path')))
  handle(IPC.files.writeText, (path: unknown, text: unknown) =>
    writeFileAtomic(inRoot(asString(path, 'path')), asString(text, 'text'))
  )
  handle(IPC.files.list, (dir: unknown) => list(asString(dir, 'dir')))
  handle(IPC.files.remove, (path: unknown) => remove(asString(path, 'path')))
  handleWithEvent(IPC.files.importText, (event, filters: unknown) =>
    importText(event, asFilters(filters))
  )
  handleWithEvent(
    IPC.files.exportText,
    (event, defaultName: unknown, filters: unknown, text: unknown) =>
      exportText(
        event,
        asString(defaultName, 'defaultName'),
        asFilters(filters),
        asString(text, 'text')
      )
  )
  handleWithEvent(IPC.dialogs.openNotebookFolder, openNotebookFolder)
  handleWithEvent(IPC.dialogs.pickFile, (event, filters: unknown) =>
    pickFile(event, asFilters(filters))
  )
}
