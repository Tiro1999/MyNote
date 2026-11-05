# IPC

This page describes how the renderer calls the main process: the channels, the handler wrapper, the checks on arguments and paths, how errors travel, and how external links are filtered.

The whole contract is one file, [`application/src/shared/ipc.ts`](../../../application/src/shared/ipc.ts): the `IPC` channel names, the `MyNoteApi` type and the value types (`FileFilter`, `DirEntry`, `AppSettings`, `UpdateCheckStatus`). The [preload script](../../../application/src/preload/index.ts) implements `MyNoteApi` with one `ipcRenderer.invoke` per request channel, and `ipcRenderer.on` with `removeListener` for the one event (`links.onOpenFailed`); the renderer sees it as `window.api` ([who may use it](../architecture.md)).

## Channels

Names are `namespace:camelCase`.

| Group | Channels | Purpose |
|---|---|---|
| `files` | `readText` `writeText` `list` `remove` `importText` `exportText` | file access inside the data root; the last two are intents |
| `dialogs` | `openNotebookFolder` `pickFile` | the folder dialog (sets the data root); a file picker that returns only the chosen path (receipt link) |
| `xlsx` | `importSheet` | Money Manager workbook as rows, finance builds only ([reader](finance-xlsx.md)) |
| `settings` | `get` `setAutoUpdate` | app settings in the user-data folder ([updates](updates.md)) |
| `updates` | `check` | manual update check |
| `links` | `openFailed` | the only event main sends to the renderer: a link could not be opened |

## Handler wrapper

Every handler is registered through `handle` or `handleWithEvent` in [`application/src/main/ipc.ts`](../../../application/src/main/ipc.ts); no file calls `ipcMain.handle` directly.

- Both check `event.senderFrame.url` first. Unless it is the app page they throw `Blocked IPC from an untrusted frame` and the listener never runs.
- The app page (`appBaseUrl`, `isAppUrl` in `main/window/appUrl.ts`) is the dev-server origin when the app is not packaged and `ELECTRON_RENDERER_URL` is set, otherwise the file URL of `out/renderer/index.html`. A packaged app ignores the environment variable. For a file URL the host and the decoded path must match, query and hash do not count, and a Windows drive letter compares without case.
- `handle` passes only the arguments. `handleWithEvent` passes the event first, for handlers that need `event.sender` (the dialogs use it as the modal parent window).

## Arguments

Everything from the renderer is untrusted and is checked in main before use. A wrong type throws `Invalid argument: <name>` before any file or dialog is touched:

- `path`, `dir`, `text`, `defaultName`: strings.
- `filters`: an array of `{ name: string, extensions: string[] }`.
- `setAutoUpdate`: a boolean, else `autoUpdateEnabled must be a boolean`.

## Paths

- A path crosses IPC folder-relative and `/`-separated (`notebooks.json`, `<notebook>/<chapter>/page.json`, `finance/…`), whatever the platform. The renderer builds it with `joinPath` from `@renderer/storage`; an id that becomes a segment must match `isValidId`.
- Main resolves it against the data root with `resolveInRoot` and rejects an empty segment, `.`, `..` and a segment with `\`, `:` or a NUL character: `Path outside the notebook folder: <path>`. The rules and their limits are on [files](files.md).
- No path from outside the data root is sent to main. Reading or writing such a file is an intent that main does itself, with a dialog in the same call: `files.importText`, `files.exportText`, `xlsx.importSheet`. The two dialogs `dialogs.openNotebookFolder` and `dialogs.pickFile` return a chosen path from main to the renderer; the renderer only shows or stores it as text and never sends it back as a path to read.

## Errors

- An error thrown in a handler reaches the renderer as a rejected promise that carries the message. `messageOf` from `@shared/errors` turns any caught value into text for toasts and error boxes.
- Expected absences are results, not errors: `readText` gives `null` for a missing file, `list` gives `[]` for a missing folder, `remove` ignores a missing path, a cancelled dialog gives `null` or `false`. A manual update check answers with a status object instead of rejecting.

## External links

`shared/links.ts` holds the allowlist (`http:`, `https:`, `mailto:`) and is applied in both processes. `isAllowedExternalUrl` also rejects any URL that contains a character at or below U+0020, DEL or a backslash anywhere, because the URL parser would silently drop or change such characters and the opened address would differ from the shown one.

1. The renderer normalizes and checks the address before it shows the confirmation dialog ([links](../renderer/editor/links.drawio.svg)).
2. Main applies the same `isAllowedExternalUrl` again in the window-open handler (`main/window/externalLinks.ts`). The handler always answers `deny`, so the app never opens a second Electron window. An allowed URL goes to `shell.openExternal`; anything else is logged and dropped.
3. When `openExternal` fails (for example no browser in a headless container), main copies the URL to the clipboard and sends `links:openFailed`; the renderer shows a toast.

Related names: [glossary](../../glossar.md) rows IPC channel, Preload API, Folder-relative path.
