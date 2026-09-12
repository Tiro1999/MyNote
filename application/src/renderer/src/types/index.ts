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

/** Where an image's bytes live: a copy in the page's assets/, a pointer to a local
 * original, or a web URL. See docs/superpowers/specs/2026-09-12-image-insert-design.md. */
export type ImageMode = 'copy' | 'link' | 'url'

export interface ImageElement extends BaseCanvasElement {
  type: 'image'
  /** How `src` is read — see ImageMode. */
  mode: ImageMode
  /** Path relative to the page's assets/ (copy), absolute local path (link), or URL. */
  src: string
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
