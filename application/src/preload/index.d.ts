import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      fs: {
        readFile(filePath: string): Promise<string>
        writeFile(filePath: string, content: string): Promise<void>
        writeBinary(filePath: string, bytes: Uint8Array): Promise<void>
        statFile(filePath: string): Promise<{ size: number; mtimeMs: number } | null>
        readDir(dirPath: string): Promise<Array<{ name: string; isDirectory: boolean }>>
        mkdir(dirPath: string): Promise<void>
        exists(path: string): Promise<boolean>
        copyFile(src: string, dest: string): Promise<void>
        remove(targetPath: string): Promise<void>
      }
      dialog: {
        openDirectory(): Promise<string | null>
        openFile(filters: Array<{ name: string; extensions: string[] }>): Promise<string | null>
        saveFile(options: {
          defaultPath?: string
          filters?: Array<{ name: string; extensions: string[] }>
        }): Promise<string | null>
      }
      images: {
        /** Absolute path of the render-cache directory; created if missing. */
        cacheDir(): Promise<string>
        /** Downloads a remote image into the cache. Resolves with an error string
         * instead of throwing when the URL, type, size or network fails. */
        fetchRemote(url: string): Promise<{ path: string } | { error: string }>
      }
      xlsx: {
        readSheet(filePath: string): Promise<string[][]>
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
