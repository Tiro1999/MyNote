import { Node, mergeAttributes } from '@tiptap/core'
import { useNotebookStore } from '@renderer/notebook'

export type TemplateLinkKind = 'heading' | 'page'

export interface TemplateLinkAttrs {
  kind: TemplateLinkKind
  targetId: string
  label: string
}

// Legacy jump link: scrolls to a heading or opens a page, never an external URL
export const TemplateLink = Node.create({
  name: 'templateLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      kind: { default: 'page' as TemplateLinkKind },
      targetId: { default: null },
      label: { default: '' }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-template-link]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-template-link': '',
        'data-kind': node.attrs.kind,
        'data-target-id': node.attrs.targetId,
        class: 'template-link'
      }),
      node.attrs.label
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span')
      dom.className = 'template-link'
      dom.setAttribute('data-template-link', '')
      dom.setAttribute('contenteditable', 'false')
      dom.dataset.kind = node.attrs.kind
      dom.dataset.targetId = node.attrs.targetId
      dom.textContent = node.attrs.label || '(untitled)'

      dom.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        const { kind, targetId } = node.attrs as TemplateLinkAttrs
        if (!targetId) return
        if (kind === 'heading') {
          const container = dom.closest('.tiptap-editor')
          const target = container?.querySelector(`[data-heading-id="${CSS.escape(targetId)}"]`)
          target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else {
          useNotebookStore.getState().select({ kind: 'page', id: targetId })
        }
      })

      return { dom }
    }
  }
})

export default TemplateLink
