import { Table } from '@tiptap/extension-table'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { TableMap } from '@tiptap/pm/tables'
import type { Editor, NodeViewRendererProps } from '@tiptap/core'

type GetPos = NodeViewRendererProps['getPos']

/** Table commands used by the "+" controls and the context menu (all take no arguments). */
type TableCommandName =
  | 'addRowBefore'
  | 'addRowAfter'
  | 'addColumnBefore'
  | 'addColumnAfter'
  | 'deleteRow'
  | 'deleteColumn'
  | 'deleteTable'

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
 * Runs a table command after first moving the selection into the cell at
 * (row, col) — so "insert row above", "delete column", etc. act relative to
 * whichever cell the user targeted (via the "+" controls or the context menu),
 * not wherever the caret happened to be.
 */
function runAt(editor: Editor, getPos: GetPos, row: number, col: number, command: TableCommandName): void {
  const pos = typeof getPos === 'function' ? getPos() : null
  const tablePos = typeof pos === 'number' ? pos : null
  const table = tablePos !== null ? editor.state.doc.nodeAt(tablePos) : null
  if (tablePos === null || !table) return

  // prosemirror-tables refuses to delete the final row/column (a table must
  // keep at least one of each), which would leave a lone leftover row/column
  // behind. When that last one is deleted, remove the whole table instead.
  let effective: TableCommandName = command
  if (command === 'deleteRow' || command === 'deleteColumn') {
    const map = TableMap.get(table)
    if ((command === 'deleteRow' && map.height <= 1) || (command === 'deleteColumn' && map.width <= 1)) {
      effective = 'deleteTable'
    }
  }

  selectCell(editor, table, tablePos, row, col)
  editor.chain().focus()[effective]().run()
}

// ── Context menu ────────────────────────────────────────────────────────────

/** The one context menu that can be open at a time, plus its teardown. */
let activeMenu: { el: HTMLElement; dispose: () => void } | null = null

function closeActiveMenu(): void {
  if (!activeMenu) return
  activeMenu.dispose()
  activeMenu.el.remove()
  activeMenu = null
}

interface MenuItem {
  label: string
  danger?: boolean
  run: () => void
}

/** Finds the (row, col) of the cell containing `target`, by DOM index within `tbody`. */
function cellIndexFromTarget(tbody: HTMLElement, target: EventTarget | null): { row: number; col: number } | null {
  const cell = target instanceof Element ? target.closest('td, th') : null
  if (!cell || !tbody.contains(cell)) return null
  const rowEl = cell.parentElement
  if (!rowEl) return null
  const row = Array.prototype.indexOf.call(tbody.children, rowEl)
  const col = Array.prototype.indexOf.call(rowEl.children, cell)
  if (row < 0 || col < 0) return null
  return { row, col }
}

/** Opens the table context menu at the given viewport coordinates. */
function openContextMenu(clientX: number, clientY: number, items: MenuItem[]): void {
  closeActiveMenu()

  const menu = document.createElement('div')
  menu.className = 'table-context-menu'

  for (const item of items) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'table-context-menu-item' + (item.danger ? ' is-danger' : '')
    btn.textContent = item.label
    // mousedown + preventDefault so the editor keeps focus (the table
    // commands act on its selection); a plain click would blur it first.
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault()
      closeActiveMenu()
      item.run()
    })
    menu.appendChild(btn)
  }

  // Off-screen first so we can measure, then clamp into the viewport.
  menu.style.visibility = 'hidden'
  document.body.appendChild(menu)
  const rect = menu.getBoundingClientRect()
  const x = Math.min(clientX, window.innerWidth - rect.width - 8)
  const y = Math.min(clientY, window.innerHeight - rect.height - 8)
  menu.style.left = `${Math.max(8, x)}px`
  menu.style.top = `${Math.max(8, y)}px`
  menu.style.visibility = 'visible'

  const onPointerDown = (event: MouseEvent): void => {
    if (!menu.contains(event.target as Node)) closeActiveMenu()
  }
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') closeActiveMenu()
  }
  // Capture phase so we dismiss before the click lands elsewhere; `true` on
  // scroll catches scrolling inside any container, not just the window.
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('scroll', closeActiveMenu, true)
  window.addEventListener('blur', closeActiveMenu)

  activeMenu = {
    el: menu,
    dispose: () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', closeActiveMenu, true)
      window.removeEventListener('blur', closeActiveMenu)
    }
  }
}

