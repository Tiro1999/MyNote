# UI module

This page describes the shared `ui` module: its public pieces and the rules for dialogs, Escape, focus, menus and toasts that every other module relies on.

`ui` imports no other module. The pieces are in [`application/src/renderer/src/ui`](../../../application/src/renderer/src/ui) and used through the barrel `@renderer/ui`.

## Public pieces

| Piece | What it is |
|---|---|
| `Modal` | dialog with a title, content and an optional footer; sizes `sm`, `md`, `lg` |
| `ConfirmDialog` | `Modal` with a message and Cancel / confirm buttons; `danger` colours the confirm button, `busy` locks the dialog |
| `TextInputDialog` | `Modal` with one trimmed text input; confirm stays off while the text is empty or `onConfirm` runs |
| `buttonClass` | the looks `primary`, `secondary`, `danger`, `ghost` |
| `openContextMenu`, `closeContextMenu`, `ContextMenuHost`, `clampToViewport` | one context menu at a time |
| `notify`, `Toaster` | short messages at the bottom of the window |
| `usePointerDrag` | drag with pointer capture |

Not exported: `pushEscapeHandler` (`escapeStack.ts`, used by `Modal`), `startPointerDrag` (behind the hook), `dismissToast` and the two stores (`useContextMenuStore`, `useToastStore`). The Escape stack is a plain array in `escapeStack.ts`. `App` mounts `ContextMenuHost` and `Toaster` once.

## Dialogs and Escape

- A dialog is rendered into `document.body` and mounted only while it is open.
- **Escape.** Each `Modal` pushes one entry on a stack (`pushEscapeHandler`, once on mount) and listens for `keydown` on `window` in the capture phase. Only the topmost entry reacts, wherever the focus is: a disabled control that drops the focus to `body` does not stop it. An auto-repeated key (`KeyboardEvent.repeat`) is ignored, so a held Escape closes one dialog and not the stack.
- **Backdrop.** A click closes the dialog only if the press also started on the backdrop, so a text selection that ends outside the panel does not close it. A press on the backdrop keeps the focus where it was.
- **`busy`.** `ConfirmDialog` passes an `onClose` that does nothing while `busy` is set, so Escape and a backdrop click are ignored, and both buttons are disabled. `TextInputDialog` has no such state.
- **Stopped events.** React events bubble through a portal along the React tree, into the canvas and the node views behind the dialog. The modal therefore stops `pointerdown`, `mousedown`, `click`, `dblclick`, `contextmenu`, `keydown` and `wheel` at its root, so the opener never sees them.
- **Focus.** When a dialog opens, its panel gets the focus unless the focus is already inside (for example the `autoFocus` input of `TextInputDialog`). The dialog neither traps Tab nor gives the focus back when it closes.

## Context menu

- Opened at a point with a list of `{ label, onSelect, danger?, disabled? }`; moved into the window with an 8 px margin (`clampToViewport`).
- It closes on a `pointerdown` outside, on Escape, on any scroll and when the window loses focus. The listeners run in the capture phase, so a handler that stops an event cannot keep the menu open. The Escape listener is independent of the dialog stack.
- A `mousedown` on the menu is prevented, so the focus stays where it was (an editor keeps its selection for the command). The menu closes before `onSelect` runs.
- Used by the sidebar and by the table block.

## Toasts

`notify(message, kind)` with `info` (default) or `error`. An `info` toast disappears after 4 seconds; an `error` toast stays until the user dismisses it with the ✕ button and has `role="alert"`. A message equal in text and kind to a toast still shown is dropped.

## Pointer drag

`usePointerDrag(onMove, onEnd)` returns a pointerdown handler. It captures the pointer on the element whose handler received the event and reports CSS-pixel deltas since that pointerdown; a caller with a zoom divides them by it ([canvas](canvas/canvas.md)). The drag ends on `pointerup`, `pointercancel` or `lostpointercapture`, so a release outside the window ends it too. `onMove` and `onEnd` are those of the render in which the drag started.

## Why `window.confirm` is banned

`confirm`, `alert` and `prompt` block the renderer while they are open and ignore the rules above (Escape stack, `busy`, stopped events). `application/eslint.config.js` rejects them in the renderer with the message to use `ConfirmDialog`, `Modal` or `notify`. See [architecture](../architecture.md).
