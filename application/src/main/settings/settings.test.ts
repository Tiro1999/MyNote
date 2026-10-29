import { access, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '@shared/ipc'
import { invokeIpc } from '../ipc.testing'
import { parseSettings, readSettings, registerSettingsIpc, writeSettings } from './settings'

const electron = vi.hoisted(() => ({
  app: { isPackaged: false, getPath: vi.fn() },
  ipcMain: { handle: vi.fn() }
}))
vi.mock('electron', () => electron)

const log = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }))
vi.mock('@shared/log', () => ({ createLogger: () => log }))

let userData: string

const invoke = (channel: string, ...args: unknown[]): Promise<unknown> =>
  invokeIpc(electron.ipcMain.handle, channel, ...args)

beforeEach(async () => {
  vi.clearAllMocks()
  userData = await mkdtemp(join(tmpdir(), 'mynote-settings-'))
  electron.app.getPath.mockImplementation((name: string) => (name === 'userData' ? userData : ''))
})

afterEach(async () => {
  await rm(userData, { recursive: true, force: true })
})

describe('parseSettings', () => {
  it('takes autoUpdateEnabled only when it is a boolean', () => {
    expect(parseSettings({ autoUpdateEnabled: false })).toEqual({ autoUpdateEnabled: false })
    for (const raw of [{ autoUpdateEnabled: 'no' }, null, [], 'x'])
      expect(parseSettings(raw)).toEqual({ autoUpdateEnabled: true })
  })
})

describe('readSettings', () => {
  it('gives the defaults without a warning when the file is missing', () => {
    expect(readSettings()).toEqual({ autoUpdateEnabled: true })
    expect(log.warn).not.toHaveBeenCalled()
  })

  it('gives the defaults and warns when the file is corrupt', async () => {
    await writeFile(join(userData, 'settings.json'), '{"autoUpdateEnabled": fal')
    expect(readSettings()).toEqual({ autoUpdateEnabled: true })
    expect(log.warn).toHaveBeenCalledOnce()
  })

  it('reads back what writeSettings wrote', async () => {
    await writeSettings({ autoUpdateEnabled: false })
    expect(readSettings()).toEqual({ autoUpdateEnabled: false })
  })
})

describe('settings IPC', () => {
  it('stores the choice and calls back only when updates get enabled', async () => {
    const onAutoUpdateEnabled = vi.fn()
    registerSettingsIpc(onAutoUpdateEnabled)
    expect(await invoke(IPC.settings.setAutoUpdate, false)).toEqual({ autoUpdateEnabled: false })
    expect(await invoke(IPC.settings.get)).toEqual({ autoUpdateEnabled: false })
    expect(onAutoUpdateEnabled).not.toHaveBeenCalled()
    expect(await invoke(IPC.settings.setAutoUpdate, true)).toEqual({ autoUpdateEnabled: true })
    expect(onAutoUpdateEnabled).toHaveBeenCalledOnce()
  })

  it('rejects a value that is not a boolean and writes nothing', async () => {
    registerSettingsIpc(vi.fn())
    await expect(invoke(IPC.settings.setAutoUpdate, 'no')).rejects.toThrow()
    await expect(access(join(userData, 'settings.json'))).rejects.toThrow('ENOENT')
  })
})
