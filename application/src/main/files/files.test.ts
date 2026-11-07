import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '@shared/ipc'
import { invokeIpc } from '../ipc.testing'

const electron = vi.hoisted(() => ({
  app: { isPackaged: false },
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
  BrowserWindow: { fromWebContents: vi.fn() }
}))
vi.mock('electron', () => electron)
vi.mock('@shared/log', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

const parent = { id: 1 }
const csv = [{ name: 'MyNote CSV', extensions: ['csv'] }]
let base: string
let root: string

const invoke = (channel: string, ...args: unknown[]): Promise<unknown> =>
  invokeIpc(electron.ipcMain.handle, channel, ...args)

function pick(path: string | null): void {
  electron.dialog.showOpenDialog.mockResolvedValueOnce(
    path === null ? { canceled: true, filePaths: [] } : { canceled: false, filePaths: [path] }
  )
}

async function openFolder(): Promise<void> {
  pick(root)
  expect(await invoke(IPC.dialogs.openNotebookFolder)).toBe(root)
}

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  electron.BrowserWindow.fromWebContents.mockReturnValue(parent)
  base = await mkdtemp(join(tmpdir(), 'mynote-files-'))
  root = join(base, 'My Notes')
  await mkdir(root)
  await writeFile(join(base, 'outside.txt'), 'keep')
  const { registerFileIpc } = await import('./files')
  registerFileIpc()
})

afterEach(async () => {
  await rm(base, { recursive: true, force: true })
})

describe('before a notebook folder is open', () => {
  it('refuses every files call', async () => {
    const calls: [string, ...unknown[]][] = [
      [IPC.files.readText, 'notebooks.json'],
      [IPC.files.writeText, 'notebooks.json', '[]'],
      [IPC.files.list, 'finance'],
      [IPC.files.remove, 'nb1'],
      [IPC.files.importText, csv],
      [IPC.files.exportText, 'ledger-1.csv', csv, 'x']
    ]
    for (const [channel, ...args] of calls)
      await expect(invoke(channel, ...args)).rejects.toThrow('No notebook folder is open')
    expect(electron.dialog.showOpenDialog).not.toHaveBeenCalled()
    expect(electron.dialog.showSaveDialog).not.toHaveBeenCalled()
  })
})

