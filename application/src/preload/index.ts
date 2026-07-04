import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  fs: {
    readFile: (filePath: string): Promise<string> =>
      ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string): Promise<void> =>
      ipcRenderer.invoke('fs:writeFile', filePath, content),
    readDir: (dirPath: string): Promise<Array<{ name: string; isDirectory: boolean }>> =>
      ipcRenderer.invoke('fs:readDir', dirPath),
    mkdir: (dirPath: string): Promise<void> =>
      ipcRenderer.invoke('fs:mkdir', dirPath),
    exists: (path: string): Promise<boolean> =>
      ipcRenderer.invoke('fs:exists', path),
    copyFile: (src: string, dest: string): Promise<void> =>
      ipcRenderer.invoke('fs:copyFile', src, dest),
    remove: (targetPath: string): Promise<void> =>
      ipcRenderer.invoke('fs:remove', targetPath)
  },
  dialog: {
    openDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke('dialog:openDirectory'),
    openFile: (
      filters: Array<{ name: string; extensions: string[] }>
    ): Promise<string | null> =>
      ipcRenderer.invoke('dialog:openFile', filters)
  },
  settings: {
    get: (): Promise<{ autoUpdateEnabled: boolean }> =>
      ipcRenderer.invoke('settings:get'),
    setAutoUpdate: (enabled: boolean): Promise<{ autoUpdateEnabled: boolean }> =>
      ipcRenderer.invoke('settings:setAutoUpdate', enabled)
  },
  updates: {
    check: (): Promise<
      | { status: 'dev' }
      | { status: 'available'; version: string }
      | { status: 'not-available'; version: string }
      | { status: 'error'; error: string }
    > => ipcRenderer.invoke('updates:check')
  },
  onExternalLinkOpenFailed: (callback: (url: string) => void): (() => void) => {
    const listener = (_event: unknown, url: string): void => callback(url)
    ipcRenderer.on('external-link-open-failed', listener)
    return () => ipcRenderer.removeListener('external-link-open-failed', listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error fallback for non-isolated context, dev only
  window.electron = electronAPI
  // @ts-expect-error fallback for non-isolated context, dev only
  window.api = api
}
