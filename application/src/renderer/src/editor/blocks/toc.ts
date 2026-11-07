import { findChildren, Node } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { SlashItem } from '../feature'
import { replaceRangeWith } from './insert'
import { renderLinkListBlock, type LinkListItem } from './linkList'

interface HeadingEntry {
  level: number
  text: string
}

const findHeadings = (doc: ProseMirrorNode): { node: ProseMirrorNode; pos: number }[] =>
  findChildren(doc, (node) => node.type.name === 'heading')

export function headingEntries(doc: ProseMirrorNode): HeadingEntry[] {
  return findHeadings(doc).map(({ node }) => ({ level: node.attrs.level as number, text: node.textContent }))
}

export function sameHeadings(a: HeadingEntry[], b: HeadingEntry[]): boolean {
  return a.length === b.length && a.every((heading, index) => heading.level === b[index].level && heading.text === b[index].text)
}

export function headingLinks(headings: HeadingEntry[], onSelect: (index: number) => void): LinkListItem[] {
  const topLevel = Math.min(...headings.map((heading) => heading.level))
  return headings.map((heading, index) => ({
    label: heading.text,
    depth: heading.level - topLevel,
    onClick: () => onSelect(index)
  }))
}

// The position is looked up on click, so the list does not depend on where the headings sit
function scrollToHeading(editor: Editor, index: number): void {
  const heading = findHeadings(editor.state.doc)[index]
  if (!heading) return
  const dom = editor.view.nodeDOM(heading.pos) as HTMLElement | null
  dom?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Live list of the headings in its own text box; no snapshot is saved
export const TocBlock = Node.create({
  name: 'tocBlock',
  group: 'block',
  atom: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'div[data-toc-block]' }]
  },

  renderHTML() {
    return ['div', { 'data-toc-block': '' }]
  },

  addNodeView() {
    return ({ editor }) => {
      const dom = document.createElement('div')
      dom.className = 'toc-block'
      dom.setAttribute('data-toc-block', '')
      dom.setAttribute('contenteditable', 'false')

      let shown: HeadingEntry[] | null = null
      const refresh = (): void => {
        const headings = headingEntries(editor.state.doc)
        if (shown && sameHeadings(shown, headings)) return
        shown = headings
        renderLinkListBlock(dom, {
          title: 'Table of contents',
          emptyText: 'No headings found in this text box.',
          items: headingLinks(headings, (index) => scrollToHeading(editor, index))
        })
      }

      refresh()
      editor.on('update', refresh)

      return {
        dom,
        ignoreMutation: () => true,
        destroy: () => {
          editor.off('update', refresh)
        }
      }
    }
  }
})

export const tocSlashItem: SlashItem = {
  id: 'table-of-contents',
  title: 'Table of contents',
  description: 'Links all headings of this text box and updates itself',
  icon: '📑',
  keywords: ['toc', 'table of contents', 'inhaltsverzeichnis', 'contents', 'überschriften', 'headings'],
  run: (editor, range) => replaceRangeWith(editor, range, { type: 'tocBlock' })
}
