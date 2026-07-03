# MyNote file format — JSON Schema

This folder is the **source of truth** for MyNote's on-disk file format. It exists so that:

1. Any other client (e.g. a future Android/Flutter app, or a CLI tool) can read/write
   the exact same notebook folders without reverse-engineering the Electron app.
2. An **integrity check** can be implemented (in MyNote itself, or a standalone tool) by
   validating `notebooks.json` / `page.json` files against these schemas before trusting them.

## Files

| Schema | Validates | Corresponds to |
|---|---|---|
| [`notebooks.schema.json`](./notebooks.schema.json) | `{dataRoot}/notebooks.json` — the full notebook → chapter → page/subpage hierarchy | `Notebook`, `Section`, `PageMeta` in `src/renderer/src/types/index.ts` |
| [`page-content.schema.json`](./page-content.schema.json) | `{...}/page.json` — one chapter's/page's canvas content | `PageContent`, `AnyCanvasElement` in `src/renderer/src/types/index.ts` |
| [`tiptap-document.schema.json`](./tiptap-document.schema.json) | The `content` field of a `textbox` canvas element — a TipTap/ProseMirror document | The extensions registered in `src/renderer/src/components/Canvas/TextBox.tsx` and the custom nodes in `src/renderer/src/templates/` |

All three use JSON Schema **draft 2020-12** (`$defs`, `if`/`then`, `$comment`).

## On-disk layout these schemas describe

```
{dataRoot}/
  notebooks.json                                  ← notebooks.schema.json
  {notebookId}/
    {sectionId}/
      page.json                                   ← page-content.schema.json (the chapter's own note)
      assets/                                      ← files referenced by the chapter note's assetPath
      {pageId}/
        page.json                                  ← page-content.schema.json
        assets/
        {subpageId}/
          page.json
          assets/
          ...                                       (recursive, one level per subpage)
```

## Validating a notebook folder

The schemas are plain JSON Schema and can be checked with any compliant validator. Example using
`ajv` (already present transitively via `electron-builder`'s dependency tree, or install
`ajv@^8` + `ajv-formats` directly for standalone tooling):

```js
const Ajv2020 = require('ajv/dist/2020').default
const addFormats = require('ajv-formats') // needed for the "date-time" format check on createdAt/updatedAt

const ajv = new Ajv2020({ allErrors: true })
addFormats(ajv)
ajv.addSchema(require('./schema/tiptap-document.schema.json'))
ajv.addSchema(require('./schema/page-content.schema.json'))
ajv.addSchema(require('./schema/notebooks.schema.json'))

const validate = ajv.getSchema('https://mynote.app/schema/notebooks.schema.json')
if (!validate(JSON.parse(fs.readFileSync('notebooks.json', 'utf-8')))) {
  console.error(validate.errors)
}
```

> Without `ajv-formats`, ajv logs `unknown format "date-time" ignored` and skips that one check —
> everything else (required fields, enums, recursive shape, custom node attrs) still validates.

## Maintenance — **update these schemas whenever**:

- `Notebook` / `Section` / `PageMeta` / `PageContent` / `AnyCanvasElement` change in
  `src/renderer/src/types/index.ts` → update `notebooks.schema.json` / `page-content.schema.json`.
- The extensions array in `TextBox.tsx` changes (new/removed TipTap node or mark, e.g. a new
  StarterKit feature is enabled, or a new custom node is added under `templates/`) →
  update the `node`/`mark` enums and `if`/`then` refinements in `tiptap-document.schema.json`.
- A new custom template node is added (like `Callout`/`TemplateLink`) → add a matching
  `if`/`then` block describing its required `attrs` shape, mirroring the node's `addAttributes()`.

## Format version

There is currently **no explicit `formatVersion` field** in `notebooks.json` — the format
described here is the implicit "v1". `normalizeNotebooks()` in `notebookStore.ts` already
backfills fields added after the original release (e.g. `children`, `collapsed`) for
older files, so the format has so far evolved in a backward-compatible way. If a future change
requires a breaking migration, consider adding an explicit `formatVersion` field and a matching
`oneOf` per version in `notebooks.schema.json`.
