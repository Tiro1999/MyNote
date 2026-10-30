import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CorruptFileError,
  flushWrites,
  hasUnsentWrites,
  joinPath,
  readJson,
  readText,
  writeJson,
  writeText
} from './files'

interface SentWrite {
  path: string
  text: string
  result: PromiseWithResolvers<void>
}

type Outcome = 'resolved' | 'rejected' | 'pending'

let sentWrites: SentWrite[] = []
const files = {
  readText: vi.fn<(path: string) => Promise<string | null>>(),
  writeText: vi.fn<(path: string, text: string) => Promise<void>>()
}

beforeEach(() => {
  sentWrites = []
  files.readText.mockReset()
  files.writeText.mockReset().mockImplementation((path, text) => {
    const result = Promise.withResolvers<void>()
    sentWrites.push({ path, text, result })
    return result.promise
  })
  vi.stubGlobal('window', { api: { files } })
})

afterEach(async () => {
  files.writeText.mockImplementation(() => Promise.resolve())
  for (const write of sentWrites) write.result.resolve()
  await flushWrites()
  vi.unstubAllGlobals()
})

function sent(text: string): PromiseWithResolvers<void> {
  const write = sentWrites.find((candidate) => candidate.text === text)
  if (write === undefined) throw new Error(`"${text}" was not sent`)
  return write.result
}

const sentTexts = (): string[] => sentWrites.map((write) => write.text)

// A settled promise wins the race, because the timer fires after all pending microtasks
function outcome(promise: Promise<unknown>): Promise<Outcome> {
  const settled = promise.then(
    (): Outcome => 'resolved',
    (): Outcome => 'rejected'
  )
  const pending = new Promise<Outcome>((resolve) => setTimeout(() => resolve('pending'), 0))
  return Promise.race([settled, pending])
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('Expected a rejection')
}

describe('joinPath', () => {
  it('joins the segments with /', () => {
    expect(joinPath('nb', 's', 'page.json')).toBe('nb/s/page.json')
  })
})

describe('readText', () => {
  it('waits for the write in flight to the same path before it reads', async () => {
    files.readText.mockResolvedValue('a')
    const written = writeText('p', 'a')
    const read = readText('p')
    expect(await outcome(read)).toBe('pending')
    expect(files.readText).not.toHaveBeenCalled()
    sent('a').resolve()
    await expect(read).resolves.toBe('a')
    expect(files.readText).toHaveBeenCalledWith('p')
    await written
  })

  it('also waits for the text queued behind the in-flight write', async () => {
    files.readText.mockResolvedValue('b')
    const callers = [writeText('p', 'a'), writeText('p', 'b')]
    const read = readText('p')
    sent('a').resolve()
    expect(await outcome(read)).toBe('pending')
    expect(files.readText).not.toHaveBeenCalled()
    sent('b').resolve()
    await expect(read).resolves.toBe('b')
    await Promise.all(callers)
  })

  it('still reads once the write it waits for has failed', async () => {
    files.readText.mockResolvedValue('old')
    const written = writeText('p', 'a')
    const read = readText('p')
    expect(await outcome(read)).toBe('pending')
    sent('a').reject(new Error('EBUSY: resource busy or locked'))
    await expect(written).rejects.toThrow('EBUSY')
    await expect(read).resolves.toBe('old')
  })

  it('does not wait for writes to other paths', async () => {
    files.readText.mockResolvedValue('text of p')
    const written = writeText('q', 'x')
    expect(await outcome(readText('p'))).toBe('resolved')
    sent('x').resolve()
    await written
  })
})

describe('readJson', () => {
  it('waits for the writes queued for the same path before it reads', async () => {
    files.readText.mockResolvedValue('["nb1"]')
    const written = writeJson('notebooks.json', ['nb1'])
    const read = readJson('notebooks.json', (raw) => raw)
    expect(await outcome(read)).toBe('pending')
    sent('[\n  "nb1"\n]').resolve()
    await expect(read).resolves.toEqual(['nb1'])
    await written
  })

  it('gives null for a missing file', async () => {
    files.readText.mockResolvedValue(null)
    await expect(readJson('nb1/s1/page.json', () => 'parsed')).resolves.toBeNull()
  })

  it('returns what parse makes of the file at the path', async () => {
    files.readText.mockImplementation(async (path) =>
      path === 'notebooks.json' ? '[{"id":"nb1"}]' : null
    )
    const ids = await readJson('notebooks.json', (raw) =>
      (raw as Array<{ id: string }>).map((notebook) => notebook.id)
    )
    expect(ids).toEqual(['nb1'])
  })

  it('rejects bad JSON with a CorruptFileError that names the path and the reason', async () => {
    files.readText.mockResolvedValue('{"sections": [')
    const error = await rejectionOf(readJson('nb1/s1/page.json', (raw) => raw))
    expect(error).toBeInstanceOf(CorruptFileError)
    const corrupt = error as CorruptFileError
    expect(corrupt.path).toBe('nb1/s1/page.json')
    expect(corrupt.cause).toBeInstanceOf(SyntaxError)
    expect(corrupt.message).toBe(`nb1/s1/page.json: ${(corrupt.cause as SyntaxError).message}`)
  })

  it('wraps an error thrown by parse in a CorruptFileError', async () => {
    files.readText.mockResolvedValue('{"sections":"x"}')
    const reason = new Error('Notebook "nb1": sections must be an array')
    const error = await rejectionOf(
      readJson('notebooks.json', () => {
        throw reason
      })
    )
    expect(error).toBeInstanceOf(CorruptFileError)
    const corrupt = error as CorruptFileError
    expect(corrupt.path).toBe('notebooks.json')
    expect(corrupt.cause).toBe(reason)
    expect(corrupt.message).toBe('notebooks.json: Notebook "nb1": sections must be an array')
  })

  it('passes a read failure through unchanged', async () => {
    const failure = new Error('EACCES: permission denied')
    files.readText.mockRejectedValue(failure)
    await expect(readJson('notebooks.json', (raw) => raw)).rejects.toBe(failure)
  })
})

