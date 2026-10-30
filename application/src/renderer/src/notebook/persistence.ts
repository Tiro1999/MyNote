import { ID_PATTERN, describeValue, isRecord, isValidId, readJson, writeJson } from '@renderer/storage'
import type { Notebook, PageMeta, Section } from './model'

export const MANIFEST_PATH = 'notebooks.json'

// The finance data has this top-level folder, so no notebook may take it, in any case
const RESERVED_NOTEBOOK_ID = 'finance'

type Fields = Record<string, unknown>

function fieldsOf(value: unknown, noun: string): Fields {
  if (isRecord(value)) return value
  throw new Error(`Each ${noun} must be an object, got ${describeValue(value)}`)
}

function idOf(fields: Fields, noun: string): string {
  if (isValidId(fields.id)) return fields.id
  throw new Error(`Invalid ${noun} id ${describeValue(fields.id)}: an id must match ${ID_PATTERN.source}`)
}

function textOf(fields: Fields, key: string, where: string): string {
  const value = fields[key]
  if (typeof value === 'string') return value
  throw new Error(`${where}: ${key} must be a string, got ${describeValue(value)}`)
}

// Older versions wrote no list where nothing was in it yet
function listOf(fields: Fields, key: string, where: string): unknown[] {
  const value = fields[key]
  if (value === undefined) return []
  if (Array.isArray(value)) return value
  throw new Error(`${where}: ${key} must be an array, got ${describeValue(value)}`)
}

function checkCollapsed(fields: Fields, where: string): void {
  const value = fields.collapsed
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error(`${where}: collapsed must be true or false, got ${describeValue(value)}`)
  }
}

function parsePage(raw: unknown): PageMeta {
  const fields = fieldsOf(raw, 'page')
  const id = idOf(fields, 'page')
  const where = `Page "${id}"`
  checkCollapsed(fields, where)
  return {
    ...fields,
    id,
    sectionId: textOf(fields, 'sectionId', where),
    title: textOf(fields, 'title', where),
    createdAt: textOf(fields, 'createdAt', where),
    updatedAt: textOf(fields, 'updatedAt', where),
    children: listOf(fields, 'children', where).map(parsePage)
  }
}

function parseSection(raw: unknown): Section {
  const fields = fieldsOf(raw, 'chapter')
  const id = idOf(fields, 'chapter')
  const where = `Chapter "${id}"`
  checkCollapsed(fields, where)
  return {
    ...fields,
    id,
    notebookId: textOf(fields, 'notebookId', where),
    name: textOf(fields, 'name', where),
    color: textOf(fields, 'color', where),
    pages: listOf(fields, 'pages', where).map(parsePage)
  }
}

function parseNotebook(raw: unknown): Notebook {
  const fields = fieldsOf(raw, 'notebook')
  const id = idOf(fields, 'notebook')
  if (id.toLowerCase() === RESERVED_NOTEBOOK_ID) {
    throw new Error(`Notebook id "${id}" is reserved: the folder ${RESERVED_NOTEBOOK_ID}/ holds the finance data`)
  }
  const where = `Notebook "${id}"`
  return {
    ...fields,
    id,
    name: textOf(fields, 'name', where),
    color: textOf(fields, 'color', where),
    sections: listOf(fields, 'sections', where).map(parseSection)
  }
}

// Ids name folders, which ignore case on Windows and macOS, so a repeat in any case is rejected
function checkUnique(notebooks: Notebook[]): void {
  const seen = new Map<string, string>()
  const claim = (noun: string, id: string): void => {
    const key = `${noun}:${id.toLowerCase()}`
    const first = seen.get(key)
    if (first === undefined) {
      seen.set(key, id)
      return
    }
    const clash = first === id ? '' : `: it differs from "${first}" only in case`
    throw new Error(`Duplicate ${noun} id "${id}"${clash}`)
  }
  const claimPages = (pages: PageMeta[]): void =>
    pages.forEach((page) => {
      claim('page', page.id)
      claimPages(page.children)
    })
  for (const notebook of notebooks) {
    claim('notebook', notebook.id)
    for (const section of notebook.sections) {
      claim('chapter', section.id)
      claimPages(section.pages)
    }
  }
}

// Checks ids and field types, backfills missing lists and keeps unknown fields
export function parseNotebooks(raw: unknown): Notebook[] {
  if (!Array.isArray(raw)) throw new Error(`Expected a list of notebooks, got ${describeValue(raw)}`)
  const notebooks = raw.map(parseNotebook)
  checkUnique(notebooks)
  return notebooks
}

// null = no manifest yet; a corrupt one throws CorruptFileError
export function loadNotebooks(): Promise<Notebook[] | null> {
  return readJson(MANIFEST_PATH, parseNotebooks)
}

export function saveNotebooks(nbs: Notebook[]): Promise<void> {
  return writeJson(MANIFEST_PATH, nbs)
}
