# Glossary

Binding for code, comments and docs (`.claude/rules/core.md` §3). Persisted names are the on-disk truth and never change; unclear names get a `NAMING-CHECK` marker.

## Notebook structure

| Term (UI) | Code | Files / persisted | Notes |
|---|---|---|---|
| Notebook | `Notebook` | `notebooks.json` (array of notebooks); folder `<notebookId>/` | Top level. Fields `id`, `name`, `color`, `sections`. |
| Manifest | `MANIFEST_PATH`, `parseNotebooks`, `loadNotebooks`, `saveNotebooks` (`notebook`) | `notebooks.json` | The whole notebook tree in one file; every tree change rewrites all of it. Loading checks ids and field types, fills missing `sections`, `pages` and `children` with `[]` and keeps unknown fields. A repeated notebook, chapter or page id is rejected, compared without case; the notebook id `finance` is reserved, in any case, because that folder holds the finance data. A failed check makes it a corrupt file. |
| Chapter | `Section` | `sections` (in a notebook), `sectionId` (in a page); folder `<notebookId>/<sectionId>/` | UI says Chapter, code and files say section. Avoid: Section in UI text. |
| Page | `PageMeta` | `pages` (in a chapter); `<notebookId>/<sectionId>/<pageId>/page.json` | Tree entry only; the content is in `page.json`, written first by the page's first content save. |
| Subpage | `PageMeta` | `children` (recursive); folder inside the parent page folder | Same type as a page; its `sectionId` stays the chapter id. |
| Collapsed state | `collapsed` | `collapsed` on chapter and page (optional) | Sidebar fold state, saved in `notebooks.json`. |
| Chapter note | `ContentRef` with `kind: 'section'` | `<notebookId>/<sectionId>/page.json` | The canvas a chapter holds itself. Its persisted `pageId` is the section id. |
| Content ref | `ContentRef { kind, id }`, `ContentKind`, `contentPath`, `resolves` | not persisted | `ContentKind` is `'section'` or `'page'`. Points at the open chapter note or page (store field `selection`); a tree change clears a selection that no longer resolves in the same store update. Avoid: `activeContentKind`, `activeContentId`, `activeSectionId`. |
| Notebook folder | `dataRoot`, `openFolder`, `openError` | folder that holds `notebooks.json` | UI "Notebook Folder"; renderer `dataRoot`; main "data root", set only by the folder dialog. A folder without a manifest opens empty; a corrupt manifest sets `openError`, keeps `dataRoot` null and writes nothing. |
| Id | `ID_PATTERN`, `isValidId`, `newId` | `id`, `sectionId`, `ledgerId` (also folder and file names) | Must match `/^[A-Za-z0-9_-]{1,64}$/` wherever it becomes a path segment. Folder names ignore case on Windows and macOS, so two ids that differ only in case count as the same id. |

## Canvas and editor

