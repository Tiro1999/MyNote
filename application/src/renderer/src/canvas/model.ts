import { describeValue, fieldsOf, isRecord, newId } from '@renderer/storage'
import type { Point, Size } from './geometry'

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

// What an edit may change on a text box; the id and the type stay
export type TextBoxPatch = Partial<Omit<TextBoxElement, 'id' | 'type'>>

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
  if (typeof value === 'number' && Number.isFinite(value)) return value
  // JSON text cannot hold Infinity, but 1e999 parses to it, and describeValue would show null
  const shown = typeof value === 'number' ? String(value) : describeValue(value)
  throw new Error(`${where}: ${key} must be a number, got ${shown}`)
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
    content: fieldsOf(fields.content, `${where}: content`)
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

const NEW_BOX_SIZE: Size = { width: 320, height: 200 }

export function newTextBox(position: Point, zIndex: number): TextBoxElement {
  return {
    id: newId(),
    type: 'textbox',
    x: position.x,
    y: position.y,
    ...NEW_BOX_SIZE,
    zIndex,
    content: { type: 'doc', content: [{ type: 'paragraph' }] }
  }
}
