import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handle, handleWithEvent } from './ipc'
import { registeredListener } from './ipc.testing'

const electron = vi.hoisted(() => ({
  app: { isPackaged: false },
  ipcMain: { handle: vi.fn() }
}))
vi.mock('electron', () => electron)

const fromApp = { senderFrame: { url: 'http://localhost:5173/#/page' } }
const listenerFor = (channel: string): ReturnType<typeof registeredListener> =>
  registeredListener(electron.ipcMain.handle, channel)

beforeEach(() => {
  vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173/')
  electron.ipcMain.handle.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('handle', () => {
  it('calls the listener with the arguments but without the event', () => {
    const listener = vi.fn((a: string, b: number) => `${a}${b}`)
    handle('test:echo', listener)
    expect(listenerFor('test:echo')(fromApp, 'x', 1)).toBe('x1')
    expect(listener).toHaveBeenCalledWith('x', 1)
  })

  it('blocks a foreign or missing sender frame', () => {
    const listener = vi.fn()
    handle('test:echo', listener)
    const run = listenerFor('test:echo')
    expect(() => run({ senderFrame: { url: 'https://evil.example/' } })).toThrow(
      'Blocked IPC from an untrusted frame'
    )
    expect(() => run({ senderFrame: null })).toThrow('Blocked IPC from an untrusted frame')
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('handleWithEvent', () => {
  it('passes the event first', () => {
    handleWithEvent('test:event', (event: unknown, a: string) => [event, a])
    expect(listenerFor('test:event')(fromApp, 'x')).toEqual([fromApp, 'x'])
  })

  it('blocks a foreign sender frame', () => {
    handleWithEvent('test:event', () => 'ran')
    expect(() => listenerFor('test:event')({ senderFrame: { url: 'file:///etc/passwd' } })).toThrow(
      'Blocked IPC from an untrusted frame'
    )
  })
})
