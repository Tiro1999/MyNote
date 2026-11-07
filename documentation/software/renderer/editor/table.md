# Table block

The table of a text box: the stock TipTap table with hover "+" controls at every boundary and a context menu, and the three rules in its code that are not obvious.

Code paths without a prefix are relative to `application/src/renderer/src`.

## Parts

| Part | File | Role |
|---|---|---|
| `TableWithControls` | [`editor/blocks/table/table.ts`](../../../../application/src/renderer/src/editor/blocks/table/table.ts) | `Table.extend` with a node view; schema, commands and shortcuts are the stock table |
| `tableSlashItem` | same file | `/table` inserts 3×3 cells with a header row |
| `attachBoundaryControls` | [`editor/blocks/table/boundaryControls.ts`](../../../../application/src/renderer/src/editor/blocks/table/boundaryControls.ts) | Places and removes the "+" buttons |
| `table.css` | `editor/blocks/table/` | Table styles and the button look |

`TableKit.configure({ table: false })` in `buildExtensions` supplies the rows, header cells and cells; the table node is this one, registered in `coreBlocks`.

## The target cell

Every command, from a "+" button or from the menu, goes through `runAt(editor, getPos, row, col, command)`. It selects the target cell first, so the command acts on that cell and not on the caret, then runs the command.

- `row` and `col` count slots of the `TableMap`, not DOM children, so merged cells are right.
- The menu finds its cell with `closest('td, th')` and `view.posAtDOM`; `cellCoordinates` (`cellAround`, `findCell`) turns the position into a row and column. A right click outside a cell opens no menu.
- The menu is the shared `ui` context menu (`openContextMenu`, items from `tableMenuItems`): Insert row above, Insert row below, Insert column left, Insert column right, Delete row, Delete column, Delete table. Its host keeps the editor focus.

## Deleting the last row or column

The stock `deleteRow` and `deleteColumn` of prosemirror-tables return false, so nothing happens, when the selection covers every row or every column; a table keeps at least one of each. That is the case for the last row or column. `resolveCommand(command, table)` therefore turns `deleteRow` into `deleteTable` when the `TableMap` has one row, and `deleteColumn` into `deleteTable` when it has one column.

Deleting the last row or column deletes the table.

Known limit: `resolveCommand` checks only the table size (`height <= 1`, `width <= 1`). In a larger table a cell that spans all rows (or all columns) still makes the stock command do nothing.

## Mutations outside the cells (`ignoreMutation`)

The node view's `dom` is a wrapper. The cells live in its `contentDOM`, the `tbody`; the "+" buttons are direct children of the wrapper and are created and removed again and again. The view's `ignoreMutation` returns true for every DOM mutation whose target is outside the `tbody`; selection changes are never ignored.

Without that rule ProseMirror would read the buttons being added and removed as document edits, reconcile them against the document and corrupt the node view, and the table would stop being editable.

## The "+" controls

- One button per row boundary (0 is above the first row, the last is below the last row) in the left gutter, and one per column boundary in the top gutter. `GUTTER` is 9 px, so a button never covers a cell. A column boundary comes from the first row (`columnBoundaries`): each cell's left edge and the last right edge; a cell that spans columns has no inner boundary.
- The buttons are built when the pointer enters the wrapper. A table update re-measures in an animation frame, and only while the wrapper is hovered, so typing elsewhere costs nothing. Until the wrapper is hovered the buttons are invisible and have `pointer-events: none`, so they never swallow a cell click.
- The position is `offsetLeft` and `offsetTop` summed up to the wrapper. The canvas scales its surface with a CSS transform (see [canvas](../canvas/canvas.md)); `getBoundingClientRect` would return scaled values and the buttons would sit off by the zoom factor, offsets do not. The controls therefore work at any zoom and after the text box was resized.
- `insertionAt(axis, boundary, count)` names the command: a boundary before the end inserts before that row or column, the last boundary inserts after the last one. A row insertion targets column 0 of that row, a column insertion row 0.
- A `mousedown` on a button calls `preventDefault`, so the editor keeps its focus.
- Known limit: the offsets ignore the horizontal scroll position of `.tableWrapper`, so a wide table that was scrolled shifts the column buttons.

See also the [feature registry](feature-registry.md) for how the block is registered.
