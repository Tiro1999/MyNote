export interface Notebook {
  id: string
  name: string
  color: string
  sections: Section[]
}

export interface Section {
  id: string
  notebookId: string
  name: string
  color: string
  /** Collapsed state of this chapter's page tree in the sidebar. */
  collapsed?: boolean
  pages: PageMeta[]
}

export interface PageMeta {
  id: string
  sectionId: string
  title: string
  /** Collapsed state of this page's subpage tree in the sidebar. */
  collapsed?: boolean
  createdAt: string
  updatedAt: string
  /** Nested subpages, recursively collapsible in the sidebar. */
  children: PageMeta[]
}

export type CanvasElementType = 'textbox' | 'image' | 'file'

export interface BaseCanvasElement {
  id: string
  type: CanvasElementType
  x: number
  y: number
  width: number
  height: number
  zIndex: number
}

export interface TextBoxElement extends BaseCanvasElement {
  type: 'textbox'
  /** TipTap ProseMirror JSON document */
  content: Record<string, unknown>
}

export interface ImageElement extends BaseCanvasElement {
  type: 'image'
  /** Relative path inside the page's assets/ folder */
  assetPath: string
  alt: string
}

export interface FileElement extends BaseCanvasElement {
  type: 'file'
  assetPath: string
  fileName: string
}

export type AnyCanvasElement = TextBoxElement | ImageElement | FileElement

export interface PageContent {
  pageId: string
  elements: AnyCanvasElement[]
}
