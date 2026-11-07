# Money Manager .xlsx reader

This page describes the small `.xlsx` reader in the main process: what it reads, which limits protect it, and why it only supports standard OOXML exports.

Code: [`application/src/main/finance/xlsx.ts`](../../../application/src/main/finance/xlsx.ts). It exists only for the Money Manager import of the finance module; the mapping of the rows to entries is in the renderer ([import and export](../renderer/finance/import-export.drawio.svg)).

## Flow

1. The renderer calls `window.api.xlsx.importSheet()` (only `finance/transfer/transfer.ts` does).
2. Main opens a file dialog filtered to `Excel workbook (*.xlsx)`, modal to the calling window. A cancel gives `null`.
3. The file may be at most 10 MiB (`MAX_XLSX_BYTES`, checked before reading): `The file is too large to import`.
4. `readFirstSheet` returns the cell grid as `string[][]`; the renderer maps it with `mapMoneyManager`.

No path crosses IPC: the dialog and the read happen in one call ([IPC](ipc.md)).

## What it reads

An `.xlsx` file is a ZIP archive of XML parts. The reader looks up two parts in the central directory and inflates them with Node's `zlib`:

| Part | If missing |
|---|---|
| `xl/sharedStrings.xml` | no shared strings; shared cells read as empty |
| `xl/worksheets/sheet1.xml` | no rows (the part with this name, not the first tab by order) |

- Cells: `r="C1"` puts the value into column C and fills the gap before it with `''`; a cell without `r` is appended after the last cell. Shared (`t="s"`), inline (`t="inlineStr"`, all text runs joined) and plain `<v>` values are all returned as text. A date or number arrives as its stored text, for example an Excel serial number.
- Sizes are read from the central directory, so files whose local headers carry no sizes (data descriptors) work. Compression method 0 (stored) and 8 (deflate) are accepted.
- Entities `&lt; &gt; &quot; &apos;`, `&#x…;` and `&#…;` are decoded first and `&amp;` last, so `&amp;lt;` stays `&lt;`. A numeric entity above U+10FFFF keeps its text.

## Limits

The file comes from outside, so the reader assumes a hostile one.

| Limit | Value | Error |
|---|---|---|
| file size | 10 MiB | The file is too large to import |
| one inflated part | 32 MiB (`MAX_PART_BYTES`) | The .xlsx file is too large |
| cells in the sheet | 1,000,000 (`MAX_CELLS`); a row counts at least one cell, gaps left by `r="…"` count | The .xlsx file is too large |
| column | at most `XFD` (16384) | Not a valid .xlsx file |

`Not a valid .xlsx file` is also thrown for: no end-of-central-directory record in the last 22 + 65535 bytes, an offset or length outside the file, a wrong signature, a compression method other than 0 or 8, and corrupt deflate data.

The XML is scanned linearly with `indexOf`, and the scan stops at the first unclosed tag and keeps what came before. A hostile part with hundreds of thousands of unclosed `<si>` or `<row>` tags therefore cannot block the main process.

## Why only standard OOXML exports

The reader is tailored to what Money Manager writes. It does not read `xl/workbook.xml`, relationships, styles or number formats, and it takes no other sheet than `sheet1.xml`. A workbook that stores its data elsewhere gives no rows, and the renderer then reports that it is not a Money Manager export.

A library was rejected on purpose: the npm package `xlsx` is stuck at 0.18.5 (CVE-2023-30533, CVE-2024-22363; the fixed version is only a tarball from the SheetJS CDN), `exceljs` brings nine dependencies and `read-excel-file` four. A reader on `zlib` with `maxOutputLength` keeps the attack surface in one small file.

## Finance-off builds

`main/index.ts` calls `registerXlsxIpc()` only when `FEATURE_FINANCE` is true. In a build with `MYNOTE_FINANCE=off` the handler does not exist, but the preload still exposes `window.api.xlsx.importSheet`, because it does not read the flag ([architecture](../architecture.md)). The only caller is the finance transfer code.
