import { mergeAttributes, Node } from '@tiptap/core'
import type { Editor, Range } from '@tiptap/core'
import type { SlashItem } from '../feature'
import { replaceRangeWith } from './insert'
import './callout.css'

export const CALLOUT_VARIANTS = ['info', 'note', 'warning', 'error'] as const
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number]

// Keywords include the German names as search aliases
const VARIANT_META: Record<CalloutVariant, { icon: string; label: string; keywords: string[] }> = {
  info: { icon: 'ℹ️', label: 'Info', keywords: ['info', 'information'] },
  note: { icon: '📝', label: 'Note', keywords: ['note', 'hinweis', 'notiz', 'notice'] },
  warning: { icon: '⚠️', label: 'Warning', keywords: ['warning', 'warnung', 'achtung', 'caution'] },
  error: { icon: '⛔', label: 'Error', keywords: ['error', 'fehler', 'problem', 'danger'] }
}

export function parseCalloutVariant(value: unknown): CalloutVariant {
  return CALLOUT_VARIANTS.find((variant) => variant === value) ?? 'info'
}

// Colored panel with an icon and block content
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
        parseHTML: (element) => parseCalloutVariant(element.getAttribute('data-callout-variant')),
        renderHTML: (attributes: { variant: unknown }) => ({
          'data-callout-variant': parseCalloutVariant(attributes.variant)
        })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const { icon } = VARIANT_META[parseCalloutVariant(node.attrs.variant)]
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'callout' }),
      ['div', { class: 'callout-icon', contenteditable: 'false' }, icon],
      ['div', { class: 'callout-content' }, 0]
    ]
  }
})

// The caret lands in the new panel's paragraph: one step into the callout, one into the paragraph
function insertCallout(editor: Editor, range: Range, variant: CalloutVariant): void {
  replaceRangeWith(editor, range, {
    type: 'callout',
    attrs: { variant },
    content: [{ type: 'paragraph' }]
  })
  editor.chain().focus().setTextSelection(range.from + 2).run()
}

export const calloutSlashItems: SlashItem[] = CALLOUT_VARIANTS.map((variant) => {
  const { icon, label, keywords } = VARIANT_META[variant]
  return {
    id: `callout-${variant}`,
    title: label,
    description: `Insert a callout panel: ${label}`,
    icon,
    keywords,
    run: (editor, range) => insertCallout(editor, range, variant)
  }
})
