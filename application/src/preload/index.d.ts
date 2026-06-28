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
      }
      dialog: {
        openDirectory(): Promise<string | null>
        openFile(filters: Array<{ name: string; extensions: string[] }>): Promise<string | null>
      }
    }
  }
}
