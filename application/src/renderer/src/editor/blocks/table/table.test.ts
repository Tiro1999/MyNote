import { getSchema, type JSONContent } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { describe, expect, it, vi } from 'vitest'
import { buildExtensions } from '../../extensions'
import { coreBlocks } from '..'
import { columnBoundaries, insertionAt } from './boundaryControls'
import { cellCoordinates, resolveCommand, tableMenuItems, tableSlashItem } from './table'

const schema = getSchema(buildExtensions([coreBlocks]))

const cellJson = (type: 'tableCell' | 'tableHeader', text: string, attrs: object = {}): JSONContent => ({
  type,
  attrs: { colspan: 1, rowspan: 1, colwidth: null, ...attrs },
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
})
const row = (...cells: JSONContent[]): JSONContent => ({ type: 'tableRow', content: cells })
const tableDoc = (...rows: JSONContent[]): ProseMirrorNode =>
  schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: rows }] })

function cellStarts(doc: ProseMirrorNode): Map<string, number> {
  const starts = new Map<string, number>()
  doc.descendants((node, pos) => {
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') starts.set(node.textContent, pos + 1)
  })
  return starts
}

describe('cellCoordinates', () => {
  it('counts a cell after a column span by its table column, not by its place in the row', () => {
    const doc = tableDoc(
      row(cellJson('tableCell', 'A', { colspan: 2 }), cellJson('tableCell', 'B')),
      row(cellJson('tableCell', 'C'), cellJson('tableCell', 'D'), cellJson('tableCell', 'E'))
    )
    const at = cellStarts(doc)
    expect(cellCoordinates(doc, at.get('A') as number)).toEqual({ row: 0, col: 0 })
    expect(cellCoordinates(doc, at.get('B') as number)).toEqual({ row: 0, col: 2 })
    expect(cellCoordinates(doc, at.get('D') as number)).toEqual({ row: 1, col: 1 })
    expect(cellCoordinates(doc, at.get('E') as number)).toEqual({ row: 1, col: 2 })
  })

  it('skips the slot a row span still covers', () => {
    const doc = tableDoc(
      row(cellJson('tableHeader', 'A', { rowspan: 2 }), cellJson('tableHeader', 'B')),
      row(cellJson('tableCell', 'C'))
    )
    const at = cellStarts(doc)
    expect(cellCoordinates(doc, at.get('C') as number)).toEqual({ row: 1, col: 1 })
  })

  it('finds the cell from a position deeper inside it', () => {
    const doc = tableDoc(row(cellJson('tableCell', 'A'), cellJson('tableCell', 'B')))
    const at = cellStarts(doc)
    expect(cellCoordinates(doc, (at.get('B') as number) + 2)).toEqual({ row: 0, col: 1 })
  })

  it('finds no cell outside a table', () => {
    const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'paragraph' }] })
    expect(cellCoordinates(doc, 1)).toBeNull()
  })
})

describe('resolveCommand', () => {
  const oneRow = tableDoc(row(cellJson('tableCell', 'A'), cellJson('tableCell', 'B'))).firstChild as ProseMirrorNode
  const oneColumn = tableDoc(row(cellJson('tableCell', 'A')), row(cellJson('tableCell', 'B'))).firstChild as ProseMirrorNode

  it('turns the deletion of the last row or column into deleting the table', () => {
    expect(resolveCommand('deleteRow', oneRow)).toBe('deleteTable')
    expect(resolveCommand('deleteColumn', oneColumn)).toBe('deleteTable')
  })

  it('keeps a deletion that leaves a row or column behind', () => {
    expect(resolveCommand('deleteRow', oneColumn)).toBe('deleteRow')
    expect(resolveCommand('deleteColumn', oneRow)).toBe('deleteColumn')
  })

  it('keeps every other command', () => {
    expect(resolveCommand('addRowBefore', oneRow)).toBe('addRowBefore')
    expect(resolveCommand('deleteTable', oneRow)).toBe('deleteTable')
  })
})