| Term (UI) | Code | Files / persisted | Notes |
|---|---|---|---|
| Canvas | `CanvasView` | `page.json`: `pageId`, `elements` (`PageContent`) | Free-form surface of one chapter note or page. Pan and zoom are not saved. It draws the text boxes only and shows "Double-click anywhere to add a text box" only when the page has no element at all (not while loading, not when it holds only foreign elements); a load error replaces it with red text. |
| Page content | `PageContent`, `parsePageContent`, `emptyContent` (`canvas`) | `page.json`: `pageId`, `elements` | Loading checks what rendering relies on: `elements` is a list, each element has a string `id` and `type`, a text box has finite numeric `x`, `y`, `width`, `height`, `zIndex` and an object `content`. It fills a missing `elements` with `[]` and a missing `pageId` with the content id, and keeps unknown fields on the page and on each element; a failed check makes it a corrupt file. |
| Content store | `useContentStore`, `startContentSync`, `flushContent`, `SAVE_DELAY_MS` (`canvas`) | `page.json` of the selection | Holds the open content (`ref`, `path`, `content`, `error`) and follows a changed `selection`, not a change of the tree alone; a load overtaken by a later selection is dropped. Selecting the open content again reloads it only after a failed load. A missing file opens empty and is created by its first save; a corrupt one sets `error`, keeps `content` null and is never saved. A save goes to the path loaded with its content: `addElement` and `deleteElement` at once, `commitElement` 400 ms after the last commit, `updateElement` never. An id that no text box has changes and saves nothing. A switch sends the pending save at once, or drops it when the old content was deleted. On window close the pending save is sent, and the close waits while text is still queued behind an in-flight write; a second close during that wait passes, so a stalled write cannot trap the window. |
| Canvas element | `CanvasElement` | `elements[]`: `id`, `type`, `x`, `y`, `width`, `height`, `zIndex` | `TextBoxElement` or `ForeignElement`. Avoid: `AnyCanvasElement`, `ImageElement`, `FileElement`. |
| Text box | `TextBoxElement`, `TextBox`, `newTextBox` | `type: 'textbox'`, `content` (TipTap JSON) | One TipTap editor per text box. A double-click on the empty canvas creates one (320 x 200, `zIndex` = highest + 1) at the pointer. It is edited while focused; a click focuses it and a click elsewhere ends that. |
| Foreign element | `ForeignElement` | `elements[]` entry with another `type` (`image`, `file`) | Kept and saved, never rendered. |
| Viewport | `Viewport { panX, panY, zoom }`, `useViewport`, `DEFAULT_VIEWPORT` (`canvas`) | not persisted | Pan (screen pixels) and zoom of one canvas. The surface is drawn at `translate(panX, panY) scale(zoom)`, so a point relative to the top-left corner of the canvas maps to the canvas by `(point - pan) / zoom`. Starts at pan 40, 40 and zoom 1; Reset returns there. Zoom runs from 0.2 to 3 and is not anchored at the pointer. |
| Canvas gestures | `wheelAction`, `wheelUpdate`, `isPanGesture` (`canvas`) | – | The wheel on the empty canvas pans; Ctrl or Meta + wheel zooms, also over a text box; the plain wheel over a text box scrolls that box. Alt + left drag and middle drag pan. A double-click creates a text box only on the empty surface, not on a box, the minimap or the zoom controls. |
| Canvas geometry | `geometry.ts` (`canvas`) | – | Pure coordinate maths without React: `screenToCanvas`, `visibleRect`, `intersects`, `cull`, `movedBox`, `resizedBox`, `contentBounds`, `minimapTransform`, `nextZIndex`. A `Rect` is `{ x, y, width, height }` in canvas units; the `margin` of `visibleRect` is a share of the visible size. |
| Culling | `cull`, `CULL_MARGIN` (`canvas`) | – | Only text boxes within half a screen of the visible area are mounted (touching counts); the focused box always is. Avoid: virtualization. |
| Drag and resize | `usePointerDrag` (`ui`), `movedBox`, `resizedBox`, `dragOffset`, `DRAG_THRESHOLD`, `TextBoxPatch` | `x`, `y`, `width`, `height` of the element | A press on an unfocused box turns into a drag after 3 px, so a plain click still reaches the buttons and links inside a block; `dragOffset` gives the way from the press to the first move past 3 px, which the drag adds to its deltas, so the box stays under the pointer from the press on. Screen deltas are divided by the zoom; the minimum size is 120 x 60. `updateElement` follows the pointer without saving, `commitElement` runs once on pointer up. A box with unreadable content moves and resizes but keeps its stored `content`. |
| Minimap | `Minimap`, `minimapTransform`, `toMinimap`, `fromMinimap` (`canvas`) | – | 180 x 120 overview of the text boxes and the visible area, with 60 units of padding. A click or drag recenters the canvas; its bounds are frozen while it is dragged, so the map stands still. |
| Zoom controls | `ZoomControls`, `stepZoom` (`canvas`) | – | Buttons − and +, which step the zoom by 0.1, the percentage and Reset. |
| Block | `editor/blocks/`, `coreBlocks` | node types in a text box's `content` | A TipTap node in group `block`. Avoid: template (old folder `templates/`). |
| Live block | `tocBlock`, `pageHierarchyBlock` | see the next two rows | Atom block whose list is computed on render; no snapshot is saved. |
| Table of contents | `tocBlock` | node `tocBlock`, no attrs | Live list of the headings in its own text box. It rebuilds only when the list of heading levels and texts changes; a click looks the heading up again, so a moved heading still scrolls. German: Inhaltsverzeichnis. |
| Page hierarchy | `pageHierarchyBlock` | node `pageHierarchyBlock`: `kind`, `targetId` | Live list of a chapter's pages or a page's subpages. German: Seitenhierarchie. |
| Callout | `callout`, `CALLOUT_VARIANTS`, `parseCalloutVariant` | node `callout`, attr `variant` | Variants `info`, `note`, `warning`, `error`, labelled Info, Note, Warning, Error. `parseCalloutVariant` turns anything else into `info`, when pasted HTML is read and when a stored value is drawn; the stored value is not changed. German: Hinweis, Warnung, Fehler. |
| Table | `table`, `TableWithControls`, `attachBoundaryControls`, `insertionAt`, `cellCoordinates` | nodes `table`, `tableRow`, `tableHeader`, `tableCell` | TipTap table with hover "+" controls at every row and column boundary and a context menu (`openContextMenu`). The controls are placed with `offsetLeft`/`offsetTop` when the pointer enters the table, so the canvas zoom does not matter. The target cell of a command is found with `posAtDOM` and `TableMap`, so merged cells count right. Deleting the last row or column deletes the table. |
| Slash command | `SlashCommand`, `SlashMenu` | – | The `/` menu in a text box. Suggestion mounts and positions `SlashMenu` (`props.mount`, Floating UI); `onExit` is the only place that removes it. Avoid: backslash command. |
| Slash item | `SlashItem`, `filterSlashItems` | – | One entry of the slash menu; `run(editor, range)` replaces the command range, mostly through `replaceRangeWith`. Each block file exports its items next to its node. Avoid: `TemplateCommand`, `getTemplateCommands`. |
| Editor feature | `EditorFeature`, `editorFeatures` | – | Adds extensions and slash items; a fixed list (`coreBlocks`, `financeFeature`), not a plugin system. `app/editorFeatures.ts` lists them and reaches each text box through `ContentArea`, `CanvasView` and `TextBox` as the prop `features`; `buildExtensions(features)` builds the extension list. `finance/feature.ts` is the only place where the editor and finance meet. |
| Jump link | `renderLinkList`, `JUMP_LINK_CLASS` (CSS `jump-link`) | – | Entry of a live block that scrolls to a heading or opens a page. Not a hyperlink. Avoid: template link. |
| Link list | `renderLinkList`, `renderLinkListBlock`, `LinkListItem`, `UNTITLED_LABEL` (CSS `link-list-*`) | – | The list DOM that both live blocks share: items of `label`, `depth` and `onClick`; an empty label shows as Untitled. Avoid: `toc-block-*`. |
| Hyperlink | `LinkPopover`, `applyLinkInput`, `allowedLinkUrl`, `isAllowedExternalUrl`, `normalizeLinkInput` (`@shared/links`) | mark `link`, attr `href` | Link to an external URL; only `http:`, `https:`, `mailto:` open. A URL with whitespace, a control character or a backslash anywhere is rejected (the URL parser silently drops tabs and newlines and reads a backslash as a slash, so the dialog would show another address than the one that opens), and so is a path that starts with `/` or `\`. `allowedLinkUrl(input)` is the one helper that normalizes and checks; main applies the same `isAllowedExternalUrl` again. The popover takes URLs only: input without a scheme gets `https://`, an empty input removes the link, and anything outside the allowlist is rejected with a message and changes nothing. A link to a local file is not offered. Avoid: file link. |
| Link guard | `linkGuard`, `linkGuardPlugin` (`editor/links`) | – | Editor plugin that catches every click on `a[href]` (and a middle click), editable or not, calls `preventDefault` and passes the `href` attribute as written to `useLinkStore.requestOpen`. It listens to the DOM `click`, because ProseMirror's `handleClick` runs on `mouseup` and cannot stop a native navigation. TipTap's own opening stays off (`openOnClick: false`). Avoid: `ExternalLinkGuard`. |
| External link confirmation | `LinkConfirmDialog`, `useLinkStore`, `requestOpen`, `confirmOpen` | localStorage `mynote-trust-external-links` | `requestOpen` normalizes the `href` and checks the allowlist first: a blocked URL shows the error toast "This link type cannot be opened." and never reaches the dialog. A trusted URL opens at once; any other waits for the dialog "Open External Link" (a `Modal`), and `confirmOpen` checks again that exactly the string the dialog showed passes, then opens it. A second link while one is pending replaces it. "Don't ask again" stores `true`. Avoid: `ExternalLinkGuard`, `ExternalLinkConfirmDialog`, `useExternalLinkStore`. |
| Formatting toolbar | `Toolbar`, `toolbarState`, `ToolbarState` (`editor`) | – | Buttons above the focused text box: bold, italic, underline, strikethrough, headings 1 to 3, bullet and ordered list, code block, link. `toolbarState` is the `useEditorState` selector that gives each button its active state, because `useEditor` does not re-render on every transaction. |
| Link open failure | `onLinkOpenFailed` (`editor`) | – | Main found no browser for a confirmed hyperlink and copied the URL to the clipboard. App shows the toast "No browser available — link copied to clipboard: <url>". |
| Legacy node | `legacyNodes` | `templateLink`: `kind`, `targetId`, `label` | Load-only; never remove a registered node type, the page would load empty. Heading attr `id` is legacy too: the schema no longer has it, so it is dropped on load. A `templateLink` of kind `heading` does nothing on click. |
| Content check | `useNoteEditor`, `noteEditorOptions`, `onContentError` (`editor`) | – | Every text box loads with TipTap's `enableContentCheck`. A node no feature registers makes the box read-only, shows "Read-only: this text box contains content this version cannot display. The stored content stays unchanged." and commits no content, so the file keeps it; moving or resizing the box still works and keeps the stored content. |

