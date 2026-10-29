export const IPC = {
  files: {
    readText: 'files:readText',
    writeText: 'files:writeText',
    list: 'files:list',
    remove: 'files:remove',
    importText: 'files:importText',
    exportText: 'files:exportText'
  },
  dialogs: { openNotebookFolder: 'dialogs:openNotebookFolder', pickFile: 'dialogs:pickFile' },
  xlsx: { importSheet: 'xlsx:importSheet' },
  settings: { get: 'settings:get', setAutoUpdate: 'settings:setAutoUpdate' },
  updates: { check: 'updates:check' },
  links: { openFailed: 'links:openFailed' }
} as const

export interface FileFilter {
  name: string
  extensions: string[]
}

export interface DirEntry {
  name: string
  isDirectory: boolean
}

export interface AppSettings {
  autoUpdateEnabled: boolean
}

export type UpdateCheckStatus =
  | { status: 'dev' }
  | { status: 'unsupported' }
  | { status: 'available' | 'not-available'; version: string }
  | { status: 'error'; error: string }

// Paths are folder-relative and '/'-separated, see documentation/software/main/ipc.md
export interface MyNoteApi {
  files: {
    readText(path: string): Promise<string | null> // null = missing
    writeText(path: string, text: string): Promise<void> // atomic; creates parent folders
    list(dir: string): Promise<DirEntry[]> // [] = missing
    remove(path: string): Promise<void>
    importText(filters: FileFilter[]): Promise<string | null> // null = cancelled
    exportText(
      defaultName: string,
      filters: FileFilter[],
      text: string
    ): Promise<boolean> // false = cancelled
  }
  dialogs: {
    openNotebookFolder(): Promise<string | null>
    pickFile(filters: FileFilter[]): Promise<string | null>
  }
  xlsx: { importSheet(): Promise<string[][] | null> }
  settings: { get(): Promise<AppSettings>; setAutoUpdate(enabled: boolean): Promise<AppSettings> }
  updates: { check(): Promise<UpdateCheckStatus> }
  links: { onOpenFailed(callback: (url: string) => void): () => void }
}
