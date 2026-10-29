/// <reference types="vite/client" />
import type { MyNoteApi } from '@shared/ipc'

declare global {
  interface Window {
    api: MyNoteApi
  }
}
