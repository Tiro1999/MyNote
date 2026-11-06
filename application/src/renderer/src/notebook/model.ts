// See documentation/software/renderer/notebook/data-model.drawio.svg
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

export type ContentKind = 'section' | 'page'

/** Points at a chapter note or a page; the store field `selection` holds the open one. */
export interface ContentRef {
  kind: ContentKind
  id: string
}