describe('inside the notebook folder', () => {
  beforeEach(openFolder)

  it('shows the folder dialog on the sender window', () => {
    expect(electron.dialog.showOpenDialog).toHaveBeenCalledWith(parent, {
      properties: ['openDirectory', 'createDirectory']
    })
  })

  it('writes, reads and lists folder-relative paths', async () => {
    await invoke(IPC.files.writeText, 'nb1/s1/page.json', '{"pageId":"s1"}')
    expect(await readFile(join(root, 'nb1', 's1', 'page.json'), 'utf-8')).toBe('{"pageId":"s1"}')
    expect(await invoke(IPC.files.readText, 'nb1/s1/page.json')).toBe('{"pageId":"s1"}')
    expect(await invoke(IPC.files.list, 'nb1')).toEqual([{ name: 's1', isDirectory: true }])
  })

  it('maps a missing file to null and a missing folder to []', async () => {
    expect(await invoke(IPC.files.readText, 'notebooks.json')).toBeNull()
    expect(await invoke(IPC.files.list, 'finance/ledgers')).toEqual([])
  })

  it('propagates other read errors', async () => {
    await mkdir(join(root, 'nb1'))
    await expect(invoke(IPC.files.readText, 'nb1')).rejects.toThrow('EISDIR')
  })

  it('removes recursively', async () => {
    await invoke(IPC.files.writeText, 'nb1/s1/page.json', '{}')
    await invoke(IPC.files.remove, 'nb1')
    expect(await readdir(root)).toEqual([])
  })

  it('rejects paths outside the folder and changes nothing', async () => {
    for (const [channel, ...args] of [
      [IPC.files.readText, '../outside.txt'],
      [IPC.files.writeText, '../outside.txt', 'evil'],
      [IPC.files.list, '..'],
      [IPC.files.remove, '..'],
      [IPC.files.remove, '']
    ])
      await expect(invoke(channel, ...args)).rejects.toThrow('Path outside the notebook folder')
    expect(await readFile(join(base, 'outside.txt'), 'utf-8')).toBe('keep')
    expect((await stat(root)).isDirectory()).toBe(true)
  })

  it('keeps the folder when the folder dialog is cancelled', async () => {
    await writeFile(join(root, 'notebooks.json'), '[]')
    pick(null)
    expect(await invoke(IPC.dialogs.openNotebookFolder)).toBeNull()
    expect(await invoke(IPC.files.readText, 'notebooks.json')).toBe('[]')
  })

  it('imports a picked text file of at most 10 MiB', async () => {
    await writeFile(join(base, 'small.csv'), 'a,b')
    await writeFile(join(base, 'large.csv'), Buffer.alloc(10 * 1024 * 1024 + 1))
    pick(join(base, 'small.csv'))
    expect(await invoke(IPC.files.importText, csv)).toBe('a,b')
    expect(electron.dialog.showOpenDialog).toHaveBeenLastCalledWith(parent, {
      properties: ['openFile'],
      filters: csv
    })
    pick(join(base, 'large.csv'))
    await expect(invoke(IPC.files.importText, csv)).rejects.toThrow('too large')
    pick(null)
    expect(await invoke(IPC.files.importText, csv)).toBeNull()
  })

  it('exports to the picked file and offers only the base name', async () => {
    const target = join(base, 'export.csv')
    electron.dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: target })
    expect(await invoke(IPC.files.exportText, '../../ledger-1.csv', csv, 'a,b')).toBe(true)
    expect(electron.dialog.showSaveDialog).toHaveBeenCalledWith(parent, {
      defaultPath: 'ledger-1.csv',
      filters: csv
    })
    expect(await readFile(target, 'utf-8')).toBe('a,b')
    electron.dialog.showSaveDialog.mockResolvedValueOnce({ canceled: true, filePath: '' })
    expect(await invoke(IPC.files.exportText, 'ledger-1.csv', csv, 'c')).toBe(false)
    expect(await readFile(target, 'utf-8')).toBe('a,b')
  })

  it.each([
    ['a text that is not a string', IPC.files.writeText, ['nb1/page.json', 42], 'text'],
    ['a path that is not a string', IPC.files.readText, [['nb1', 'page.json']], 'path'],
    ['a folder that is not a string', IPC.files.list, [null], 'dir'],
    ['a removal path that is not a string', IPC.files.remove, [{ path: 'nb1' }], 'path'],
    ['a default name that is not a string', IPC.files.exportText, [7, csv, 'a,b'], 'defaultName'],
    ['filters that are not an array', IPC.files.importText, ['csv'], 'filters'],
    [
      'a filter with wrong types',
      IPC.dialogs.pickFile,
      [[{ name: 'PDF', extensions: 'pdf' }]],
      'filters'
    ],
    [
      'a filter without a name',
      IPC.files.exportText,
      ['ledger-1.csv', [{ extensions: ['csv'] }], 'x'],
      'filters'
    ]
  ])('rejects %s without touching files or dialogs', async (_, channel, args, name) => {
    await expect(invoke(channel, ...args)).rejects.toThrow(`Invalid argument: ${name}`)
    expect(await readdir(root)).toEqual([])
    expect(electron.dialog.showOpenDialog).toHaveBeenCalledOnce()
    expect(electron.dialog.showSaveDialog).not.toHaveBeenCalled()
  })

  it('returns the picked file path, or null when cancelled', async () => {
    pick('/receipts/r1.pdf')
    expect(await invoke(IPC.dialogs.pickFile, csv)).toBe('/receipts/r1.pdf')
    pick(null)
    expect(await invoke(IPC.dialogs.pickFile, csv)).toBeNull()
  })
})