## Finance

| Term (UI) | Code | Files / persisted | Notes |
|---|---|---|---|
| Ledger | `financeLedger`, `LedgerBlock` | node attr `ledgerId`; `finance/ledgers/<id>.csv`, `finance/ledgers/<id>.meta.json` (`name`, `currencySymbol`, `columns`) | A list of entries, one CSV per ledger. Avoid: finance table, source. |
| Ledger column | `LEDGER_COLUMNS`, `ColumnConfig` | `columns` in the meta, keyed `date`, `type`, `amount`, `account`, `category`, `topic`, `tags` | Display settings of a column (`align`, `width`, `number`). Keys differ from the CSV header names. |
| Statistics block | `financeStats`, `StatisticsBlock` | node attrs `ledgerId`, `mode`, `from`, `to`, `categoryFocus`, `tagFilter` | Totals and charts of one ledger. |
| Entry | `Entry` | one CSV row; header `id,pos,date,type,amount,accountId,categoryPath,topic,tags,referenceLink` | One income or expense. `type` is `income` or `expense`. German: Buchung. |
| Account | `Account` | `finance/accounts.json`: `id`, `name`, `openingBalance` | Shared by all ledgers of a notebook folder. German: Konto. |
| Balance | `balance` (identifier root) | `openingBalance` on the account | Opening balance + income - expense of an account. German: Saldo; Startsaldo = opening balance. Avoid: `saldo` in identifiers. |
| Category path | `categoryPath` | CSV column `categoryPath`; `finance/categories.json`: `name`, `children` | `/` separates levels, e.g. `Food/Groceries`; empty = no category. German: Kategorie. Avoid: `kat`, `unter`. |
| Tags | `tags`, `parseTags` | CSV column `tags`, joined with `;` | Free labels of an entry, typed with `,` or `;`. |
| Receipt link | `referenceLink`, `pickReceipt` | CSV column `referenceLink` | File path of a receipt on an entry. German: Beleg. Avoid: invoice. Unrelated to Reference data. |
| Reference data | `ReferenceDataDialog`, `referenceError` | `finance/accounts.json`, `finance/categories.json` | Accounts plus categories, shared by all ledgers. |
| Transfer | `finance/transfer` | – | Import and export of ledger data (ledger CSV, Money Manager `.xlsx`). Not a bank transfer; those Money Manager rows are skipped. |
| Money Manager values | `MONEY_MANAGER` | – | `Einkommen` = income, `Ausgabe` = expense in the `.xlsx`. Data constants, not UI text. |
| Locale | `LOCALE`, `DEFAULT_CURRENCY` | `currencySymbol` in the ledger meta | `de-DE` number and date format, defined once in `finance/model.ts`. |

