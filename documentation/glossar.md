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
| Canvas | `CanvasView` | `page.json`: `pageId`, `elements` (`PageContent`) | Free-form surface of one chapter note or page. Pan and zoom are not saved. |
| Page content | `PageContent`, `parsePageContent`, `emptyContent` (`canvas`) | `page.json`: `pageId`, `elements` | Loading checks what rendering relies on: `elements` is a list, each element has a string `id` and `type`, a text box has numeric `x`, `y`, `width`, `height`, `zIndex` and an object `content`. It fills a missing `elements` with `[]` and a missing `pageId` with the content id, and keeps unknown fields on the page and on each element; a failed check makes it a corrupt file. |
| Content store | `useContentStore`, `startContentSync`, `flushContent`, `SAVE_DELAY_MS` (`canvas`) | `page.json` of the selection | Holds the open content (`ref`, `path`, `content`, `error`) and follows a changed `selection`, not a change of the tree alone; a load overtaken by a later selection is dropped. Selecting the open content again reloads it only after a failed load. A missing file opens empty and is created by its first save; a corrupt one sets `error`, keeps `content` null and is never saved. A save goes to the path loaded with its content: `addElement` and `deleteElement` at once, `commitElement` 400 ms after the last commit, `updateElement` never. An id that no text box has changes and saves nothing. A switch sends the pending save at once, or drops it when the old content was deleted. On window close the pending save is sent, and the close waits while text is still queued behind an in-flight write; a second close during that wait passes, so a stalled write cannot trap the window. |
| Canvas element | `CanvasElement` | `elements[]`: `id`, `type`, `x`, `y`, `width`, `height`, `zIndex` | `TextBoxElement` or `ForeignElement`. Avoid: `AnyCanvasElement`, `ImageElement`, `FileElement`. |
| Text box | `TextBoxElement` | `type: 'textbox'`, `content` (TipTap JSON) | One TipTap editor per text box. |
| Foreign element | `ForeignElement` | `elements[]` entry with another `type` (`image`, `file`) | Kept and saved, never rendered. |
| Block | `editor/blocks/`, `coreBlocks` | node types in a text box's `content` | A TipTap node in group `block`. Avoid: template (old folder `templates/`). |
| Live block | `tocBlock`, `pageHierarchyBlock` | see the next two rows | Atom block whose list is computed on render; no snapshot is saved. |
| Table of contents | `tocBlock` | node `tocBlock`, no attrs | Live list of the headings in its own text box. German: Inhaltsverzeichnis. |
| Page hierarchy | `pageHierarchyBlock` | node `pageHierarchyBlock`: `kind`, `targetId` | Live list of a chapter's pages or a page's subpages. German: Seitenhierarchie. |
| Callout | `callout`, `CALLOUT_VARIANTS` | node `callout`, attr `variant` | Variants `info`, `note`, `warning`, `error`, labelled Info, Note, Warning, Error. German: Hinweis, Warnung, Fehler. |
| Table | `table` | nodes `table`, `tableRow`, `tableHeader`, `tableCell` | TipTap table with hover "+" controls and a context menu. |
| Slash command | `SlashCommand` | – | The `/` menu in a text box. Avoid: backslash command. |
| Slash item | `SlashItem`, `filterSlashItems` | – | One entry of the slash menu. Avoid: `TemplateCommand`, `getTemplateCommands`. |
| Editor feature | `EditorFeature`, `editorFeatures` | – | Adds extensions and slash items; a fixed list (`coreBlocks`, `financeFeature`), not a plugin system. |
| Jump link | `renderLinkList` | – | Entry of a live block that scrolls to a heading or opens a page. Not a hyperlink. Avoid: template link. |
| Hyperlink | `LinkPopover`, `isAllowedExternalUrl` | mark `link`, attr `href` | Link to an external URL; only `http:`, `https:`, `mailto:` open. |
| External link confirmation | `LinkConfirmDialog`, `useLinkStore` | localStorage `mynote-trust-external-links` | Dialog "Open External Link"; "Don't ask again" stores `true`. Avoid: `ExternalLinkGuard`, `useExternalLinkStore`. |
| Link open failure | `onLinkOpenFailed` (`editor`) | – | Main found no browser for a confirmed hyperlink and copied the URL to the clipboard. App shows the toast "No browser available — link copied to clipboard: <url>". |
| Legacy node | `legacyNodes` | `templateLink`: `kind`, `targetId`, `label` | Load-only; never remove a registered node type, the page would load empty. Heading attr `id` is legacy too. |

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
| Context menu | `openContextMenu`, `closeContextMenu`, `ContextMenuItem`, `ContextMenuHost` (`ui`; store `useContextMenuStore`) | – | One menu at a time, opened at a point and kept inside the window (`clampToViewport`). Closes on an outside pointerdown, Escape, scroll or window blur. App mounts the host. |
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
| Hyperlink | mark `link` | `editor/links/` | Clicks are intercepted by the link guard, not by TipTap. |
| Slash command | `Suggestion` with `char: '/'` | `SlashCommand` | Say slash command, not suggestion. |
| Command range | `Range` | `SlashItem.run(editor, range)` | The `/query` text that a slash item replaces. |
| Table, row, header cell, cell | `TableKit`, `Table`, `TableRow`, `TableHeader`, `TableCell` | nodes `table`, `tableRow`, `tableHeader`, `tableCell` | Say row, header cell, cell. |
| Preload API | `contextBridge` | `window.api` | Exposes `MyNoteApi` only. |
| IPC channel | `ipcMain` channel | `IPC`, `handle()` | `handle()` checks the sender frame. |
| Store | Zustand store | `use<Name>Store` | Read with selectors only. |
| Table of contents | `TableOfContents` (TipTap, unused) | `tocBlock` | Not the same: TipTap's extension writes heading ids and renders no block. |
