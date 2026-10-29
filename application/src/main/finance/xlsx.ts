import { inflateRawSync } from 'zlib'
import { IPC, type FileFilter } from '@shared/ipc'
import { importFile } from '../files/files'
import { handleWithEvent } from '../ipc'

const MAX_XLSX_BYTES = 10 * 1024 * 1024
export const MAX_PART_BYTES = 32 * 1024 * 1024
const MAX_COLUMNS = 16384
const MAX_CELLS = 1_000_000
const MAX_CODE_POINT = 0x10ffff
const XLSX_FILTER: FileFilter = { name: 'Excel workbook', extensions: ['xlsx'] }

const END_OF_DIRECTORY = 0x06054b50
const DIRECTORY_ENTRY = 0x02014b50
const LOCAL_HEADER = 0x04034b50
const END_RECORD_SIZE = 22
const MAX_COMMENT_SIZE = 0xffff

function notValid(): never {
  throw new Error('Not a valid .xlsx file')
}

function tooLarge(): never {
  throw new Error('The .xlsx file is too large')
}

function u16(buf: Buffer, at: number): number {
  return at + 2 <= buf.length ? buf.readUInt16LE(at) : notValid()
}

function u32(buf: Buffer, at: number): number {
  return at + 4 <= buf.length ? buf.readUInt32LE(at) : notValid()
}

function slice(buf: Buffer, start: number, length: number): Buffer {
  return start + length <= buf.length ? buf.subarray(start, start + length) : notValid()
}

function findEndOfDirectory(buf: Buffer): number {
  const last = buf.length - END_RECORD_SIZE
  const first = Math.max(0, last - MAX_COMMENT_SIZE)
  for (let at = last; at >= first; at--) {
    if (buf.readUInt32LE(at) === END_OF_DIRECTORY) return at
  }
  return notValid()
}

function unpack(method: number, data: Buffer): string {
  if (method === 0) return data.toString('utf8')
  if (method !== 8) return notValid()
  try {
    return inflateRawSync(data, { maxOutputLength: MAX_PART_BYTES }).toString('utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') tooLarge()
    return notValid()
  }
}

function readZipEntry(buf: Buffer, name: string): string | null {
  const end = findEndOfDirectory(buf)
  let at = u32(buf, end + 16)
  for (let left = u16(buf, end + 10); left > 0; left--) {
    if (u32(buf, at) !== DIRECTORY_ENTRY) notValid()
    const nameLength = u16(buf, at + 28)
    if (slice(buf, at + 46, nameLength).toString('utf8') === name) {
      const local = u32(buf, at + 42)
      if (u32(buf, local) !== LOCAL_HEADER) notValid()
      const start = local + 30 + u16(buf, local + 26) + u16(buf, local + 28)
      return unpack(u16(buf, at + 10), slice(buf, start, u32(buf, at + 20)))
    }
    at += 46 + nameLength + u16(buf, at + 30) + u16(buf, at + 32)
  }
  return null
}

function fromCodePoint(entity: string, code: number): string {
  return code <= MAX_CODE_POINT ? String.fromCodePoint(code) : entity
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (entity, h) => fromCodePoint(entity, parseInt(h, 16)))
    .replace(/&#(\d+);/g, (entity, d) => fromCodePoint(entity, parseInt(d, 10)))
    .replace(/&amp;/g, '&')
}

interface XmlElement {
  attrs: string
  body: string
}

const TAG_NAME_END = /[\s/>]/

// Lazy indexOf scan that stops at the first unclosed tag, so hostile XML stays linear
function* elements(xml: string, tag: string): Generator<XmlElement> {
  const open = `<${tag}`
  const close = `</${tag}>`
  for (let at = xml.indexOf(open); at >= 0; at = xml.indexOf(open, at + 1)) {
    if (!TAG_NAME_END.test(xml.charAt(at + open.length))) continue
    const headEnd = xml.indexOf('>', at)
    if (headEnd < 0) return
    const head = xml.slice(at + open.length, headEnd)
    if (head.endsWith('/')) {
      yield { attrs: head.slice(0, -1), body: '' }
      at = headEnd
      continue
    }
    const end = xml.indexOf(close, headEnd)
    if (end < 0) return
    yield { attrs: head, body: xml.slice(headEnd + 1, end) }
    at = end
  }
}

function textOf(xml: string): string {
  let text = ''
  for (const run of elements(xml, 't')) text += run.body
  return decodeXmlEntities(text)
}

function parseSharedStrings(xml: string): string[] {
  return Array.from(elements(xml, 'si'), (si) => textOf(si.body))
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? ''
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

function cellValue(cell: XmlElement, shared: string[]): string {
  if (/t="inlineStr"/.test(cell.attrs)) return textOf(cell.body)
  const [v] = elements(cell.body, 'v')
  if (v === undefined) return ''
  return /t="s"/.test(cell.attrs) ? (shared[Number(v.body)] ?? '') : decodeXmlEntities(v.body)
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = []
  let cellCount = 0
  for (const row of elements(xml, 'row')) {
    const cells: string[] = []
    for (const cell of elements(row.body, 'c')) {
      const col = columnIndex(/r="([A-Z]+\d+)"/.exec(cell.attrs)?.[1] ?? '')
      if (col > MAX_COLUMNS) notValid()
      cells[col > 0 ? col - 1 : cells.length] = cellValue(cell, shared)
      if (cellCount + cells.length > MAX_CELLS) tooLarge()
    }
    // An empty row costs memory too, so every row counts as at least one cell
    cellCount += Math.max(cells.length, 1)
    if (cellCount > MAX_CELLS) tooLarge()
    // Columns skipped by r="…" are holes; they become ''
    rows.push(Array.from(cells, (value) => value ?? ''))
  }
  return rows
}

// Standard OOXML exports only, see documentation/software/main/finance-xlsx.md
export function readFirstSheet(buf: Buffer): string[][] {
  const shared = parseSharedStrings(readZipEntry(buf, 'xl/sharedStrings.xml') ?? '')
  return parseSheet(readZipEntry(buf, 'xl/worksheets/sheet1.xml') ?? '', shared)
}

export function registerXlsxIpc(): void {
  handleWithEvent(IPC.xlsx.importSheet, async (event) => {
    const buf = await importFile(event, [XLSX_FILTER], MAX_XLSX_BYTES)
    return buf === null ? null : readFirstSheet(buf)
  })
}
