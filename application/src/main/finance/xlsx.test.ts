import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { crc32, deflateRawSync } from 'zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '@shared/ipc'
import { invokeIpc } from '../ipc.testing'
import { MAX_PART_BYTES, readFirstSheet, registerXlsxIpc } from './xlsx'

const electron = vi.hoisted(() => ({
  app: { isPackaged: false },
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  BrowserWindow: { fromWebContents: vi.fn() }
}))
vi.mock('electron', () => electron)

function zip(entries: Record<string, string>, method: 0 | 8): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const [name, text] of Object.entries(entries)) {
    const raw = Buffer.from(text)
    const data = method === 8 ? deflateRawSync(raw) : raw
    const fileName = Buffer.from(name)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(crc32(raw), 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(fileName.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(crc32(raw), 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(fileName.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, fileName, data)
    centrals.push(central, fileName)
    offset += local.length + fileName.length + data.length
  }
  const directory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(entries).length, 8)
  end.writeUInt16LE(Object.keys(entries).length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}

const sheet = (rows: string): string => `<worksheet><sheetData>${rows}</sheetData></worksheet>`

const workbook = {
  'xl/sharedStrings.xml':
    '<sst count="3"><si><t>Date</t></si><si><t>Amount</t></si>' +
    '<si><r><t>Café </t></r><r><t xml:space="preserve">&amp; Bar</t></r></si></sst>',
  'xl/worksheets/sheet1.xml': sheet(
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c>' +
      '<c r="C1" t="inlineStr"><is><t>Note</t></is></c></row>' +
      '<row r="2"><c r="A2"><v>45658</v></c><c r="B2" s="1"><v>12.5</v></c>' +
      '<c r="C2" t="s"><v>2</v></c></row>'
  )
}

const centralDirectoryOffset = (buf: Buffer): number => buf.length - 22 + 16

describe('readFirstSheet', () => {
  it.each([0, 8] as const)('reads shared, inline and numeric cells (method %i)', (method) => {
    expect(readFirstSheet(zip(workbook, method))).toEqual([
      ['Date', 'Amount', 'Note'],
      ['45658', '12.5', 'Café & Bar']
    ])
  })

  it('places cells by their column and appends cells without one', () => {
    const only = sheet('<row r="1"><c r="C1" t="inlineStr"><is><t>x</t></is></c></row>')
    expect(readFirstSheet(zip({ 'xl/worksheets/sheet1.xml': only }, 8))).toEqual([['', '', 'x']])
    const unnamed = sheet('<row r="1"><c r="B1"><v>1</v></c><c><v>2</v></c></row>')
    const appended = readFirstSheet(zip({ 'xl/worksheets/sheet1.xml': unnamed }, 8))
    expect(appended).toEqual([['', '1', '2']])
  })

  it('accepts the last Excel column XFD and rejects columns past it', () => {
    const last = sheet('<row r="1"><c r="XFD1"><v>1</v></c></row>')
    expect(readFirstSheet(zip({ 'xl/worksheets/sheet1.xml': last }, 8))[0]).toHaveLength(16384)
    const past = sheet('<row r="1"><c r="FXSHRXW1"><v>1</v></c></row>')
    expect(() => readFirstSheet(zip({ 'xl/worksheets/sheet1.xml': past }, 8))).toThrow(
      'Not a valid .xlsx file'
    )
  })

  it('allows 999,424 cells and rejects 1,015,808, counting row widths', () => {
    const rowsEndingAtXfd = (count: number): Buffer => {
      const rows = Array.from(
        { length: count },
        (_, i) => `<row><c r="XFD${i + 1}"><v>1</v></c></row>`
      )
      return zip({ 'xl/worksheets/sheet1.xml': sheet(rows.join('')) }, 8)
    }
    expect(readFirstSheet(rowsEndingAtXfd(61))).toHaveLength(61)
    expect(() => readFirstSheet(rowsEndingAtXfd(62))).toThrow('The .xlsx file is too large')
  })

  it('counts an empty row as one cell, so 1,000,001 empty rows are too large', () => {
    const emptyRows = (count: number): Buffer =>
      zip({ 'xl/worksheets/sheet1.xml': sheet('<row/>'.repeat(count)) }, 8)
    expect(readFirstSheet(emptyRows(1_000_000))).toHaveLength(1_000_000)
    expect(() => readFirstSheet(emptyRows(1_000_001))).toThrow('The .xlsx file is too large')
  })

  it('keeps numeric entities beyond U+10FFFF as text', () => {
    const text = '&#x110000;&#1114112;&#x41;'
    const xml = sheet(`<row r="1"><c r="A1" t="inlineStr"><is><t>${text}</t></is></c></row>`)
    const rows = readFirstSheet(zip({ 'xl/worksheets/sheet1.xml': xml }, 0))
    expect(rows).toEqual([['&#x110000;&#1114112;A']])
  })

  it('decodes XML entities once', () => {
    const text = '&amp;&#x41;&#66;&lt;&gt;&quot;&apos;&amp;lt;'
    const xml = sheet(`<row r="1"><c r="A1" t="inlineStr"><is><t>${text}</t></is></c></row>`)
    expect(readFirstSheet(zip({ 'xl/worksheets/sheet1.xml': xml }, 0))).toEqual([['&AB<>"\'&lt;']])
  })

  it('joins the runs of rich inline text', () => {
    const rich = sheet(
      '<row r="1"><c r="A1" t="inlineStr"><is><r><t>Caf</t></r><r><t>é</t></r></is></c></row>'
    )
    expect(readFirstSheet(zip({ 'xl/worksheets/sheet1.xml': rich }, 8))).toEqual([['Café']])
  })

  it.each([
    [
      'unclosed rows',
      {
        'xl/worksheets/sheet1.xml': sheet(
          `<row r="1"><c r="A1"><v>1</v></c></row>${'<row>'.repeat(200_000)}`
        )
      },
      [['1']]
    ],
    [
      'unclosed cells',
      {
        'xl/worksheets/sheet1.xml': sheet(
          `<row r="1"><c r="A1"><v>1</v></c>${'<c r="B1">'.repeat(200_000)}</row>`
        )
      },
      [['1']]
    ],
    [
      'unclosed shared strings',
      {
        'xl/sharedStrings.xml': `<sst>${'<si>'.repeat(200_000)}</sst>`,
        'xl/worksheets/sheet1.xml': sheet(
          '<row r="1"><c r="A1" t="inlineStr"><is><t>x</t></is></c></row>'
        )
      },
      [['x']]
    ],
    [
      'unclosed text runs',
      {
        'xl/sharedStrings.xml': `<sst><si><t>a</t>${'<t>'.repeat(200_000)}</si></sst>`,
        'xl/worksheets/sheet1.xml': sheet('<row r="1"><c r="A1" t="s"><v>0</v></c></row>')
      },
      [['a']]
    ]
  ])('reads %s in linear time, keeping what came before', (_, entries, rows) => {
    const buf = zip(entries, 8)
    const started = performance.now()
    expect(readFirstSheet(buf)).toEqual(rows)
    expect(performance.now() - started).toBeLessThan(1000)
  })

  it('gives no rows for a workbook without sheet1.xml', () => {
    expect(readFirstSheet(zip({ 'xl/sharedStrings.xml': '<sst/>' }, 8))).toEqual([])
  })

  it('rejects a truncated file', () => {
    expect(() => readFirstSheet(zip(workbook, 8).subarray(0, 40))).toThrow('Not a valid .xlsx file')
  })

  it('rejects a central directory offset past the end', () => {
    const buf = zip(workbook, 8)
    buf.writeUInt32LE(buf.length + 100, centralDirectoryOffset(buf))
    expect(() => readFirstSheet(buf)).toThrow('Not a valid .xlsx file')
  })

  it('rejects an entry whose data runs past the end', () => {
    const buf = zip(workbook, 8)
    const firstEntry = buf.readUInt32LE(centralDirectoryOffset(buf))
    buf.writeUInt32LE(buf.length, firstEntry + 20)
    expect(() => readFirstSheet(buf)).toThrow('Not a valid .xlsx file')
  })

  it('rejects an unsupported compression method', () => {
    const buf = zip(workbook, 0)
    const firstEntry = buf.readUInt32LE(centralDirectoryOffset(buf))
    buf.writeUInt16LE(12, firstEntry + 10)
    expect(() => readFirstSheet(buf)).toThrow('Not a valid .xlsx file')
  })

  it('rejects corrupt compressed data', () => {
    const buf = zip(workbook, 8)
    buf[30 + buf.readUInt16LE(26)] = 0xff
    expect(() => readFirstSheet(buf)).toThrow('Not a valid .xlsx file')
  })

  it('stops inflating a part larger than MAX_PART_BYTES', () => {
    const bomb = zip({ 'xl/worksheets/sheet1.xml': '0'.repeat(MAX_PART_BYTES + 1) }, 8)
    expect(() => readFirstSheet(bomb)).toThrow('The .xlsx file is too large')
  })
})

describe('xlsx:importSheet', () => {
  let dir: string

  beforeEach(async () => {
    electron.BrowserWindow.fromWebContents.mockReturnValue({ id: 1 })
    dir = await mkdtemp(join(tmpdir(), 'mynote-xlsx-'))
    registerXlsxIpc()
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('reads the picked workbook, or gives null when cancelled', async () => {
    const file = join(dir, 'export.xlsx')
    await writeFile(file, zip(workbook, 8))
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [file] })
    const rows = await invokeIpc(electron.ipcMain.handle, IPC.xlsx.importSheet)
    expect(rows).toEqual([
      ['Date', 'Amount', 'Note'],
      ['45658', '12.5', 'Café & Bar']
    ])
    expect(electron.dialog.showOpenDialog).toHaveBeenCalledWith(
      { id: 1 },
      { properties: ['openFile'], filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }] }
    )
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] })
    expect(await invokeIpc(electron.ipcMain.handle, IPC.xlsx.importSheet)).toBeNull()
  })
})
