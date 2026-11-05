import { Node, mergeAttributes } from '@tiptap/core'
import type { AnyExtension } from '@tiptap/core'
import { useNotebookStore } from '@renderer/notebook'
import { JUMP_LINK_CLASS, UNTITLED_LABEL } from './linkList'

// Load-only: v0.1.x pages contain it; with the node missing a page would load empty and the next save would erase it
const TemplateLink = Node.create({
  name: 'templateLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      kind: { default: 'page' },
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
        class: JUMP_LINK_CLASS
      }),
      node.attrs.label
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span')
      dom.className = JUMP_LINK_CLASS
      dom.setAttribute('data-template-link', '')
      dom.setAttribute('contenteditable', 'false')
      dom.dataset.kind = node.attrs.kind
      dom.dataset.targetId = node.attrs.targetId
      dom.textContent = node.attrs.label || UNTITLED_LABEL

      // A heading target has no effect: headings carry no id
      dom.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        const { kind, targetId } = node.attrs as { kind: string; targetId: string | null }
        if (kind === 'page' && targetId) {
          useNotebookStore.getState().select({ kind: 'page', id: targetId })
        }
      })

      return { dom }
    }
  }
})

export const legacyNodes: AnyExtension[] = [TemplateLink]
