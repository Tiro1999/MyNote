# MyNote file format

MyNote stores notebooks as plain folders + JSON files on disk — no database, no server.
This is intentional: it keeps the format portable across future clients (e.g. a
mobile app) and inspectable/repairable by hand if something goes wrong.

## Source of truth

**[This folder](./)** contains the maintained JSON Schema
(draft 2020-12) for every file MyNote writes:

| File | Schema |
|---|---|
| `notebooks.json` (notebook → chapter → page/subpage hierarchy) | [`notebooks.schema.json`](notebooks.schema.json) |
| `page.json` (a chapter/page/subpage's canvas content) | [`page-content.schema.json`](page-content.schema.json) |
| Rich-text content inside a text box (TipTap/ProseMirror JSON) | [`tiptap-document.schema.json`](tiptap-document.schema.json) |

See [`README.md`](README.md) for the full folder
layout, validation example, and — most importantly — **what to update in the schema whenever
the data model or the TipTap editor's extensions change**. Keeping these schemas in sync with
the code is what makes them useful both for future clients and for an eventual integrity-check
feature (validating a notebook folder against the schema before trusting it, e.g. after a crash
or a sync conflict).

## Versioning

The format has no explicit version field yet (see "Format version" in the schema README).
`notebookStore.ts`'s `normalizeNotebooks()` backfills fields from older files, so changes so
far have stayed backward-compatible. Any breaking change should introduce an explicit
`formatVersion` field before shipping.
