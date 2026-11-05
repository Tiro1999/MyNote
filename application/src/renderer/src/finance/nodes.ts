import { mergeAttributes, Node, type Attribute } from '@tiptap/core'
import type { EditorFeature } from '@renderer/editor'
import { isStringArray } from './model'

// Each attribute travels in one data-* attribute, so copy and paste keeps a block bound to its ledger and settings
const textAttribute = (name: string, htmlName: string): Attribute => ({
  default: '',
  parseHTML: (element) => element.getAttribute(htmlName),
  renderHTML: (attributes) => ({ [htmlName]: attributes[name] })
})

// Anything that is not a list of strings reads as no filter
function parseTagFilter(text: string | null): string[] {
  if (text === null) return []
  try {
    const value: unknown = JSON.parse(text)
    return isStringArray(value) ? value : []
  } catch {
    return []
  }
}

export const FinanceLedgerNode = Node.create({
  name: 'financeLedger',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return { ledgerId: textAttribute('ledgerId', 'data-ledger-id') }
  },

  parseHTML() {
    return [{ tag: 'div[data-finance-ledger]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-finance-ledger': '' })]
  }
})

export const FinanceStatsNode = Node.create({
  name: 'financeStats',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      ledgerId: textAttribute('ledgerId', 'data-ledger-id'),
      mode: { ...textAttribute('mode', 'data-mode'), default: 'overall' },
      from: textAttribute('from', 'data-from'),
      to: textAttribute('to', 'data-to'),
      categoryFocus: textAttribute('categoryFocus', 'data-category-focus'),
      tagFilter: {
        default: [],
        parseHTML: (element) => parseTagFilter(element.getAttribute('data-tag-filter')),
        renderHTML: (attributes) => ({ 'data-tag-filter': JSON.stringify(attributes.tagFilter) })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-finance-stats]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-finance-stats': '' })]
  }
})

const PLACEHOLDER_TEXT = 'Finance module not included in this build'

// A plain DOM view that shows the notice; the block's attributes stay in the node untouched
function placeholderView(marker: string) {
  return () => {
    const dom = document.createElement('div')
    dom.className =
      'my-2 rounded-lg border border-dashed border-gray-300 p-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400'
    dom.setAttribute(marker, '')
    dom.setAttribute('contenteditable', 'false')
    dom.textContent = PLACEHOLDER_TEXT
    return { dom, ignoreMutation: () => true }
  }
}

// Used when finance is left out of the build: pages still load and save with their finance blocks unchanged
export const financePlaceholderFeature: EditorFeature = {
  name: 'finance-placeholder',
  extensions: [
    FinanceLedgerNode.extend({ addNodeView: () => placeholderView('data-finance-ledger') }),
    FinanceStatsNode.extend({ addNodeView: () => placeholderView('data-finance-stats') })
  ],
  slashItems: []
}
