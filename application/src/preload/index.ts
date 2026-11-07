import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type MyNoteApi } from '@shared/ipc'

const api: MyNoteApi = {
  files: {
    readText: (path) => ipcRenderer.invoke(IPC.files.readText, path),
    writeText: (path, text) => ipcRenderer.invoke(IPC.files.writeText, path, text),
    list: (dir) => ipcRenderer.invoke(IPC.files.list, dir),
    remove: (path) => ipcRenderer.invoke(IPC.files.remove, path),
    importText: (filters) => ipcRenderer.invoke(IPC.files.importText, filters),
    exportText: (defaultName, filters, text) =>
      ipcRenderer.invoke(IPC.files.exportText, defaultName, filters, text)
  },
  dialogs: {
    openNotebookFolder: () => ipcRenderer.invoke(IPC.dialogs.openNotebookFolder),
    pickFile: (filters) => ipcRenderer.invoke(IPC.dialogs.pickFile, filters)
  },
  xlsx: {
    importSheet: () => ipcRenderer.invoke(IPC.xlsx.importSheet)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settings.get),
    setAutoUpdate: (enabled) => ipcRenderer.invoke(IPC.settings.setAutoUpdate, enabled)
  },
  updates: {
    check: () => ipcRenderer.invoke(IPC.updates.check)
  },
  links: {
    onOpenFailed: (callback) => {
      const listener = (_event: IpcRendererEvent, url: string): void => callback(url)
      ipcRenderer.on(IPC.links.openFailed, listener)
      return () => {
        ipcRenderer.removeListener(IPC.links.openFailed, listener)
      }
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
