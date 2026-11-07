import type { FileFilter } from '@shared/ipc'
import { pickFile } from '@renderer/storage'

export const RECEIPT_FILTERS: FileFilter[] = [{ name: 'Receipts', extensions: ['pdf', 'png', 'jpg', 'jpeg'] }]

// The path of the chosen receipt file; null = cancelled
export const pickReceipt = (): Promise<string | null> => pickFile(RECEIPT_FILTERS)
