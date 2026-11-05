export type InsertCommand = 'addRowBefore' | 'addRowAfter' | 'addColumnBefore' | 'addColumnAfter'

export interface Insertion {
  row: number
  col: number
  command: InsertCommand
}

type Axis = 'row' | 'column'

const GUTTER = 9

// A boundary is a line between two rows or columns, numbered 0 (before the first) to `count` (after the last)
export function insertionAt(axis: Axis, boundary: number, count: number): Insertion {
  const before = boundary < count
  if (axis === 'row') {
    return before
      ? { row: boundary, col: 0, command: 'addRowBefore' }
      : { row: count - 1, col: 0, command: 'addRowAfter' }
  }
  return before
    ? { row: 0, col: boundary, command: 'addColumnBefore' }
    : { row: 0, col: count - 1, command: 'addColumnAfter' }
}

// Sums the offsets up to `ancestor`, so the canvas zoom (a CSS transform) does not change the result
function offsetWithin(element: HTMLElement, ancestor: HTMLElement): { left: number; top: number } {
  let left = 0
  let top = 0
  let node: HTMLElement | null = element
  while (node && node !== ancestor) {
    left += node.offsetLeft
    top += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return { left, top }
}

interface MeasuredCell {
  left: number
  width: number
  span: number
}

// Boundaries of the first row: each cell's left edge and the last right edge; a spanning cell has no inner boundary
export function columnBoundaries(cells: MeasuredCell[]): { count: number; boundaries: { boundary: number; left: number }[] } {
  const boundaries: { boundary: number; left: number }[] = []
  let column = 0
  for (const cell of cells) {
    boundaries.push({ boundary: column, left: cell.left })
    column += Math.max(cell.span, 1)
  }
  const last = cells[cells.length - 1]
  if (last) boundaries.push({ boundary: column, left: last.left + last.width })
  return { count: column, boundaries }
}

function measureColumns(firstRow: HTMLTableRowElement, wrapper: HTMLElement): ReturnType<typeof columnBoundaries> {
  return columnBoundaries(
    Array.from(firstRow.cells).map((cell) => ({
      left: offsetWithin(cell, wrapper).left,
      width: cell.offsetWidth,
      span: cell.colSpan
    }))
  )
}

// Top edge of every row boundary, the bottom of the last row included
function rowEdges(rows: HTMLTableRowElement[], wrapper: HTMLElement): number[] {
  const edges = rows.map((row) => offsetWithin(row, wrapper).top)
  const last = rows[rows.length - 1]
  edges.push(offsetWithin(last, wrapper).top + last.offsetHeight)
  return edges
}

interface BoundaryControls {
  refresh(): void
  destroy(): void
}

export function attachBoundaryControls(
  wrapper: HTMLElement,
  table: HTMLTableElement,
  onInsert: (insertion: Insertion) => void
): BoundaryControls {
  let buttons: HTMLButtonElement[] = []
  let frame = 0

  const addButton = (className: string, left: number, top: number, title: string, insertion: Insertion): void => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `table-plus-btn ${className}`
    button.style.left = `${left}px`
    button.style.top = `${top}px`
    button.title = title
    button.textContent = '+'
    button.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      onInsert(insertion)
    })
    wrapper.appendChild(button)
    buttons.push(button)
  }

  const place = (): void => {
    buttons.forEach((button) => button.remove())
    buttons = []
    const rows = Array.from(table.rows)
    if (rows.length === 0) return

    const origin = offsetWithin(table, wrapper)
    const rowTops = rowEdges(rows, wrapper)
    rowTops.forEach((top, boundary) =>
      addButton('table-plus-row', origin.left - GUTTER, top, 'Insert row', insertionAt('row', boundary, rows.length))
    )
    const columns = measureColumns(rows[0], wrapper)
    columns.boundaries.forEach(({ boundary, left }) =>
      addButton(
        'table-plus-col',
        left,
        origin.top - GUTTER,
        'Insert column',
        insertionAt('column', boundary, columns.count)
      )
    )
  }

  const refresh = (): void => {
    if (!wrapper.matches(':hover')) return
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(place)
  }

  wrapper.addEventListener('mouseenter', place)

  return {
    refresh,
    destroy: () => {
      cancelAnimationFrame(frame)
      wrapper.removeEventListener('mouseenter', place)
      buttons.forEach((button) => button.remove())
    }
  }
}
