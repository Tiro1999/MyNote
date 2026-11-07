import { randomBytes } from 'crypto'
import { mkdir, rename, unlink, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { setTimeout as delay } from 'timers/promises'

const RENAME_ATTEMPTS = 5
const RENAME_RETRY_MS = 100
// OneDrive or a virus scanner can hold the target for a moment on Windows
const BRIEF_LOCK_CODES = new Set(['EPERM', 'EACCES', 'EBUSY'])

const inFlight = new Set<Promise<void>>()

async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 1; attempt < RENAME_ATTEMPTS; attempt++) {
    try {
      return await rename(from, to)
    } catch (error) {
      if (!BRIEF_LOCK_CODES.has((error as NodeJS.ErrnoException).code ?? '')) throw error
      await delay(RENAME_RETRY_MS)
    }
  }
  return rename(from, to)
}

async function writeThenRename(absPath: string, text: string): Promise<void> {
  await mkdir(dirname(absPath), { recursive: true })
  const tmpPath = `${absPath}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await writeFile(tmpPath, text, { encoding: 'utf-8', flush: true })
    await renameWithRetry(tmpPath, absPath)
  } catch (error) {
    await unlink(tmpPath).catch(() => undefined)
    throw error
  }
}

export function writeFileAtomic(absPath: string, text: string): Promise<void> {
  const write = writeThenRename(absPath, text)
  inFlight.add(write)
  const settle = (): void => {
    inFlight.delete(write)
  }
  write.then(settle, settle)
  return write
}

export function hasPendingWrites(): boolean {
  return inFlight.size > 0
}

export async function pendingWrites(): Promise<void> {
  while (inFlight.size > 0) await Promise.allSettled(inFlight)
}
