import { ElectronAPI } from '@electron-toolkit/preload'
import type { BulkInfo, CacheMeta, CardIdentifier } from '../main/scryfall'
import type { OracleCard, PrintingCard } from '../shared/scryfall-model'

export type { BulkInfo, CacheMeta, CardIdentifier, OracleCard, PrintingCard }

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
        saveFile(options: {
          defaultPath?: string
          filters?: Array<{ name: string; extensions: string[] }>
        }): Promise<string | null>
      }
      xlsx: {
        readSheet(filePath: string): Promise<string[][]>
      }
      /** Scryfall access. Runs in the main process because the renderer CSP blocks
       *  outbound requests and rate limiting needs a single owner. */
      scryfall: {
        listBulk(): Promise<BulkInfo[]>
        cacheMeta(): Promise<CacheMeta | null>
        /** True when Scryfall has published a newer bulk file than the cached index. */
        isStale(): Promise<boolean>
        /** Downloads and reduces a bulk file into the local oracle index. Long-running. */
        buildIndex(bulkType?: string): Promise<CacheMeta>
        readIndex(): Promise<OracleCard[]>
        /** Resolves printings in batches of 75 and merges them into the cache. */
        fetchPrintings(identifiers: CardIdentifier[]): Promise<{
          found: PrintingCard[]
          notFound: CardIdentifier[]
        }>
        readPrintings(): Promise<PrintingCard[]>
        /** Downloads a card image to disk and returns its absolute path (CSP blocks https: images). */
        cacheImage(printingId: string, url: string, size: string): Promise<string>
        cacheSize(): Promise<{ bytes: number; images: number }>
        clearCache(): Promise<void>
        onProgress(
          callback: (progress: { phase: string; count: number; total?: number }) => void
        ): () => void
      }
      settings: {
        get(): Promise<{ autoUpdateEnabled: boolean; mtgEnabled: boolean }>
        setAutoUpdate(
          enabled: boolean
        ): Promise<{ autoUpdateEnabled: boolean; mtgEnabled: boolean }>
        /** Opt-in for the MTG module; gates its slash commands. */
        setMtgEnabled(
          enabled: boolean
        ): Promise<{ autoUpdateEnabled: boolean; mtgEnabled: boolean }>
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
