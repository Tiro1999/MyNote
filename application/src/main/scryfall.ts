/**
 * Scryfall access, main-process side.
 *
 * Everything network-related lives here rather than in the renderer, for three
 * reasons: the renderer CSP is `default-src 'self'` and blocks outbound
 * requests entirely; rate limiting is only meaningful if it is enforced in one
 * place; and the bulk files are far too large to hand through IPC as a string.
 *
 * Rate limits (https://scryfall.com/docs/api/rate-limits), enforced below:
 *   /cards/search, /cards/named, /cards/random, /cards/collection → 2/s (500ms)
 *   /cards/manifest                                               → 10/min (6s)
 *   everything else on api.scryfall.com                           → 10/s (100ms)
 *   *.scryfall.io file origins (bulk data, images)                → no limit
 *
 * An HTTP 429 locks the caller out for 30 seconds, and repeated overage risks a
 * ban, so 429 is treated as a hard stop-and-back-off rather than a retry-now.
 */
import { app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import * as zlib from 'zlib'
import * as readline from 'readline'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { toOracleCard, toPrintingCard } from '../shared/scryfall-model'
import type { OracleCard, PrintingCard, RawCard } from '../shared/scryfall-model'

// ─── Constants ────────────────────────────────────────────────────────────────

const API_ORIGIN = 'https://api.scryfall.com'

/** Scryfall asks that the User-Agent identify the client accurately. */
const USER_AGENT = `MyNote/${app.getVersion?.() ?? '0.1.0'} (+https://github.com/Tiro1999/MyNote)`

/** Hosts this module is permitted to contact. Guards the IPC surface against
 *  being turned into a general-purpose fetch proxy by renderer-side input. */
const ALLOWED_HOSTS = new Set(['api.scryfall.com', 'data.scryfall.io', 'cards.scryfall.io'])

const SLOW_ENDPOINTS = ['/cards/search', '/cards/named', '/cards/random', '/cards/collection']

/** `/cards/collection` accepts at most 75 identifiers per request. */
export const COLLECTION_BATCH_SIZE = 75

// ─── Cache location ───────────────────────────────────────────────────────────
// Deliberately NOT inside the user's notebook data root: this is regenerable
// derived data, it is large, and it has no business in their backups or in the
// git export used for the nightly report.

export function cacheDir(): string {
  return join(app.getPath('userData'), 'scryfall')
}
const oracleIndexPath = (): string => join(cacheDir(), 'oracle-index.json')
const printingsPath = (): string => join(cacheDir(), 'printings.json')
const cacheMetaPath = (): string => join(cacheDir(), 'cache-meta.json')
const imageDir = (): string => join(cacheDir(), 'images')

// ─── Rate limiter ─────────────────────────────────────────────────────────────

/**
 * Serialises outbound API calls and keeps a minimum spacing between them.
 * A single shared chain (rather than one per endpoint class) is intentional:
 * Scryfall's limits are per-client, not per-endpoint-per-client, so overlapping
 * fast and slow calls could still exceed the slow limit.
 */
class RateLimiter {
  private chain: Promise<unknown> = Promise.resolve()
  private lockedUntil = 0

  schedule<T>(minSpacingMs: number, task: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const waitFor = Math.max(0, this.lockedUntil - Date.now())
      if (waitFor > 0) await delay(waitFor)
      const result = await task()
      this.lockedUntil = Date.now() + minSpacingMs
      return result
    }
    const next = this.chain.then(run, run)
    // Keep the chain alive even when a task rejects, or one failure would
    // poison every subsequent request.
    this.chain = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  /** Called on HTTP 429 — Scryfall limits access for 30 seconds. */
  backOff(seconds = 30): void {
    this.lockedUntil = Math.max(this.lockedUntil, Date.now() + seconds * 1000)
  }
}

const limiter = new RateLimiter()

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

function spacingForPath(path: string): number {
  if (path.startsWith('/cards/manifest')) return 6000
  if (SLOW_ENDPOINTS.some((endpoint) => path.startsWith(endpoint))) return 500
  return 100
}

function assertAllowedUrl(url: string): URL {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Refusing to fetch non-Scryfall URL: ${url}`)
  }
  return parsed
}

export class ScryfallError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'ScryfallError'
  }
}

/** One rate-limited API call against api.scryfall.com. */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return limiter.schedule(spacingForPath(path), async () => {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      ...init,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers
      }
    })

    if (response.status === 429) {
      limiter.backOff(30)
      throw new ScryfallError(
        'Scryfall rate limit reached (HTTP 429) — waiting 30 seconds before further requests.',
        429
      )
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new ScryfallError(
        `Scryfall request failed: ${response.status} ${response.statusText}${
          detail ? ` — ${detail.slice(0, 200)}` : ''
        }`,
        response.status
      )
    }
    return (await response.json()) as T
  })
}

// ─── Card shapes ──────────────────────────────────────────────────────────────
// The reduced shapes and their pure transformations live in src/shared so the
// renderer can use them too (deck legality, card rendering) without dragging in
// this module's network and filesystem imports.

export type {
  OracleCard,
  OracleFace,
  PrintingCard,
  LegalityFormat,
  LegalityValue
} from '../shared/scryfall-model'
export {
  LEGALITY_FORMATS,
  encodeLegalities,
  decodeLegality,
  decodeAllLegalities
} from '../shared/scryfall-model'

// ─── Bulk data ────────────────────────────────────────────────────────────────

export interface BulkInfo {
  type: string
  name: string
  description: string
  updatedAt: string
  /** Line-delimited JSON — streamable without buffering the whole file. */
  jsonlUri: string
  compressedSize: number
}

export async function listBulkData(): Promise<BulkInfo[]> {
  const response = await api<{
    data: Array<{
      type: string
      name: string
      description: string
      updated_at: string
      jsonl_download_uri: string
      compressed_size: number
    }>
  }>('/bulk-data')

  return response.data.map((entry) => ({
    type: entry.type,
    name: entry.name,
    description: entry.description,
    updatedAt: entry.updated_at,
    jsonlUri: entry.jsonl_download_uri,
    compressedSize: entry.compressed_size
  }))
}

export interface CacheMeta {
  /** Which bulk type the oracle index was built from. */
  bulkType: string
  /** Scryfall's `updated_at` for that bulk file — used to detect staleness. */
  bulkUpdatedAt: string
  /** When we last rebuilt the index locally. */
  builtAt: string
  oracleCount: number
}

export function readCacheMeta(): CacheMeta | null {
  try {
    return JSON.parse(fs.readFileSync(cacheMetaPath(), 'utf-8')) as CacheMeta
  } catch {
    return null
  }
}

export type ProgressFn = (progress: { phase: string; count: number; total?: number }) => void

/**
 * Download a bulk file and reduce it to the oracle index, streaming throughout.
 *
 * The file is gzipped JSONL, so it can be piped through gunzip and read line by
 * line — peak memory stays at roughly the size of the reduced index rather than
 * the ~500MB of decompressed JSON. Bulk files live on data.scryfall.io, which
 * has no rate limit.
 */
export async function buildOracleIndex(
  bulkType = 'oracle_cards',
  onProgress?: ProgressFn
): Promise<CacheMeta> {
  const bulk = (await listBulkData()).find((entry) => entry.type === bulkType)
  if (!bulk) throw new Error(`Unknown Scryfall bulk data type: ${bulkType}`)

  assertAllowedUrl(bulk.jsonlUri)
  onProgress?.({ phase: 'download', count: 0, total: bulk.compressedSize })

  const response = await fetch(bulk.jsonlUri, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/x-ndjson' }
  })
  if (!response.ok || !response.body) {
    throw new ScryfallError(
      `Bulk download failed: ${response.status} ${response.statusText}`,
      response.status
    )
  }

  await fs.promises.mkdir(cacheDir(), { recursive: true })

  // Write incrementally as JSON array elements so the reduced index never has
  // to exist as one giant in-memory array *and* a serialised copy at once.
  const tmpPath = `${oracleIndexPath()}.tmp`
  const out = fs.createWriteStream(tmpPath, { encoding: 'utf-8' })
  out.write('[\n')

  let count = 0
  let first = true
  const gunzip = zlib.createGunzip()
  const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0])
  // Pump the network stream through gunzip in the background; consume the
  // decompressed side line by line. Errors on either end surface via `pump`.
  const pump = pipeline(source, gunzip)

  const lines = readline.createInterface({ input: gunzip, crlfDelay: Infinity })
  for await (const line of lines) {
    const trimmed = line.trim().replace(/,$/, '')
    // The JSONL feed is one object per line, but tolerate a stray array
    // wrapper so a switch to the plain JSON endpoint would not break this.
    if (trimmed.length === 0 || trimmed === '[' || trimmed === ']') continue
    let raw: RawCard
    try {
      raw = JSON.parse(trimmed) as RawCard
    } catch {
      continue
    }
    const card = toOracleCard(raw)
    if (!card) continue

    if (!first) out.write(',\n')
    first = false
    if (!out.write(JSON.stringify(card))) {
      await new Promise((resolve) => out.once('drain', resolve))
    }
    count++
    if (count % 2000 === 0) onProgress?.({ phase: 'index', count })
  }

  await pump
  out.write('\n]\n')
  await new Promise<void>((resolve, reject) => {
    out.end((error?: Error) => (error ? reject(error) : resolve()))
  })

  // Swap atomically so a crash mid-download cannot leave a truncated index.
  await fs.promises.rename(tmpPath, oracleIndexPath())

  const meta: CacheMeta = {
    bulkType,
    bulkUpdatedAt: bulk.updatedAt,
    builtAt: new Date().toISOString(),
    oracleCount: count
  }
  await fs.promises.writeFile(cacheMetaPath(), JSON.stringify(meta, null, 2), 'utf-8')
  onProgress?.({ phase: 'done', count })
  return meta
}

/** Is a newer bulk file available than the one the index was built from? */
export async function isOracleIndexStale(): Promise<boolean> {
  const meta = readCacheMeta()
  if (!meta) return true
  const bulk = (await listBulkData()).find((entry) => entry.type === meta.bulkType)
  return !bulk || bulk.updatedAt !== meta.bulkUpdatedAt
}

export async function readOracleIndex(): Promise<OracleCard[]> {
  try {
    return JSON.parse(await fs.promises.readFile(oracleIndexPath(), 'utf-8')) as OracleCard[]
  } catch {
    return []
  }
}

// ─── On-demand printing lookup ────────────────────────────────────────────────

export type CardIdentifier =
  | { id: string }
  | { name: string }
  | { set: string; collector_number: string }

/**
 * Resolve printings via /cards/collection in batches of 75. At the endpoint's
 * 2 requests/second that is 150 cards/second — a 10,000 card collection
 * resolves in a bit over a minute, well inside Scryfall's guidance.
 *
 * Returns the reduced printings plus whatever Scryfall could not find, so the
 * caller can surface unresolved rows instead of silently dropping them.
 */
export async function fetchPrintings(
  identifiers: CardIdentifier[],
  onProgress?: ProgressFn
): Promise<{ found: PrintingCard[]; notFound: CardIdentifier[] }> {
  const found: PrintingCard[] = []
  const notFound: CardIdentifier[] = []

  for (let offset = 0; offset < identifiers.length; offset += COLLECTION_BATCH_SIZE) {
    const batch = identifiers.slice(offset, offset + COLLECTION_BATCH_SIZE)
    const response = await api<{ data: RawCard[]; not_found: CardIdentifier[] }>(
      '/cards/collection',
      { method: 'POST', body: JSON.stringify({ identifiers: batch }) }
    )
    for (const raw of response.data) {
      const printing = toPrintingCard(raw)
      if (printing) found.push(printing)
    }
    notFound.push(...(response.not_found ?? []))
    onProgress?.({ phase: 'printings', count: found.length, total: identifiers.length })
  }

  return { found, notFound }
}

export async function readPrintings(): Promise<PrintingCard[]> {
  try {
    return JSON.parse(await fs.promises.readFile(printingsPath(), 'utf-8')) as PrintingCard[]
  } catch {
    return []
  }
}

/** Merge freshly fetched printings into the cache, keyed by printing id. */
export async function savePrintings(printings: PrintingCard[]): Promise<number> {
  const existing = await readPrintings()
  const byId = new Map(existing.map((printing) => [printing.id, printing]))
  for (const printing of printings) byId.set(printing.id, printing)
  // Sorted for a stable file — this cache is regenerable, but a deterministic
  // order keeps diffs readable when debugging.
  const merged = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
  await fs.promises.mkdir(cacheDir(), { recursive: true })
  await fs.promises.writeFile(printingsPath(), JSON.stringify(merged), 'utf-8')
  return merged.length
}

// ─── Image cache ──────────────────────────────────────────────────────────────
// The renderer CSP allows img-src from file: but not https:, so card images must
// be on disk before they can be displayed. cards.scryfall.io has no rate limit.

/**
 * Ensure a card image is cached locally; returns the absolute file path.
 * Images are content-addressed by printing id + size and never expire — Scryfall
 * treats image URLs as immutable for a given printing.
 */
export async function cacheImage(printingId: string, url: string, size: string): Promise<string> {
  assertAllowedUrl(url)
  const extension = url.includes('.png') ? 'png' : 'jpg'
  const target = join(imageDir(), `${printingId}-${size}.${extension}`)
  try {
    await fs.promises.access(target)
    return target
  } catch {
    // not cached yet
  }

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' } })
  if (!response.ok || !response.body) {
    throw new ScryfallError(`Image download failed: ${response.status}`, response.status)
  }
  await fs.promises.mkdir(imageDir(), { recursive: true })
  const tmp = `${target}.tmp`
  await pipeline(
    Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    fs.createWriteStream(tmp)
  )
  await fs.promises.rename(tmp, target)
  return target
}

/** Total bytes held by the cache, for the settings UI. */
export async function cacheSize(): Promise<{ bytes: number; images: number }> {
  let bytes = 0
  let images = 0
  const walk = async (dir: string): Promise<void> => {
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      const stat = await fs.promises.stat(full).catch(() => null)
      if (!stat) continue
      bytes += stat.size
      if (full.startsWith(imageDir())) images++
    }
  }
  await walk(cacheDir())
  return { bytes, images }
}

export async function clearCache(): Promise<void> {
  await fs.promises.rm(cacheDir(), { recursive: true, force: true })
}