describe('writeJson', () => {
  it('writes the value as JSON indented by two spaces', async () => {
    const written = writeJson('notebooks.json', [{ id: 'nb1' }])
    expect(sentWrites.map(({ path, text }) => [path, text])).toEqual([
      ['notebooks.json', '[\n  {\n    "id": "nb1"\n  }\n]']
    ])
    sent('[\n  {\n    "id": "nb1"\n  }\n]').resolve()
    await expect(written).resolves.toBeUndefined()
  })
})

describe('write queue', () => {
  it('sends only the newest of the texts that wait behind the in-flight write', async () => {
    const callers = [writeText('p', 'a'), writeText('p', 'b'), writeText('p', 'c')]
    expect(sentTexts()).toEqual(['a'])
    sent('a').resolve()
    expect(await Promise.all(callers.map(outcome))).toEqual(['resolved', 'pending', 'pending'])
    sent('c').resolve()
    expect(await Promise.all(callers.map(outcome))).toEqual(['resolved', 'resolved', 'resolved'])
    expect(sentTexts()).toEqual(['a', 'c'])
  })

  it('keeps one write in flight per path, not one in total', async () => {
    const callers = [writeText('p1', 'x'), writeText('p2', 'y')]
    expect(sentWrites.map(({ path, text }) => `${path}:${text}`)).toEqual(['p1:x', 'p2:y'])
    sent('x').resolve()
    sent('y').resolve()
    await expect(Promise.all(callers)).resolves.toEqual([undefined, undefined])
  })

  it('rejects the caller of a failed write and still sends the text queued behind it', async () => {
    const failure = new Error('EBUSY: resource busy or locked')
    const callers = [writeText('p', 'a'), writeText('p', 'b'), writeText('p', 'c')]
    sent('a').reject(failure)
    await expect(callers[0]).rejects.toBe(failure)
    expect(await outcome(callers[1])).toBe('pending')
    sent('c').resolve()
    expect(await Promise.all(callers.slice(1).map(outcome))).toEqual(['resolved', 'resolved'])
  })

  it('rejects every caller whose text a failed write carried, and the next write still runs', async () => {
    const failure = new Error('EBUSY: resource busy or locked')
    const callers = [writeText('p', 'a'), writeText('p', 'b'), writeText('p', 'c')]
    sent('a').resolve()
    expect(await outcome(callers[0])).toBe('resolved')
    sent('c').reject(failure)
    expect(await Promise.all(callers.slice(1).map(outcome))).toEqual(['rejected', 'rejected'])
    await expect(callers[2]).rejects.toBe(failure)
    const next = writeText('p', 'd')
    sent('d').resolve()
    await expect(next).resolves.toBeUndefined()
  })

  it('reports unsent writes only while text waits behind an in-flight write', async () => {
    const first = writeText('p', 'a')
    expect(hasUnsentWrites()).toBe(false)
    const second = writeText('p', 'b')
    expect(hasUnsentWrites()).toBe(true)
    sent('a').resolve()
    expect(await outcome(first)).toBe('resolved')
    expect(hasUnsentWrites()).toBe(false)
    sent('b').resolve()
    await second
    expect(hasUnsentWrites()).toBe(false)
  })
})

describe('flushWrites', () => {
  it('waits for the text queued behind the in-flight write', async () => {
    const callers = [writeText('p', 'a'), writeText('p', 'b')]
    const flushed = flushWrites()
    sent('a').resolve()
    expect(await outcome(flushed)).toBe('pending')
    sent('b').resolve()
    expect(await outcome(flushed)).toBe('resolved')
    await Promise.all(callers)
  })

  it('waits for the writes of every path', async () => {
    const callers = [writeText('p', 'a'), writeText('q', 'x')]
    const flushed = flushWrites()
    sent('a').resolve()
    expect(await outcome(flushed)).toBe('pending')
    sent('x').resolve()
    expect(await outcome(flushed)).toBe('resolved')
    await Promise.all(callers)
  })

  it('resolves even when a write fails', async () => {
    const caller = writeText('p', 'a')
    const flushed = flushWrites()
    sent('a').reject(new Error('EBUSY: resource busy or locked'))
    await expect(caller).rejects.toThrow('EBUSY')
    await expect(flushed).resolves.toBeUndefined()
  })
})
