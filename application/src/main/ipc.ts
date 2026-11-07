import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { isAppUrl } from './window/appUrl'

export function handleWithEvent<A extends unknown[]>(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: A) => unknown
): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isAppUrl(event.senderFrame?.url ?? '')) {
      throw new Error('Blocked IPC from an untrusted frame')
    }
    return listener(event, ...(args as A))
  })
}

export function handle<A extends unknown[]>(
  channel: string,
  listener: (...args: A) => unknown
): void {
  handleWithEvent(channel, (_event, ...args: A) => listener(...args))
}
