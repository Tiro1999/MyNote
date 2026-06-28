# Getting Started with MyNote

## Download & install

Download the latest release from the [Releases](../../../releases) page.

| Platform | File |
|----------|------|
| Windows  | `MyNote-Setup-vX.Y.Z.exe` |
| macOS    | `MyNote-vX.Y.Z.dmg` |
| Linux    | `MyNote-vX.Y.Z.AppImage` |

### Windows
Run the installer. No administrator rights required (per-user install by default).

### macOS
Open the `.dmg` and drag **MyNote** into your Applications folder.

### Linux
```bash
chmod +x MyNote-*.AppImage
./MyNote-*.AppImage
```

---

## First launch

1. Click **Open or Create Notebook Folder**.
2. Choose any folder — for example:
   - `Documents/MyNotes` (local)
   - A mapped network drive or NAS share
   - A folder synced by OneDrive, Dropbox, or Nextcloud
3. MyNote creates a `notebooks.json` manifest in that folder on first use.

Your notes stay entirely in that folder. Back it up any way you like.

---

## The canvas

Each **page** is a free-form canvas — no fixed layout, no Markdown.

| Action | How |
|--------|-----|
| **Add text box** | Double-click on an empty area of the canvas |
| **Move text box** | Drag the box border (when not in text-edit mode) |
| **Resize text box** | Drag the ↘ handle at the bottom-right corner |
| **Pan canvas** | Alt + Left-drag, or middle-mouse drag |
| **Zoom** | Ctrl + Scroll wheel |
| **Zoom buttons** | `−` / `+` controls in the bottom-right corner |
| **Reset view** | Click **Reset** in the bottom-right corner |

---

## Organizing notes

```
Notebook
 └── Section (tab)
      └── Page
```

- **+ New** (top of sidebar) → create a notebook
- **+ Section** (under a notebook) → add a section
- **+ Page** (under a section) → add a page

---

## Formatting text

Click inside a text box to enter edit mode. The toolbar appears at the top of the box.

| Button | Action |
|--------|--------|
| **B** | Bold (`Ctrl+B`) |
| *I* | Italic (`Ctrl+I`) |
| U | Underline (`Ctrl+U`) |
| ~~S~~ | Strikethrough |
| H1 / H2 / H3 | Headings |
| • List | Bullet list |
| 1. List | Numbered list |
| `</>` | Code block |
| 🔗 | Insert link |
| 🔗✕ | Remove link (appears when cursor is inside a link) |

All standard keyboard shortcuts work inside a text box (`Ctrl+Z`, `Ctrl+A`, etc.).

---

## Inserting links

1. Select text in a text box.
2. Click the **🔗** button in the toolbar.
3. A dialog asks whether to open the file picker or type a URL manually:
   - **File picker** → opens the system file browser so you can link to a local file.
   - **Type URL** → paste any web address.

To remove a link, click inside linked text and click **🔗✕** in the toolbar.