## Platform

| Term (UI) | Code | Files / persisted | Notes |
|---|---|---|---|
| IPC channel | `IPC` (`@shared/ipc`) | – | Named `namespace:camelCase`, e.g. `files:readText`. Avoid: `fs:readFile`, `dialog:openDirectory`, `external-link-open-failed`. |
| Preload API | `window.api`, `MyNoteApi` | – | The only object preload exposes. Avoid: `window.electron`. |
| Folder-relative path | `joinPath` (renderer), `resolveInRoot` (main) | – | Path as sent over IPC: relative to the notebook folder, `/`-separated. Main rejects anything outside. |
| Write queue | `writeText`, `writeJson`, `flushWrites`, `hasUnsentWrites` (`storage`) | – | Per path, one write in flight and the newest pending text wins. `readText` and `readJson` wait for the writes queued for the same path, so a read sees their text. `flushWrites` waits for the writes sent or queued so far; `hasUnsentWrites` is true while text waits behind an in-flight write and has not reached main. |
| Corrupt file | `CorruptFileError` (`storage`) | – | Thrown by `readJson` when a file exists but holds bad JSON or fails its parser. Message `<path>: <reason>`; `cause` holds the original error. A missing file is not corrupt (`null`). |
| Value check | `isRecord`, `describeValue` (`storage`), `messageOf` (`@shared/errors`) | – | The helpers every parser and error report shares. `isRecord` is true for a plain object only (no array, no `null`). `describeValue` shows a parsed value in an error message, cut after 40 characters. `messageOf` is the text of a caught value. |
| Intent | `files.importText`, `files.exportText`, `xlsx.importSheet` | – | Main-side dialog plus read or write in one call, so no external path crosses IPC. |
| App settings | `AppSettings` | `<userData>/settings.json`: `autoUpdateEnabled` | Read by main at startup. `userData` is Electron's app-data folder, not the notebook folder. |
| Settings dialog | `SettingsDialog`, `SettingsButton` (`settings`) | – | Opened by the ⚙️ button and mounted only while open. Shows the app settings and the manual update check; a failed settings read or save shows as error text in the dialog. |
| Theme | `useThemeStore`, `ThemeToggle`, `applyThemeBeforeFirstPaint`, `readStoredTheme`, `THEME_STORAGE_KEY` (`settings`) | localStorage `mynote-theme` (`dark` or `light`) | Per device; not part of the app settings. Nothing stored or `dark` means dark; any other value means light. The class `dark` on `<html>` switches the look; `main.tsx` sets it before the first render. |
| Module | `@renderer/<module>` | `<module>/index.ts` | `ui`, `storage`, `settings`, `notebook`, `editor`, `canvas`, `finance`, `app`. The barrel is the public API; no deep imports. |
| Dialog | `Modal`, `ConfirmDialog`, `TextInputDialog` (`ui`) | – | Rendered into `document.body` and mounted only while open. Escape closes the topmost dialog wherever the focus is; a backdrop click closes it too (`onClose`; `onCancel` in the two dialogs, but not while `ConfirmDialog` is `busy`). `pointerdown`, `mousedown`, `click`, `dblclick`, `contextmenu`, `keydown` and `wheel` stop at the modal, so the opener never sees them. Avoid: `window.confirm`, `alert`, `prompt`. |
| Context menu | `openContextMenu`, `closeContextMenu`, `ContextMenuItem`, `ContextMenuHost` (`ui`; store `useContextMenuStore`) | – | One menu at a time, opened at a point and kept inside the window (`clampToViewport`). Closes on an outside pointerdown, Escape, scroll or window blur. App mounts the host. The sidebar and the table use it; its items are plain `onSelect` callbacks. |
| Toast | `notify`, `Toaster` (`ui`; store `useToastStore`) | – | Short message at the bottom of the window. `info` hides after 4 s; `error` stays until dismissed. A message equal in text and kind to a toast still shown is dropped. App mounts the `Toaster`. |
| Button style | `buttonClass` (`ui`) | – | `primary`, `secondary`, `danger`, `ghost`: the look of the dialog buttons. |
| Pointer drag | `usePointerDrag` (`ui`) | – | Drag with pointer capture. Reports CSS-pixel deltas since the pointerdown; a zoomed caller divides them by the zoom. |
| App shell | `App`, `ContentArea`, `contentKey` (`app`) | – | `App` switches between the welcome screen (no `dataRoot`) and the workspace, and mounts the hosts: link confirmation dialog, context menu, toasts. It reads `dataRoot` only. `ContentArea` alone reads `selection` and keys the canvas by `contentKey` (`<kind>:<id>`), so every content gets a fresh canvas. |
| Error boundary | `ErrorBoundary` (`app`) | – | Wraps `App` in `main.tsx`. A render error shows "Something went wrong", the message and a Reload button instead of a blank window. It does not catch errors in event handlers or async code. |