describe('insertionAt', () => {
  it('inserts a row before the row below the boundary, or after the last row', () => {
    expect(insertionAt('row', 0, 3)).toEqual({ row: 0, col: 0, command: 'addRowBefore' })
    expect(insertionAt('row', 2, 3)).toEqual({ row: 2, col: 0, command: 'addRowBefore' })
    expect(insertionAt('row', 3, 3)).toEqual({ row: 2, col: 0, command: 'addRowAfter' })
  })

  it('inserts a column before the column right of the boundary, or after the last column', () => {
    expect(insertionAt('column', 0, 4)).toEqual({ row: 0, col: 0, command: 'addColumnBefore' })
    expect(insertionAt('column', 4, 4)).toEqual({ row: 0, col: 3, command: 'addColumnAfter' })
  })
})

describe('columnBoundaries', () => {
  it('has a boundary at every cell edge when no cell spans columns', () => {
    const result = columnBoundaries([
      { left: 0, width: 50, span: 1 },
      { left: 50, width: 50, span: 1 },
      { left: 100, width: 50, span: 1 }
    ])
    expect(result.count).toBe(3)
    expect(result.boundaries).toEqual([
      { boundary: 0, left: 0 },
      { boundary: 1, left: 50 },
      { boundary: 2, left: 100 },
      { boundary: 3, left: 150 }
    ])
  })

  it('gives a spanning cell no inner boundary, only its left edge and the next boundary', () => {
    const result = columnBoundaries([
      { left: 0, width: 100, span: 2 },
      { left: 100, width: 50, span: 1 }
    ])
    expect(result.count).toBe(3)
    expect(result.boundaries).toEqual([
      { boundary: 0, left: 0 },
      { boundary: 2, left: 100 },
      { boundary: 3, left: 150 }
    ])
  })

  it('ends with the right edge of a spanning last cell', () => {
    const result = columnBoundaries([
      { left: 0, width: 50, span: 1 },
      { left: 50, width: 100, span: 3 }
    ])
    expect(result.count).toBe(4)
    expect(result.boundaries.map((b) => b.boundary)).toEqual([0, 1, 4])
    expect(result.boundaries[2].left).toBe(150)
  })

  it('has no boundary for a row without cells', () => {
    expect(columnBoundaries([])).toEqual({ count: 0, boundaries: [] })
  })
})

describe('tableMenuItems', () => {
  it('has English labels, and only the three deletions are dangerous', () => {
    const items = tableMenuItems(vi.fn())
    expect(items.map((item) => item.label)).toEqual([
      'Insert row above',
      'Insert row below',
      'Insert column left',
      'Insert column right',
      'Delete row',
      'Delete column',
      'Delete table'
    ])
    expect(items.map((item) => Boolean(item.danger))).toEqual([false, false, false, false, true, true, true])
  })

  it('runs the command of every entry, in menu order', () => {
    const run = vi.fn()
    for (const item of tableMenuItems(run)) item.onSelect()
    expect(run.mock.calls).toEqual([
      ['addRowBefore'],
      ['addRowAfter'],
      ['addColumnBefore'],
      ['addColumnAfter'],
      ['deleteRow'],
      ['deleteColumn'],
      ['deleteTable']
    ])
  })

  it('pairs each label with its command', () => {
    const commands: string[] = []
    const items = tableMenuItems((command) => commands.push(command))
    const pairs = items.map((item) => {
      commands.length = 0
      item.onSelect()
      return [item.label, ...commands]
    })
    expect(pairs).toEqual([
      ['Insert row above', 'addRowBefore'],
      ['Insert row below', 'addRowAfter'],
      ['Insert column left', 'addColumnBefore'],
      ['Insert column right', 'addColumnAfter'],
      ['Delete row', 'deleteRow'],
      ['Delete column', 'deleteColumn'],
      ['Delete table', 'deleteTable']
    ])
  })
})

describe('tableSlashItem', () => {
  it('keeps its id and the search keywords', () => {
    expect(tableSlashItem.id).toBe('table')
    expect(tableSlashItem.title).toBe('Table')
    expect(tableSlashItem.keywords).toEqual(['table', 'tabelle', 'grid'])
  })
})
