import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasPendingWrites, pendingWrites, writeFileAtomic } from './atomicWrite'

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>()
  return { ...actual, rename: vi.fn(actual.rename), writeFile: vi.fn(actual.writeFile) }
})

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mynote-atomic-'))
})

afterEach(async () => {
  vi.resetAllMocks()
  await rm(dir, { recursive: true, force: true })
})

async function tmpFiles(): Promise<string[]> {
  return (await readdir(dir)).filter((name) => name.endsWith('.tmp'))
}

function fsError(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: rename refused`), { code })
}

describe('writeFileAtomic', () => {
  it('writes the text and creates missing parent folders', async () => {
    const target = join(dir, 'nb', 's1', 'page.json')
    await writeFileAtomic(target, '{"pageId":"s1"}')
    expect(await readFile(target, 'utf-8')).toBe('{"pageId":"s1"}')
  })

  it('flushes the temp file to disk before the rename', async () => {
    await writeFileAtomic(join(dir, 'page.json'), '{}')
    const tmpPath = expect.stringMatching(/page\.json\.[0-9a-f]{12}\.tmp$/)
    expect(writeFile).toHaveBeenCalledWith(tmpPath, '{}', { encoding: 'utf-8', flush: true })
  })

  it('leaves no temp file behind', async () => {
    await writeFileAtomic(join(dir, 'notebooks.json'), '[]')
    expect(await readdir(dir)).toEqual(['notebooks.json'])
  })

  it('keeps the file whole under 20 concurrent writes', async () => {
    const target = join(dir, 'notebooks.json')
    const texts = Array.from({ length: 20 }, (_, i) =>
      JSON.stringify({ write: i, padding: 'x'.repeat(5000 * (20 - i)) })
    )
    await Promise.all(texts.map((text) => writeFileAtomic(target, text)))
    const content = await readFile(target, 'utf-8')
    expect(texts.map((text) => JSON.parse(text))).toContainEqual(JSON.parse(content))
    expect(texts).toContain(content)
    expect(await tmpFiles()).toEqual([])
  })

  it('rejects when the target is a folder, leaving the folder and no temp file', async () => {
    const target = join(dir, 'page.json')
    await mkdir(target)
    await expect(writeFileAtomic(target, 'x')).rejects.toThrow()
    expect(rename).toHaveBeenCalledOnce()
    expect((await stat(target)).isDirectory()).toBe(true)
    expect(await tmpFiles()).toEqual([])
  })

  it('retries a rename that a briefly held target refuses', async () => {
    const target = join(dir, 'ledger.csv')
    vi.mocked(rename)
      .mockRejectedValueOnce(fsError('EPERM'))
      .mockRejectedValueOnce(fsError('EPERM'))
    await writeFileAtomic(target, 'id,pos')
    expect(rename).toHaveBeenCalledTimes(3)
    expect(await readFile(target, 'utf-8')).toBe('id,pos')
    expect(await tmpFiles()).toEqual([])
  })

  it('gives up after 5 attempts with the original error, keeping the old file', async () => {
    const target = join(dir, 'ledger.csv')
    await writeFile(target, 'old')
    const busy = fsError('EBUSY')
    vi.mocked(rename).mockRejectedValue(busy)
    await expect(writeFileAtomic(target, 'new')).rejects.toBe(busy)
    expect(rename).toHaveBeenCalledTimes(5)
    expect(await readFile(target, 'utf-8')).toBe('old')
    expect(await tmpFiles()).toEqual([])
  })
})

describe('pendingWrites', () => {
  it('waits for every write in flight, failed ones included', async () => {
    const folder = join(dir, 'folder')
    await mkdir(folder)
    const failed = writeFileAtomic(folder, 'x').catch((error: unknown) => error)
    const written = writeFileAtomic(join(dir, 'page.json'), 'done')
    await expect(pendingWrites()).resolves.toBeUndefined()
    expect(await readFile(join(dir, 'page.json'), 'utf-8')).toBe('done')
    expect(await failed).toBeInstanceOf(Error)
    await written
  })

  it('resolves when nothing is in flight', async () => {
    await expect(pendingWrites()).resolves.toBeUndefined()
  })
})

describe('hasPendingWrites', () => {
  it('is true only while a write is in flight', async () => {
    await pendingWrites()
    expect(hasPendingWrites()).toBe(false)
    const write = writeFileAtomic(join(dir, 'page.json'), '{}')
    expect(hasPendingWrites()).toBe(true)
    await write
    expect(hasPendingWrites()).toBe(false)
  })
})
