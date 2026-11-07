# Using Network & Cloud Storage

MyNote stores notebooks in plain folders. Any folder your OS can read and write to works —
including mapped network drives and cloud-synced folders. This page shows how to point MyNote at
such a folder and what happens when a save does not go through.

---

## Windows: Map a network drive (NAS / SMB share)

1. Open **File Explorer** → right-click **This PC** → **Map network drive…**
2. Pick a drive letter (e.g. `Z:`) and enter the UNC path, e.g. `\\nas-hostname\Notes`
3. Tick **Reconnect at sign-in**
4. In MyNote, click **Open or Create Notebook Folder** and select that drive letter

---

## macOS: Mount a network share

1. **Finder** → **Go** → **Connect to Server…** (`Cmd+K`)
2. Enter `smb://nas-hostname/Notes` and click **Connect**
3. The share mounts at `/Volumes/Notes`
4. In MyNote, select `/Volumes/Notes` as the notebook folder

---

## Linux: Mount an SMB or NFS share

```bash
# SMB (requires cifs-utils)
sudo mount -t cifs //nas-hostname/Notes /mnt/notes -o username=youruser

# NFS
sudo mount -t nfs nas-hostname:/exports/notes /mnt/notes
```

Then point MyNote at `/mnt/notes`.

---

## Cloud-synced folders

Select any folder that your sync client keeps up to date:

| Provider | Default sync folder (Windows) |
|----------|-------------------------------|
| OneDrive | `C:\Users\<you>\OneDrive` |
| Dropbox  | `C:\Users\<you>\Dropbox` |
| Nextcloud Desktop | Configured during Nextcloud setup |
| Google Drive (Stream) | `G:\My Drive` (drive letter from Drive for Desktop) |

MyNote writes files directly; the sync client handles uploading.

> **Tip:** Avoid editing the same notebook from two devices simultaneously.
> `notebooks.json` holds the whole notebook tree and is rewritten completely on every change, so
> parallel edits can leave conflict copies or overwrite one version with the other.

---

## How MyNote saves

- Every file is written atomically. MyNote writes the new text to a temporary file next to the
  target (a name ending in `.tmp`) and then renames it over the old file. If MyNote or the machine
  stops in the middle of a write, the old file is still complete; a stray `.tmp` file can be
  deleted. A sync client may show the temporary file for a moment.
- A short lock, for example from a sync client or a virus scanner, is retried (five rename attempts in all, 100 ms
  apart) before the save counts as failed.
- Changes are saved while you work: the notebook tree at once, a page 400 ms after your last
  edit. Closing MyNote waits up to ten seconds for writes that are still running, so a stalled
  network drive cannot keep it open for ever.

---

## When a save fails

A failed save never damages the old file: it stays on disk as it was, and your change stays in
the app. MyNote tells you where:

| Where | What you see |
|-------|--------------|
| Notebook tree | A red message such as "Couldn't save notebooks.json: …", which stays until you dismiss it |
| A page | A red message such as "Couldn't save …/page.json: …" |
| A ledger | A red **Not saved: …** box above the table, until the next save works |

Typical causes are a network drive that is offline, a full disk, or a program that holds the file
open. After you fixed the cause, make another change and MyNote writes again.

A ledger's CSV file (`finance/ledgers/` in the notebook folder) that **Excel** holds open is the common
case on Windows: Excel locks the file, so the final rename fails and the ledger shows **Not saved**
with the system's error. Close the file in Excel, then change any entry to save. Do not save the CSV from Excel itself:
a German Excel writes `;` as separator, and MyNote refuses a ledger file in that form.

---

## Backup

Because notebooks are plain folders, any file-copy tool works:

```bash
# rsync (Linux / macOS)
rsync -av ~/Documents/MyNotes/ /backup/MyNotes/

# Robocopy (Windows)
robocopy "C:\Users\<you>\Documents\MyNotes" "D:\Backup\MyNotes" /MIR
```

`/MIR` mirrors the folder, so it also deletes from the backup what was deleted in the source: a page you delete in MyNote disappears from the backup at the next run.

The stored format is described in the [file format](../software/file-format/file-format.md).
