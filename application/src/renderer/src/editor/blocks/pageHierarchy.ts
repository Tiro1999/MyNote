import { Node, mergeAttributes } from '@tiptap/core'
import { useNotebookStore, getPageTreeChildren, type PageMeta } from '@renderer/notebook'
import type { TemplateCommandContext } from '../feature'
import type { Editor, Range } from '@tiptap/core'

export type PageHierarchyKind = 'section' | 'page'

interface PageHierarchyAttrs {
  kind: PageHierarchyKind
  targetId: string | null
}

/** Recursively builds a nested `<ul>` of clickable page/subpage links. */
function buildPageList(pages: PageMeta[]): HTMLUListElement {
  const list = document.createElement('ul')
  list.className = 'toc-block-list'
  pages.forEach((page) => {
    const item = document.createElement('li')
    item.className = 'toc-block-item'
    const link = document.createElement('span')
    link.className = 'template-link'
    link.textContent = page.title || 'Untitled Page'
    link.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      useNotebookStore.getState().select({ kind: 'page', id: page.id })
    })
    item.appendChild(link)
    if (page.children.length > 0) item.appendChild(buildPageList(page.children))
    list.appendChild(item)
  })
  return list
}

// Live list of a chapter's pages or a page's subpages; re-read from the store on every render
export const PageHierarchyBlock = Node.create({
  name: 'pageHierarchyBlock',
  group: 'block',
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      kind: {
        default: 'section' as PageHierarchyKind,
        parseHTML: (element) =>
          (element.getAttribute('data-kind') as PageHierarchyKind) || 'section',
        renderHTML: (attributes: PageHierarchyAttrs) => ({ 'data-kind': attributes.kind })
      },
      targetId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-target-id'),
        renderHTML: (attributes: PageHierarchyAttrs) => ({ 'data-target-id': attributes.targetId })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-page-hierarchy-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-page-hierarchy-block': '' })]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'page-hierarchy-block'
      dom.setAttribute('data-page-hierarchy-block', '')
      dom.setAttribute('contenteditable', 'false')

      const render = (): void => {
        const { kind, targetId } = node.attrs as PageHierarchyAttrs
        const pages = targetId
          ? getPageTreeChildren(useNotebookStore.getState().notebooks, { kind, id: targetId })
          : []

        dom.innerHTML = ''
        const title = document.createElement('div')
        title.className = 'toc-block-title'
        title.textContent = 'Seitenhierarchie'
        dom.appendChild(title)

        if (pages.length === 0) {
          const empty = document.createElement('div')
          empty.className = 'toc-block-empty'
          empty.textContent = 'Keine Unterseiten gefunden.'
          dom.appendChild(empty)
          return
        }
        dom.appendChild(buildPageList(pages))
      }

      render()

      // Re-render on every tree change, which keeps the list live
      const unsubscribe = useNotebookStore.subscribe((state, prevState) => {
        if (state.notebooks !== prevState.notebooks) render()
      })

      return {
        dom,
        ignoreMutation: () => true,
        destroy: () => {
          unsubscribe()
        }
      }
    }
  }
})

// Replaces the /subpages command range with a block anchored to the open chapter or page
export function insertPageHierarchy(editor: Editor, range: Range, context: TemplateCommandContext): void {
  if (!context.kind || !context.id) {
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
    .insertContent({
      type: 'pageHierarchyBlock',
      attrs: { kind: context.kind, targetId: context.id }
    })
    .run()
}

export default PageHierarchyBlock
