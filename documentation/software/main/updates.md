# Updates

This page describes the automatic and the manual update check in the main process, the setting that controls the first, and why macOS has no update feed.

Code: [`application/src/main/updates/updates.ts`](../../../application/src/main/updates/updates.ts) (check and IPC) and [`application/src/main/settings/settings.ts`](../../../application/src/main/settings/settings.ts) (setting). The check uses `electron-updater` and the GitHub release feed configured in [`application/electron-builder.ts`](../../../application/electron-builder.ts).

## Automatic check

`checkForUpdatesIfEnabled()` runs once at startup, after the window was created, and again whenever the user turns automatic updates on.

| Condition | Result |
|---|---|
| app not packaged, or platform is macOS | nothing happens |
| `autoUpdateEnabled` is `false` | nothing happens, one info line is logged |
| otherwise | `autoUpdater.checkForUpdates()` |

- A failed check is logged as an error and never thrown, so it cannot block the app.
- The code sets no `autoDownload` or `autoInstallOnAppQuit`; it relies on the electron-updater defaults, which download a found update in the background and install it when the app quits. When the download finishes, main shows a notification "Update ready" with the text "MyNote <version> will be installed when you quit."
- The download promise always has a rejection handler (`watchDownload`): a failed download is logged as a warning. `registerUpdatesIpc` also adds an `error` listener that logs a warning, because the updater reports a failed install on quit as an `error` event.

## Manual check

The Settings dialog calls `updates:check`. It works whatever the setting says and answers with a status; the dialog turns it into text.

| Status | When | Dialog text |
|---|---|---|
| `dev` | app not packaged | Updates are only available in the installed app. |
| `unsupported` | macOS | Updates are not available on macOS yet. Download new versions from GitHub Releases. |
| `available` + `version` | an update was found | Update to v<version> found — it will install when you restart MyNote. |
| `not-available` + `version` | no update, also when the updater returns no result | You're on the latest version (v<version>). |
| `error` + `error` | the check threw | Couldn't check for updates: <message> |

A download that a manual check starts gets the same warning handler but no notification.

## Setting `autoUpdateEnabled`

- Stored in `<userData>/settings.json`, Electron's app-data folder, not in the notebook folder. Main reads it for the automatic check, and the Settings dialog reads it through `settings:get`.
- `parseSettings` takes the value only when it is a boolean; anything else gives the default `true`. A missing file gives the defaults silently; an unreadable or corrupt file gives the defaults and logs a warning. Nothing is written back on load.
- `settings:setAutoUpdate` rejects a value that is not a boolean, writes the file atomically ([files](files.md)) and returns the new settings. When the value is `true` it starts a check at once.

## Why macOS has no update feed

electron-updater's macOS updater downloads a `.zip` that the update information names, and fails with "ZIP file not provided" without one. The mac target in `electron-builder.ts` builds only a `dmg`, so the build produces no `.zip`. Main therefore skips the automatic check on macOS and answers `unsupported` to the manual one. The release side is described in [build and release](../build/build-and-release.md).
