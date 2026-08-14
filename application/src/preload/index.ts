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
      ipcRenderer.invoke('dialog:openFile', filters),
    saveFile: (options: {
      defaultPath?: string
      filters?: Array<{ name: string; extensions: string[] }>
    }): Promise<string | null> => ipcRenderer.invoke('dialog:saveFile', options)
  },
  xlsx: {
    readSheet: (filePath: string): Promise<string[][]> =>
      ipcRenderer.invoke('xlsx:readSheet', filePath)
  },
  scryfall: {
    listBulk: () => ipcRenderer.invoke('scryfall:listBulk'),
    cacheMeta: () => ipcRenderer.invoke('scryfall:cacheMeta'),
    isStale: () => ipcRenderer.invoke('scryfall:isStale'),
    buildIndex: (bulkType?: string) => ipcRenderer.invoke('scryfall:buildIndex', bulkType),
    readIndex: () => ipcRenderer.invoke('scryfall:readIndex'),
    fetchPrintings: (identifiers: unknown[]) =>
      ipcRenderer.invoke('scryfall:fetchPrintings', identifiers),
    readPrintings: () => ipcRenderer.invoke('scryfall:readPrintings'),
    cacheImage: (printingId: string, url: string, size: string) =>
      ipcRenderer.invoke('scryfall:cacheImage', printingId, url, size),
    cacheSize: () => ipcRenderer.invoke('scryfall:cacheSize'),
    clearCache: () => ipcRenderer.invoke('scryfall:clearCache'),
    /** Progress for long-running index builds / printing lookups. Returns an unsubscribe function. */
    onProgress: (
      callback: (progress: { phase: string; count: number; total?: number }) => void
    ): (() => void) => {
      const listener = (
        _event: unknown,
        progress: { phase: string; count: number; total?: number }
      ): void => callback(progress)
      ipcRenderer.on('scryfall:progress', listener)
      return () => ipcRenderer.removeListener('scryfall:progress', listener)
    }
  },
  settings: {
    get: (): Promise<{ autoUpdateEnabled: boolean; mtgEnabled: boolean }> =>
      ipcRenderer.invoke('settings:get'),
    setAutoUpdate: (
      enabled: boolean
    ): Promise<{ autoUpdateEnabled: boolean; mtgEnabled: boolean }> =>
      ipcRenderer.invoke('settings:setAutoUpdate', enabled),
    setMtgEnabled: (
      enabled: boolean
    ): Promise<{ autoUpdateEnabled: boolean; mtgEnabled: boolean }> =>
      ipcRenderer.invoke('settings:setMtgEnabled', enabled)
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
