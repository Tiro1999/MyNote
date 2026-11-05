import { Node, mergeAttributes } from '@tiptap/core'
import { getPageTreeChildren, useNotebookStore, type ContentKind, type PageMeta } from '@renderer/notebook'
import type { SlashItem } from '../feature'
import { replaceRangeWith } from './insert'
import { renderLinkListBlock, type LinkListItem } from './linkList'

interface PageHierarchyAttrs {
  kind: ContentKind
  targetId: string | null
}

export function pageLinks(pages: PageMeta[], openPage: (id: string) => void, depth = 0): LinkListItem[] {
  return pages.flatMap((page) => [
    { label: page.title, depth, onClick: () => openPage(page.id) },
    ...pageLinks(page.children, openPage, depth + 1)
  ])
}

const openPage = (id: string): void => useNotebookStore.getState().select({ kind: 'page', id })

// Live list of a chapter's pages or a page's subpages; re-read from the store on every render
export const PageHierarchyBlock = Node.create({
  name: 'pageHierarchyBlock',
  group: 'block',
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      kind: {
        default: 'section' as ContentKind,
        parseHTML: (element) => (element.getAttribute('data-kind') as ContentKind) || 'section',
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
        renderLinkListBlock(dom, {
          title: 'Page hierarchy',
          emptyText: 'No subpages found.',
          items: pageLinks(pages, openPage)
        })
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

export const pageHierarchySlashItem: SlashItem = {
  id: 'page-hierarchy',
  title: 'Page hierarchy',
  description: 'Lists the subpages of this page or chapter as links and updates itself',
  icon: '🗂️',
  keywords: ['subpages', 'unterseiten', 'seitenhierarchie', 'hierarchy', 'pages', 'seiten'],
  run: (editor, range) => {
    const selection = useNotebookStore.getState().selection
    if (!selection) return
    replaceRangeWith(editor, range, {
      type: 'pageHierarchyBlock',
      attrs: { kind: selection.kind, targetId: selection.id }
    })
  }
}
