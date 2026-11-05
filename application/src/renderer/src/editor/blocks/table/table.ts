import { Table } from '@tiptap/extension-table'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { TableMap, cellAround, findCell } from '@tiptap/pm/tables'
import type { Editor, NodeViewRendererProps } from '@tiptap/core'
import { openContextMenu, type ContextMenuItem } from '@renderer/ui'
import type { SlashItem } from '../../feature'
import { attachBoundaryControls, type InsertCommand } from './boundaryControls'
import './table.css'

type GetPos = NodeViewRendererProps['getPos']
type DeleteCommand = 'deleteRow' | 'deleteColumn' | 'deleteTable'
type TableCommand = InsertCommand | DeleteCommand

interface CellCoordinates {
  row: number
  col: number
}

const MENU_ENTRIES: { label: string; command: TableCommand; danger?: boolean }[] = [
  { label: 'Insert row above', command: 'addRowBefore' },
  { label: 'Insert row below', command: 'addRowAfter' },
  { label: 'Insert column left', command: 'addColumnBefore' },
  { label: 'Insert column right', command: 'addColumnAfter' },
  { label: 'Delete row', command: 'deleteRow', danger: true },
  { label: 'Delete column', command: 'deleteColumn', danger: true },
  { label: 'Delete table', command: 'deleteTable', danger: true }
]

export const tableSlashItem: SlashItem = {
  id: 'table',
  title: 'Table',
  description: 'Insert a 3×3 table; extend it with the + buttons at its edges or a right-click',
  icon: '▦',
  keywords: ['table', 'tabelle', 'grid'],
  run: (editor, range) =>
    editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

export function tableMenuItems(run: (command: TableCommand) => void): ContextMenuItem[] {
  return MENU_ENTRIES.map(({ label, command, danger }) => ({ label, danger, onSelect: () => run(command) }))
}

// Row and column of the cell around `pos`, counted in TableMap slots so merged cells are right
export function cellCoordinates(doc: ProseMirrorNode, pos: number): CellCoordinates | null {
  const $cell = cellAround(doc.resolve(pos))
  if (!$cell) return null
  const { top, left } = findCell($cell)
  return { row: top, col: left }
}

// See documentation/software/renderer/editor/table.md
export function resolveCommand(command: TableCommand, table: ProseMirrorNode): TableCommand {
  const { width, height } = TableMap.get(table)
  const isLast = (command === 'deleteRow' && height <= 1) || (command === 'deleteColumn' && width <= 1)
  return isLast ? 'deleteTable' : command
}

function cellPos(table: ProseMirrorNode, tablePos: number, row: number, col: number): number {
  const map = TableMap.get(table)
  const clampedRow = Math.min(row, map.height - 1)
  const clampedCol = Math.min(col, map.width - 1)
  return tablePos + 1 + map.map[clampedRow * map.width + clampedCol]
}

function selectCell(editor: Editor, table: ProseMirrorNode, tablePos: number, row: number, col: number): void {
  const $pos = editor.state.doc.resolve(cellPos(table, tablePos, row, col) + 1)
  const tr = editor.state.tr.setSelection(TextSelection.near($pos)).setMeta('addToHistory', false)
  editor.view.dispatch(tr)
}

// Selects the target cell first, so the command acts on it and not on the caret
function runAt(editor: Editor, getPos: GetPos, row: number, col: number, command: TableCommand): void {
  const tablePos = typeof getPos === 'function' ? getPos() : undefined
  const table = typeof tablePos === 'number' ? editor.state.doc.nodeAt(tablePos) : null
  if (tablePos === undefined || table?.type.name !== 'table') return

  selectCell(editor, table, tablePos, row, col)
  editor.chain().focus()[resolveCommand(command, table)]().run()
}

function showContextMenu(editor: Editor, getPos: GetPos, event: MouseEvent): void {
  if (event.defaultPrevented) return
  const cell = event.target instanceof Element ? event.target.closest('td, th') : null
  const target = cell ? cellCoordinates(editor.state.doc, editor.view.posAtDOM(cell, 0)) : null
  if (!target) return
  event.preventDefault()
  openContextMenu(
    event.clientX,
    event.clientY,
    tableMenuItems((command) => runAt(editor, getPos, target.row, target.col, command))
  )
}

// Table with "+" controls and a context menu; schema, commands and shortcuts are the stock table
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

      const controls = attachBoundaryControls(dom, table, ({ row, col, command }) =>
        runAt(editor, getPos, row, col, command)
      )
      const onContextMenu = (event: MouseEvent): void => showContextMenu(editor, getPos, event)
      dom.addEventListener('contextmenu', onContextMenu)

      return {
        dom,
        contentDOM: tbody,
        // See documentation/software/renderer/editor/table.md
        ignoreMutation: (mutation) =>
          mutation.type !== 'selection' && !tbody.contains(mutation.target as Node),
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'table') return false
          controls.refresh()
          return true
        },
        destroy: () => {
          dom.removeEventListener('contextmenu', onContextMenu)
          controls.destroy()
        }
      }
    }
  }
})
