import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      fs: {
        readFile(filePath: string): Promise<string>
        writeFile(filePath: string, content: string): Promise<void>
        readDir(dirPath: string): Promise<Array<{ name: string; isDirectory: boolean }>>
        mkdir(dirPath: string): Promise<void>
        exists(path: string): Promise<boolean>
        copyFile(src: string, dest: string): Promise<void>
        remove(targetPath: string): Promise<void>
      }
      dialog: {
        openDirectory(): Promise<string | null>
        openFile(filters: Array<{ name: string; extensions: string[] }>): Promise<string | null>
      }
      settings: {
        get(): Promise<{ autoUpdateEnabled: boolean }>
        setAutoUpdate(enabled: boolean): Promise<{ autoUpdateEnabled: boolean }>
      }
      updates: {
        check(): Promise<
          | { status: 'dev' }
          | { status: 'available'; version: string }
          | { status: 'not-available'; version: string }
          | { status: 'error'; error: string }
        >
      }
      /** Fired when a hyperlink click couldn't be opened in a browser (e.g. no browser
       * available in a headless dev environment); the URL was copied to the clipboard
       * instead. Returns an unsubscribe function. */
      onExternalLinkOpenFailed(callback: (url: string) => void): () => void
    }
  }
}
