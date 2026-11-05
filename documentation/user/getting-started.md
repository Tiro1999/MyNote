# Getting Started with MyNote

How to install MyNote, open a notebook folder and work with chapters, pages, text boxes, links and the finance ledger.

## Download and install

Download the latest release from the [Releases](https://github.com/Tiro1999/MyNote/releases) page.

| Platform | File |
|----------|------|
| Windows  | `.exe` installer |
| macOS    | `.dmg` (one for Intel, one for Apple silicon) |
| Linux    | `.AppImage` |

### Windows
Run the installer. It is a wizard: choose the install folder and whether to install only for you (the default, no administrator rights needed) or for all users.

> **"Windows protected your PC"?** MyNote is a small open-source app and isn't
> signed with a paid code-signing certificate, so Windows SmartScreen shows a
> blue warning the first time you run the installer. This is expected — click
> **More info → Run anyway** to continue. (If you'd rather verify first, the
> installer is built in the open by GitHub Actions from the tagged source.)

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
3. An empty folder opens as an empty workspace. MyNote writes `notebooks.json` when you create your first notebook.

Your notes stay entirely in that folder. Back it up any way you like; see [network and cloud storage](network-storage.md). The light/dark choice and the settings are stored per device, not in the folder.

Starting MyNote a second time brings the running window to the front. If `notebooks.json` is damaged, the welcome screen shows "Couldn't open the notebook folder: …" and changes nothing; the stored format is described in the [file format](../software/file-format/file-format.md).

---

## Staying up to date

On **Windows** and **Linux**, the installed app checks for new versions each time you start it. A newer release downloads in the background, a notification says "Update ready", and the update installs when you quit.

> Updates only appear once a version has been *published* on the Releases page.
> Drafts and pre-releases are invisible to the updater.

Open **⚙️ Settings** (top of the sidebar, or top-right of the welcome screen):

| Control | Effect |
|---------|--------|
| **Automatic updates** switch | Off: MyNote does not check at startup, you update from the Releases page. Turning it on checks at once. |
| **Check for updates** | Checks now, even when automatic updates are off, and shows the result next to the button. |

On **macOS** there is no update feed: the check answers "Updates are not available on macOS yet. Download new versions from GitHub Releases.", so grab the newest `.dmg` yourself.

The **Light**/**Dark** button next to ⚙️ switches the theme (dark by default).

---

## Notebooks, chapters and pages

```
Notebook
 └── Chapter
      └── Page
           └── Subpage
```

| To … | Do this |
|------|---------|
| Create a notebook | **+ New** at the top of the sidebar |
| Open a notebook | Click its name; its chapters appear below |
| Add a chapter | **+ Chapter** below the chapters of the open notebook |
| Add a page | **+ Page** below a chapter's pages, the **+** that shows when you hover a chapter, or right-click the chapter → **New page** |
| Add a subpage | Hover a page and click **+**, or right-click it → **New subpage** |
| Open a chapter, page or subpage | Click it. A chapter has a canvas of its own (its chapter note) |
| Rename | Right-click → **Rename** (notebooks too) |
| Delete | Right-click a chapter or page → **Delete**. It asks first, then deletes the entry and everything below it permanently, including their files in the notebook folder. A notebook cannot be deleted in the app |
| Fold | ▸ / ▾ in front of an entry that has pages below it |

New pages are called "Untitled Page".

---

## The canvas

Each chapter and page is a free-form canvas — no fixed layout, no Markdown.

| Action | How |
|--------|-----|
| **Add text box** | Double-click on an empty area of the canvas |
| **Edit** | Click inside the text box; the toolbar appears at its top. Click outside to finish |
| **Move** | Press on a text box that is not being edited and drag (a plain click does not move it) |
| **Resize** | Drag the ↘ handle at the bottom-right corner (it shows on hover); the minimum is 120 × 60 |
| **Delete** | The red **×** at the top-right corner when you hover a text box that is not being edited; it asks nothing |
| **Pan** | Scroll wheel on the empty canvas, Alt + left-drag on the empty canvas, or middle-mouse drag |
| **Scroll a text box** | Scroll wheel over the box (the canvas does not move) |
| **Zoom** | Ctrl (⌘ on macOS) + scroll wheel, also over a text box |
| **Zoom buttons** | `−` / `+` in the bottom-right corner, 10 % per step between 20 % and 300 % |
| **Reset view** | **Reset** in the bottom-right corner |
| **Overview** | The small map above the zoom buttons shows all text boxes; click or drag in it to jump there |

Pan and zoom are not saved. An empty page shows "Double-click anywhere to add a text box". If a page cannot be read, a red message appears and the page is left unchanged. A text box that holds content this version cannot display opens read-only with a notice; you can still move and resize it and its content stays as stored.

---

## Formatting text

Click inside a text box to edit it. The toolbar appears at the top of the box.

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
| 🔗 | Insert or edit a link |
| 🔗✕ | Remove link (appears when the cursor is inside a link) |

All standard keyboard shortcuts work inside a text box (`Ctrl+Z`, `Ctrl+A`, etc.).

### Blocks with `/`

Type `/` in a text box, keep typing to filter, choose with ↑ ↓ and Enter or a click.

| Entry | Inserts |
|-------|---------|
| Info, Note, Warning, Error | A colored callout panel |
| Table of contents | A list of the headings in this text box; it updates itself and a click scrolls to the heading |
| Page hierarchy | A list of the pages of this chapter, or the subpages of this page; it updates itself and a click opens the page |
| Table | A 3 × 3 table. Hover a row or column boundary and click **+** to add one; right-click a cell for **Insert row above/below**, **Insert column left/right**, **Delete row/column/table**. Deleting the last row or column deletes the table |
| Ledger (income and expenses), Statistics | See [Finance](finance.md) |

---

## Inserting links

1. Select text in a text box.
2. Click the **🔗** button in the toolbar.
3. Type or paste a web address (or a `mailto:` address) and press **Enter** or **OK**. An address without a scheme, such as `example.com`, gets `https://`.

Only `http:`, `https:` and `mailto:` links are accepted. Anything else, an address with spaces, or a local file path is refused with "Enter a web address or a mailto: link." and changes nothing. Links to local files are not supported.

To change a link, put the cursor inside it with the arrow keys, click **🔗** and type the new address. To remove it, click **🔗✕**, or empty the address field and press **Enter**.

Clicking a link, also while you edit, asks first: the dialog **Open External Link** shows the address, and **Open Link** opens it in your default browser. Tick "Don't ask again and remember my choice" to open links at once on this device. A link of another type shows "This link type cannot be opened." If no browser is available, MyNote copies the address to the clipboard and says so.

---

## Finance

The optional finance module adds ledger and statistics blocks to the `/` menu. See [Finance: ledgers and statistics](finance.md).
