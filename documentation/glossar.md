# Glossary

Binding for code, comments and docs (`.claude/rules/core.md` §3). Persisted names are the on-disk truth and never change; unclear names get a `NAMING-CHECK` marker.

## Notebook structure

| Term (UI) | Code | Files / persisted | Notes |
|---|---|---|---|
| Notebook | `Notebook`, `MANIFEST_PATH` | `notebooks.json` (array of notebooks); folder `<notebookId>/` | Top level. Fields `id`, `name`, `color`, `sections`. |
| Chapter | `Section` | `sections` (in a notebook), `sectionId` (in a page); folder `<notebookId>/<sectionId>/` | UI says Chapter, code and files say section. Avoid: Section in UI text. |
| Page | `PageMeta` | `pages` (in a chapter); `<notebookId>/<sectionId>/<pageId>/page.json` | Tree entry only; the content is in `page.json`. |
| Subpage | `PageMeta` | `children` (recursive); folder inside the parent page folder | Same type as a page; its `sectionId` stays the chapter id. |
| Collapsed state | `collapsed` | `collapsed` on chapter and page (optional) | Sidebar fold state, saved in `notebooks.json`. |
| Chapter note | `ContentRef` with `kind: 'section'` | `<notebookId>/<sectionId>/page.json` | The canvas a chapter holds itself. Its persisted `pageId` is the section id. |
| Content ref | `ContentRef { kind, id }`, `ContentKind` | not persisted | `ContentKind` is `'section'` or `'page'`. Points at the open chapter note or page (store field `selection`). Avoid: `activeContentKind`, `activeContentId`, `activeSectionId`. |
| Notebook folder | `dataRoot` | folder that holds `notebooks.json` | UI "Notebook Folder"; renderer `dataRoot`; main "data root", set only by the folder dialog. |
| Id | `ID_PATTERN`, `isValidId`, `newId` | `id`, `sectionId`, `ledgerId` (also folder and file names) | Must match `/^[A-Za-z0-9_-]{1,64}$/` wherever it becomes a path segment. |

## Canvas and editor

| Term (UI) | Code | Files / persisted | Notes |
|---|---|---|---|
| Canvas | `CanvasView` | `page.json`: `pageId`, `elements` (`PageContent`) | Free-form surface of one chapter note or page. Pan and zoom are not saved. |
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
| Folder-relative path | `resolveInRoot` | – | Path as sent over IPC: relative to the notebook folder, `/`-separated. Main rejects anything outside. |
| Intent | `files.importText`, `files.exportText`, `xlsx.importSheet` | – | Main-side dialog plus read or write in one call, so no external path crosses IPC. |
| App settings | `AppSettings` | `<userData>/settings.json`: `autoUpdateEnabled` | Read by main at startup. `userData` is Electron's app-data folder, not the notebook folder. |
| Theme | `useThemeStore`, `THEME_STORAGE_KEY` | localStorage `mynote-theme` (`dark` or `light`) | Per device; not part of the app settings. |
| Module | `@renderer/<module>` | `<module>/index.ts` | `ui`, `storage`, `settings`, `notebook`, `editor`, `canvas`, `finance`, `app`. The barrel is the public API; no deep imports. |
| Dialog | `Modal`, `ConfirmDialog`, `TextInputDialog`, `ContextMenu`, `notify` | – | Shared in `ui`. Avoid: `window.confirm`, `alert`, `prompt`. |

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