## Build

| Term (UI) | Code | Files / persisted | Notes |
|---|---|---|---|
| Maturity level | `createLogger(module)` | dev = Vite mode `development`, experimental = `experimental`, release = `production` | Debug logs run only in dev and experimental. Builds: `electron-vite dev`, `npm run build:experimental`, `npm run build`. |
| Feature flag | `FEATURE_FINANCE` (`@shared/features`) | env `MYNOTE_FINANCE`, Vite define `__FEATURE_FINANCE__` | Build time. On by default; `MYNOTE_FINANCE=off` leaves the finance module out. |
| Finance placeholder | `financePlaceholderFeature` | nodes `financeLedger`, `financeStats` stay registered | Used when finance is excluded: pages still load and keep their data; the block shows "Finance module not included in this build". |
| App id | `APP_ID` (`@shared/app`) | `io.github.tiro1999.mynote` | One constant for electron-builder and main. |

## SDK ↔ project (Code = SDK name, Files = project code)

| Term (UI) | Code | Files / persisted | Notes |
|---|---|---|---|
| Text-box editor | `Editor` | `useNoteEditor` | One TipTap editor per text box. |
| Editor extension | `Extension`, `Node`, `Mark` | `buildExtensions` | Avoid: plugin (a ProseMirror `Plugin` is an editor plugin). |
| Block | `Node` with `group: 'block'` | `editor/blocks/` | Say block, not node, in UI text and docs. |
| Block view | `NodeView`, `ReactNodeViewRenderer` | `LedgerBlock`, `StatisticsBlock` | Live blocks use a plain DOM node view. |
| Hyperlink | mark `link` | `editor/links/` | Clicks are intercepted by `linkGuard`, not by TipTap (`openOnClick: false`). |
| Slash command | `Suggestion` with `char: '/'` | `SlashCommand` | Say slash command, not suggestion. |
| Command range | `Range` | `SlashItem.run(editor, range)` | The `/query` text that a slash item replaces. |
| Table, row, header cell, cell | `TableKit`, `Table`, `TableRow`, `TableHeader`, `TableCell` | nodes `table`, `tableRow`, `tableHeader`, `tableCell` | Say row, header cell, cell. |
| Preload API | `contextBridge` | `window.api` | Exposes `MyNoteApi` only. |
| IPC channel | `ipcMain` channel | `IPC`, `handle()` | `handle()` checks the sender frame. |
| Store | Zustand store | `use<Name>Store` | Read with selectors only. |
| Table of contents | `TableOfContents` (TipTap, unused) | `tocBlock` | Not the same: TipTap's extension writes heading ids and renders no block. |
