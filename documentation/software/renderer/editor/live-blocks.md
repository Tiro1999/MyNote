# Live blocks

Blocks that draw their content from other state instead of storing it: the table of contents and the page hierarchy, plus the callout, which shares the file layout of the block family.

Code paths without a prefix are relative to `application/src/renderer/src`.

## Overview

| | Table of contents | Page hierarchy |
|---|---|---|
| Code | [`editor/blocks/toc.ts`](../../../../application/src/renderer/src/editor/blocks/toc.ts) | [`editor/blocks/pageHierarchy.ts`](../../../../application/src/renderer/src/editor/blocks/pageHierarchy.ts) |
| Node | `tocBlock`, no attrs | `pageHierarchyBlock`, attrs `kind`, `targetId` |
| Reads | the headings of its own text box | the pages below a chapter or page, from `useNotebookStore` |
| Redraws | on an editor `update`, only if the heading list changed | on a store change that replaced `notebooks` |
| Cleanup | `destroy` calls `editor.off('update', …)` | `destroy` calls the `unsubscribe` of the store |
| Slash item | `Table of contents` | `Page hierarchy` |

Both are atoms with `selectable: false` and a plain DOM view (`contenteditable="false"`). They write their own DOM, so the view returns `ignoreMutation: () => true`: ProseMirror must not read those changes back as document edits. No snapshot of the list is saved; reopening a page draws it again.

## Table of contents

- `headingEntries(doc)` lists `{ level, text }` for every heading of the text box. The block draws only the first time and when `sameHeadings` finds the list of levels and texts different, so typing in a paragraph does not rebuild it.
- `headingLinks` indents an entry by its level minus the smallest level number in the list (the top heading). An empty heading shows as "Untitled", an empty list as "No headings found in this text box.".
- A click does not remember a position. `scrollToHeading` looks the heading up by its index in the current document, so a heading that moved still scrolls (smooth, to the top).
- It covers its own text box only, not the whole page.

## Page hierarchy

- Inserted by the slash item, which reads `selection` from the notebook store when it runs and inserts nothing without one. The block keeps only the anchor: a chapter (`kind: 'section'`) or a page and its `targetId`.
- `getPageTreeChildren` returns the pages below the anchor, `pageLinks` flattens them depth first with the depth as indent, and a click calls `select` for that page. An anchor that no longer resolves gives "No subpages found.".
- A tree change replaces the `notebooks` array, and the block subscribes to exactly that, so adding, renaming, deleting, reordering or collapsing a page redraws the list.

## Shared list

Both blocks hand their entries to [`editor/blocks/linkList.ts`](../../../../application/src/renderer/src/editor/blocks/linkList.ts), which owns the DOM:

| Name | Role |
|---|---|
| `LinkListItem` | `{ label, depth, onClick }` |
| `renderLinkList(container, items)` | A flat `ul.link-list`; each entry is an `li.link-list-item` with `margin-left` of `depth` rem that holds a `span.jump-link` (`JUMP_LINK_CLASS`); the click on the span calls `preventDefault`, `stopPropagation`, then `onClick` |
| `renderLinkListBlock(dom, { title, emptyText, items })` | Title plus the list, or the empty text |

An empty label shows as `UNTITLED_LABEL`. The styles are `linkList.css` (`link-list-*`, `jump-link`). The legacy `templateLink` uses the same class (see [feature registry](feature-registry.md)).

## Callout

`Callout` (`editor/blocks/callout.ts`) is not live, but its variant is a stored value that must never crash a view. `parseCalloutVariant` maps anything other than `info`, `note`, `warning` or `error` to `info`, both when pasted HTML is read (`data-callout-variant`) and when a stored value is drawn; the stored value itself is not changed. Four slash items insert it; the caret lands in the new panel's paragraph (`range.from + 2`: one step into the callout, one into the paragraph).
