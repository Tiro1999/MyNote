import type { Mock } from 'vitest'
import { appBaseUrl } from './window/appUrl'

export function registeredListener(
  handle: Mock,
  channel: string
): (event: unknown, ...args: unknown[]) => unknown {
  const call = handle.mock.calls.find(([name]) => name === channel)
  if (!call) throw new Error(`No IPC handler for ${channel}`)
  return call[1]
}

// Invokes like the app's own frame would; a synchronous throw becomes a rejection
export function invokeIpc(handle: Mock, channel: string, ...args: unknown[]): Promise<unknown> {
  const event = { senderFrame: { url: appBaseUrl() }, sender: {} }
  return Promise.resolve().then(() => registeredListener(handle, channel)(event, ...args))
}
