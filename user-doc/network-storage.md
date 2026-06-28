# Using Network & Cloud Storage

MyNote stores notebooks in plain folders. Any folder your OS can read and write to works —
including mapped network drives and cloud-synced folders.

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
> Sync conflicts may produce duplicate or overwritten `notebooks.json` files.

---

## Backup

Because notebooks are plain folders, any file-copy tool works:

```bash
# rsync (Linux / macOS)
rsync -av ~/Documents/MyNotes/ /backup/MyNotes/

# Robocopy (Windows)
robocopy "C:\Users\you\Documents\MyNotes" "D:\Backup\MyNotes" /MIR
```
