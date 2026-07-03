import Table from '@tiptap/extension-table'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { TableMap } from '@tiptap/pm/tables'
import type { Editor, NodeViewRendererProps } from '@tiptap/core'

/** Resolves the document position of the cell at (row, col) inside the table starting at `tablePos`. */
function cellPos(table: ProseMirrorNode, tablePos: number, row: number, col: number): number {
  const map = TableMap.get(table)
  const clampedRow = Math.min(row, map.height - 1)
  const clampedCol = Math.min(col, map.width - 1)
  const relativePos = map.map[clampedRow * map.width + clampedCol]
  return tablePos + 1 + relativePos
}

/** Moves the editor's selection into the given cell, without creating an undo step of its own. */
function selectCell(editor: Editor, table: ProseMirrorNode, tablePos: number, row: number, col: number): void {
  const pos = cellPos(table, tablePos, row, col)
  const $pos = editor.state.doc.resolve(pos + 1)
  const tr = editor.state.tr.setSelection(TextSelection.near($pos)).setMeta('addToHistory', false)
  editor.view.dispatch(tr)
}

/**
 * Renders floating "+" buttons at every row/column boundary of a table
 * (including after the last row/column), letting the user click between two
 * cells to insert a new row or column right there — instead of using the
 * bubble-menu grip handles prosemirror-tables ships with by default.
 */
function renderControls(
  dom: HTMLElement,
  tbody: HTMLElement,
  editor: Editor,
  getPos: NodeViewRendererProps['getPos']
): void {
  dom.querySelectorAll(':scope > .table-plus-btn').forEach((el) => el.remove())

  const rows = Array.from(tbody.children) as HTMLTableRowElement[]
  if (rows.length === 0) return

  const currentTablePos = (): number | null => {
    const pos = typeof getPos === 'function' ? getPos() : null
    return typeof pos === 'number' ? pos : null
  }

  // One button after each row (including the last), spanning the table's width.
  rows.forEach((rowEl, rowIndex) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'table-plus-btn table-plus-row'
    btn.style.top = `${rowEl.offsetTop + rowEl.offsetHeight - 1}px`
    btn.title = 'Insert row'
    btn.textContent = '+'
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const tablePos = currentTablePos()
      const table = tablePos !== null ? editor.state.doc.nodeAt(tablePos) : null
      if (tablePos === null || !table) return
      selectCell(editor, table, tablePos, rowIndex, 0)
      editor.chain().focus().addRowAfter().run()
    })
    dom.appendChild(btn)
  })

  // One button after each column (including the last), spanning the table's height.
  const firstRowCells = Array.from(rows[0].children) as HTMLElement[]
  firstRowCells.forEach((cellEl, colIndex) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'table-plus-btn table-plus-col'
    btn.style.left = `${cellEl.offsetLeft + cellEl.offsetWidth - 1}px`
    btn.style.height = `${tbody.offsetHeight}px`
    btn.title = 'Insert column'
    btn.textContent = '+'
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const tablePos = currentTablePos()
      const table = tablePos !== null ? editor.state.doc.nodeAt(tablePos) : null
      if (tablePos === null || !table) return
      selectCell(editor, table, tablePos, 0, colIndex)
      editor.chain().focus().addColumnAfter().run()
    })
    dom.appendChild(btn)
  })
}

/**
 * Table node with add-row/add-column "+" controls (Notion/Confluence style).
 * Extends the official @tiptap/extension-table node view only to layer the
 * controls on top — schema, commands and keyboard shortcuts are unchanged.
 */
export const TableWithControls = Table.extend({
  addNodeView() {
    return ({ editor, getPos }: NodeViewRendererProps) => {
      const dom = document.createElement('div')
      dom.className = 'table-plus-wrapper'

      const tableWrapper = document.createElement('div')
      tableWrapper.className = 'tableWrapper'
      dom.appendChild(tableWrapper)

      const table = document.createElement('table')
      tableWrapper.appendChild(table)
      const tbody = document.createElement('tbody')
      table.appendChild(tbody)

      const scheduleRender = (): void => {
        // Wait a tick so the browser has laid out the (just-updated) table
        // before we measure row/cell offsets for control positioning.
        window.requestAnimationFrame(() => renderControls(dom, tbody, editor, getPos))
      }

      scheduleRender()

      return {
        dom,
        contentDOM: tbody,
        ignoreMutation: (mutation) =>
          mutation.type === 'attributes' && mutation.target !== tbody && !tbody.contains(mutation.target as Node),
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'table') return false
          scheduleRender()
          return true
        }
      }
    }
  }
})

export default TableWithControls
