import { messageOf } from '@shared/errors'
import type { DirEntry, FileFilter } from '@shared/ipc'

interface QueuedWrite {
  text: string
  done: PromiseWithResolvers<void>
}

interface PathQueue {
  inFlight: QueuedWrite
  pending: QueuedWrite | null
}

// Write queue: one write in flight per path; newer text replaces the text waiting behind it
const queues = new Map<string, PathQueue>()

// Folder-relative and '/'-separated; main resolves it, see documentation/software/main/ipc.md
export function joinPath(...segments: string[]): string {
  return segments.join('/')
}

export class CorruptFileError extends Error {
  constructor(path: string, cause: unknown) {
    super(`${path}: ${messageOf(cause)}`, { cause })
    this.name = 'CorruptFileError'
  }
}

// Waits for the writes queued for this path first, so the read sees their text
export async function readText(path: string): Promise<string | null> {
  const queue = queues.get(path)
  if (queue) await untilSettled([queue])
  return window.api.files.readText(path)
}

// null = missing; bad JSON or an error thrown by parse = CorruptFileError
export async function readJson<T>(path: string, parse: (raw: unknown) => T): Promise<T | null> {
  const text = await readText(path)
  if (text === null) return null
  try {
    return parse(JSON.parse(text))
  } catch (error) {
    throw new CorruptFileError(path, error)
  }
}

export function writeText(path: string, text: string): Promise<void> {
  const queue = queues.get(path)
  const write = queue?.pending ?? { text, done: Promise.withResolvers<void>() }
  write.text = text
  if (queue) queue.pending = write
  else send(path, write)
  return write.done.promise
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeText(path, JSON.stringify(value, null, 2))
}

function send(path: string, write: QueuedWrite): void {
  queues.set(path, { inFlight: write, pending: null })
  void writeToMain(path, write.text)
    .then(write.done.resolve, write.done.reject)
    .finally(() => sendPending(path))
}

function sendPending(path: string): void {
  const pending = queues.get(path)?.pending
  queues.delete(path)
  if (pending) send(path, pending)
}

// async turns a synchronous throw of the Preload API (`window.api`) into a rejection, so the queue keeps moving
async function writeToMain(path: string, text: string): Promise<void> {
  await window.api.files.writeText(path, text)
}

// Settles once the last write of each queue has settled, failed or not
function untilSettled(list: PathQueue[]): Promise<unknown> {
  return Promise.allSettled(list.map((queue) => (queue.pending ?? queue.inFlight).done.promise))
}

// Waits for every write sent or queued so far; a failed write rejects only its callers
export async function flushWrites(): Promise<void> {
  await untilSettled([...queues.values()])
}

// True while text waits behind an in-flight write, so it has not reached main yet
export function hasUnsentWrites(): boolean {
  return [...queues.values()].some((queue) => queue.pending !== null)
}

export function remove(path: string): Promise<void> {
  return window.api.files.remove(path)
}

export function list(dir: string): Promise<DirEntry[]> {
  return window.api.files.list(dir)
}

export function openNotebookFolder(): Promise<string | null> {
  return window.api.dialogs.openNotebookFolder()
}

export function pickFile(filters: FileFilter[]): Promise<string | null> {
  return window.api.dialogs.pickFile(filters)
}
