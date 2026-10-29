import { mergeAttributes, Node } from '@tiptap/core'
import type { Editor, Range } from '@tiptap/core'

export type CalloutVariant = 'info' | 'note' | 'warning' | 'error'

/** Icon + accessible label shown for each callout variant, keyed by variant id. */
export const CALLOUT_META: Record<CalloutVariant, { icon: string; label: string }> = {
  info: { icon: 'ℹ️', label: 'Info' },
  note: { icon: '📝', label: 'Hinweis' },
  warning: { icon: '⚠️', label: 'Warnung' },
  error: { icon: '⛔', label: 'Fehler' }
}

/**
 * A Confluence/Jira-style callout panel: a colored box containing an icon
 * and arbitrary block content. Inserted via the `/info`, `/hinweis`,
 * `/warnung` and `/fehler` slash commands.
 */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      variant: {
        default: 'info' as CalloutVariant,
        parseHTML: (element) =>
          (element.getAttribute('data-callout-variant') as CalloutVariant) || 'info',
        renderHTML: (attributes: { variant: CalloutVariant }) => ({
          'data-callout-variant': attributes.variant
        })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const variant = (node.attrs.variant as CalloutVariant) || 'info'
    const meta = CALLOUT_META[variant]
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'callout' }),
      ['div', { class: 'callout-icon', contenteditable: 'false' }, meta.icon],
      ['div', { class: 'callout-content' }, 0]
    ]
  }
})

/**
 * Replaces the `/command` range with an empty callout panel and places the
 * cursor inside it. `range.from` is captured before `deleteRange` collapses
 * the selection, so `from + 2` lands inside the callout's first paragraph
 * (+1 to enter the callout node, +1 to enter the paragraph).
 */
export function insertCallout(editor: Editor, range: Range, variant: CalloutVariant): void {
  const { from } = range
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent({
      type: 'callout',
      attrs: { variant },
      content: [{ type: 'paragraph' }]
    })
    .run()
  editor.chain().focus().setTextSelection(from + 2).run()
}

export default Callout
