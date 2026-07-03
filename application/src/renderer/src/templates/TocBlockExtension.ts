import { Node } from '@tiptap/core'
import type { Editor, Range } from '@tiptap/core'

interface HeadingEntry {
  pos: number
  level: number
  text: string
}

/** Scans the current document for headings, in document order. */
function scanHeadings(editor: Editor): HeadingEntry[] {
  const headings: HeadingEntry[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headings.push({ pos, level: node.attrs.level as number, text: node.textContent })
    }
  })
  return headings
}

/**
 * Live, self-updating table of contents (inserted via `/toc`). Stores no
 * snapshot of headings — it's an atom node with no content/attrs of its
 * own. Every time the document changes, its node view re-scans the page
 * for headings and re-renders, so adding, removing, renaming or reordering
 * headings updates the list immediately without needing to re-run `/toc`.
 */
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

      const render = (): void => {
        const headings = scanHeadings(editor)

        dom.innerHTML = ''
        const title = document.createElement('div')
        title.className = 'toc-block-title'
        title.textContent = 'Inhaltsverzeichnis'
        dom.appendChild(title)

        if (headings.length === 0) {
          const empty = document.createElement('div')
          empty.className = 'toc-block-empty'
          empty.textContent = 'Keine Überschriften auf dieser Seite gefunden.'
          dom.appendChild(empty)
          return
        }

        const minLevel = Math.min(...headings.map((h) => h.level))
        const list = document.createElement('ul')
        list.className = 'toc-block-list'
        headings.forEach((heading) => {
          const item = document.createElement('li')
          item.className = 'toc-block-item'
          item.style.marginLeft = `${(heading.level - minLevel) * 1}rem`
          const link = document.createElement('span')
          link.className = 'template-link'
          link.textContent = heading.text || '(ohne Titel)'
          link.addEventListener('click', (event) => {
            event.preventDefault()
            event.stopPropagation()
            const headingDom = editor.view.nodeDOM(heading.pos) as HTMLElement | null
            headingDom?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          })
          item.appendChild(link)
          list.appendChild(item)
        })
        dom.appendChild(list)
      }

      render()

      // Re-render on every document change, not just changes to this node
      // (which never changes itself) — that's what makes the list "live".
      const onUpdate = (): void => render()
      editor.on('update', onUpdate)

      return {
        dom,
        ignoreMutation: () => true,
        destroy: () => {
          editor.off('update', onUpdate)
        }
      }
    }
  }
})

/** Replaces the `/toc` command range with a live table-of-contents block. */
export function insertTableOfContents(editor: Editor, range: Range): void {
  editor.chain().focus().deleteRange(range).insertContent({ type: 'tocBlock' }).run()
}

export default TocBlock
