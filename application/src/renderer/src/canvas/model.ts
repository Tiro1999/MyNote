import { describeValue, isRecord } from '@renderer/storage'

export interface TextBoxElement {
  id: string
  type: 'textbox'
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  // TipTap JSON document
  content: Record<string, unknown>
}

// An element type this version does not render, such as 'image' or 'file' from other branches
export interface ForeignElement {
  id: string
  type: string
  [key: string]: unknown
}

export type CanvasElement = TextBoxElement | ForeignElement

export interface PageContent {
  pageId: string
  elements: CanvasElement[]
}

type Fields = Record<string, unknown>

function numberOf(fields: Fields, key: string, where: string): number {
  const value = fields[key]
  if (typeof value === 'number') return value
  throw new Error(`${where}: ${key} must be a number, got ${describeValue(value)}`)
}

function fieldsOf(fields: Fields, key: string, where: string): Fields {
  const value = fields[key]
  if (isRecord(value)) return value
  throw new Error(`${where}: ${key} must be an object, got ${describeValue(value)}`)
}

function parseTextBox(fields: Fields, id: string): TextBoxElement {
  const where = `Text box "${id}"`
  return {
    ...fields,
    id,
    type: 'textbox',
    x: numberOf(fields, 'x', where),
    y: numberOf(fields, 'y', where),
    width: numberOf(fields, 'width', where),
    height: numberOf(fields, 'height', where),
    zIndex: numberOf(fields, 'zIndex', where),
    content: fieldsOf(fields, 'content', where)
  }
}

function parseElement(raw: unknown): CanvasElement {
  if (!isRecord(raw)) throw new Error(`Each canvas element must be an object, got ${describeValue(raw)}`)
  const { id, type } = raw
  if (typeof id !== 'string') throw new Error(`Canvas element id must be a string, got ${describeValue(id)}`)
  if (typeof type !== 'string') throw new Error(`Element "${id}": type must be a string, got ${describeValue(type)}`)
  return type === 'textbox' ? parseTextBox(raw, id) : { ...raw, id, type }
}

// Checks what rendering relies on, backfills pageId and elements, keeps unknown fields
export function parsePageContent(raw: unknown, pageId: string): PageContent {
  if (!isRecord(raw)) throw new Error(`Page content must be an object, got ${describeValue(raw)}`)
  const { pageId: storedId = pageId, elements = [] } = raw
  if (typeof storedId !== 'string') throw new Error(`pageId must be a string, got ${describeValue(storedId)}`)
  if (!Array.isArray(elements)) throw new Error(`elements must be an array, got ${describeValue(elements)}`)
  return { ...raw, pageId: storedId, elements: elements.map(parseElement) }
}

export function isTextBox(element: CanvasElement): element is TextBoxElement {
  return element.type === 'textbox'
}

export function emptyContent(pageId: string): PageContent {
  return { pageId, elements: [] }
}
