import type { Editor, Range } from '@tiptap/core'
import type { PageMeta } from '../types'
import { useNotebookStore, getPageTreeChildren } from '../store/notebookStore'
import type { TemplateCommandContext } from './types'

/** Recursively converts a page/subpage tree into TipTap JSON: a nested bullet list of page links. */
function pageTreeToContent(pages: PageMeta[]): Record<string, unknown>[] {
  return pages.map((page) => {
    const content: Record<string, unknown>[] = [
      {
        type: 'paragraph',
        content: [
          {
            type: 'templateLink',
            attrs: { kind: 'page', targetId: page.id, label: page.title || 'Untitled Page' }
          }
        ]
      }
    ]
    if (page.children.length > 0) {
      content.push({ type: 'bulletList', content: pageTreeToContent(page.children) })
    }
    return { type: 'listItem', content }
  })
}

/**
 * Replaces the `/subpages` range with a "Page hierarchy" heading followed by
 * a nested bullet list of clickable links — a chapter's pages, or a page's
 * direct subpages, depending on where the command was invoked.
 */
export function insertPageHierarchy(editor: Editor, range: Range, context: TemplateCommandContext): void {
  const { notebooks } = useNotebookStore.getState()
  const pages = getPageTreeChildren(notebooks, context.kind, context.id)

  if (pages.length === 0) {
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertContent('<p><em>Keine Unterseiten gefunden.</em></p>')
      .run()
    return
  }

  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent([
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Seitenhierarchie' }]
      },
      { type: 'bulletList', content: pageTreeToContent(pages) }
    ])
    .run()
}