function showTableContextMenu(
  editor: Editor,
  getPos: GetPos,
  tbody: HTMLElement,
  event: MouseEvent
): void {
  const target = cellIndexFromTarget(tbody, event.target)
  if (!target) return
  event.preventDefault()

  const { row, col } = target
  const items: MenuItem[] = [
    { label: 'Zeile oben einfügen', run: () => runAt(editor, getPos, row, col, 'addRowBefore') },
    { label: 'Zeile unten einfügen', run: () => runAt(editor, getPos, row, col, 'addRowAfter') },
    { label: 'Spalte links einfügen', run: () => runAt(editor, getPos, row, col, 'addColumnBefore') },
    { label: 'Spalte rechts einfügen', run: () => runAt(editor, getPos, row, col, 'addColumnAfter') },
    { label: 'Zeile löschen', danger: true, run: () => runAt(editor, getPos, row, col, 'deleteRow') },
    { label: 'Spalte löschen', danger: true, run: () => runAt(editor, getPos, row, col, 'deleteColumn') },
    { label: 'Tabelle löschen', danger: true, run: () => runAt(editor, getPos, row, col, 'deleteTable') }
  ]
  openContextMenu(event.clientX, event.clientY, items)
}

// ── Hover "+" boundary controls ─────────────────────────────────────────────

/**
 * Renders floating "+" buttons at every row/column boundary of a table
 * (including before the first and after the last), letting the user hover a
 * boundary and click to insert a row/column exactly there. Positions are
 * measured against the wrapper's bounding box so they stay correct regardless
 * of the wrapper's padding.
 */
function renderControls(dom: HTMLElement, tbody: HTMLElement, editor: Editor, getPos: GetPos): void {
  dom.querySelectorAll(':scope > .table-plus-btn').forEach((el) => el.remove())

  const rows = Array.from(tbody.children) as HTMLTableRowElement[]
  const tableEl = tbody.parentElement
  if (rows.length === 0 || !tableEl) return

  const wrapRect = dom.getBoundingClientRect()
  const tableRect = tableEl.getBoundingClientRect()
  const rowCount = rows.length

  const addButton = (
    className: string,
    left: number,
    top: number,
    title: string,
    onInsert: () => void
  ): void => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `table-plus-btn ${className}`
    btn.style.left = `${left}px`
    btn.style.top = `${top}px`
    btn.title = title
    btn.textContent = '+'
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      onInsert()
    })
    dom.appendChild(btn)
  }

  // Row boundaries: one "+" sitting in the left gutter on each boundary line
  // (above row 0, between rows, below the last row). Kept ~9px left of the
  // table edge so the circle never overlaps — and never intercepts clicks
  // into — the first column's cells.
  const rowLeft = tableRect.left - wrapRect.left - 9
  for (let i = 0; i <= rowCount; i++) {
    const boundaryRect = i < rowCount ? rows[i].getBoundingClientRect() : rows[rowCount - 1].getBoundingClientRect()
    const top = (i < rowCount ? boundaryRect.top : boundaryRect.bottom) - wrapRect.top
    const boundary = i
    addButton('table-plus-row', rowLeft, top, 'Zeile einfügen', () => {
      if (boundary < rowCount) runAt(editor, getPos, boundary, 0, 'addRowBefore')
      else runAt(editor, getPos, rowCount - 1, 0, 'addRowAfter')
    })
  }

  // Column boundaries: one "+" in the top gutter on each boundary line,
  // kept ~9px above the table so it doesn't overlap the header cells.
  const firstRowCells = Array.from(rows[0].children) as HTMLElement[]
  const colCount = firstRowCells.length
  const colTop = tableRect.top - wrapRect.top - 9
  for (let j = 0; j <= colCount; j++) {
    const cellRect = j < colCount ? firstRowCells[j].getBoundingClientRect() : firstRowCells[colCount - 1].getBoundingClientRect()
    const left = (j < colCount ? cellRect.left : cellRect.right) - wrapRect.left
    const boundary = j
    addButton('table-plus-col', left, colTop, 'Spalte einfügen', () => {
      if (boundary < colCount) runAt(editor, getPos, 0, boundary, 'addColumnBefore')
      else runAt(editor, getPos, 0, colCount - 1, 'addColumnAfter')
    })
  }
}

/**
 * Table node with add-row/add-column "+" controls (Notion/Confluence style)
 * and a right-click context menu for inserting/deleting rows and columns.
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

      const onContextMenu = (event: MouseEvent): void => showTableContextMenu(editor, getPos, tbody, event)
      dom.addEventListener('contextmenu', onContextMenu)

      const scheduleRender = (): void => {
        // Wait a tick so the browser has laid out the (just-updated) table
        // before we measure row/cell offsets for control positioning.
        window.requestAnimationFrame(() => renderControls(dom, tbody, editor, getPos))
      }

      scheduleRender()

      return {
        dom,
        contentDOM: tbody,
        // Ignore every DOM mutation that isn't inside the cell content (tbody):
        // our "+" buttons are (re)created as direct children of `dom` on each
        // render, and those childList/attribute changes must NOT be reconciled
        // against the document — otherwise ProseMirror corrupts the node view
        // and the table becomes uneditable. Selection changes are never ignored.
        ignoreMutation: (mutation) =>
          mutation.type !== 'selection' && !tbody.contains(mutation.target as Node),
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'table') return false
          scheduleRender()
          return true
        },
        destroy: () => {
          dom.removeEventListener('contextmenu', onContextMenu)
          closeActiveMenu()
        }
      }
    }
  }
})

export default TableWithControls
