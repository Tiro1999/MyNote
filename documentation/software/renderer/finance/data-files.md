# Finance data files

The files the finance module keeps in the notebook folder, their shape, and the checks that guard them.

Code paths without a prefix are relative to `application/src/renderer/src`.

## Layout

```text
<notebook folder>/finance/
├── accounts.json
├── categories.json
└── ledgers/
    ├── <ledgerId>.csv
    └── <ledgerId>.meta.json
```

Accounts and categories are shared by every ledger of the notebook folder; a ledger is one CSV plus one meta file. The folder `finance/` sits beside the notebook folders, so the notebook id `finance` is reserved (see [file format](../../file-format/file-format.md)). [`finance/paths.ts`](../../../../application/src/renderer/src/finance/paths.ts) is the one place that builds these paths.

| File | Holds | Check |
|---|---|---|
| `accounts.json` | list of `{ id, name, openingBalance }` | `parseAccounts` |
| `categories.json` | tree of `{ name, children }` | `parseCategories` |
| `ledgers/<id>.meta.json` | `{ name, currencySymbol, columns? }` | `parseLedgerMeta` |
| `ledgers/<id>.csv` | the entries | `loadLedgerCsv` (stored), `parseLedgerCsv` (import) |

A missing file is no error: accounts and categories read as empty lists, a missing meta as one named after the ledger id with the currency `€`, a missing CSV as an empty ledger. A file that exists but fails its check is corrupt; what then happens is in [persistence](persistence.md).

## Validation

The checks live in [`finance/validate.ts`](../../../../application/src/renderer/src/finance/validate.ts). They run when a file is read and again before every save of accounts, categories and columns, so the app never writes a file it would reject. Fields the type does not have are dropped.

| Check | Rule |
|---|---|
| Accounts | a list of records; `id` a non-empty string and not repeated, `name` and `openingBalance` strings |
| Categories | records with a string `name` and a list `children`, at most `MAX_CATEGORY_DEPTH` (32) levels; the names are not checked |
| Meta | strings `name` and `currencySymbol`; optional `columns`, a record by column id |
| Column | `align` is `left`, `center` or `right`; `width` a number above 0; `number` with `decimals`, `thousands`, `currencySymbol`, `symbolPosition` (`before` or `after`) |
| `decimals` | `parseLedgerMeta` cuts a finite number to a whole number from 0 to 20 (`clampDecimals`); a non-number makes the file corrupt |

The check accepts `number` under any column id; the ledger draws it for the `amount` column only (`resolveColumn`). The column ids are `date`, `type`, `amount`, `account`, `category`, `topic`, `tags`; they differ from the CSV header names. A column id is stored as an own key, so `__proto__` cannot change a prototype. Keys that old files carry under a column (`type`, `date`) are ignored.

## Ledger CSV

[`finance/csv.ts`](../../../../application/src/renderer/src/finance/csv.ts) is the generic RFC 4180 codec (comma, double-quote quoting, rows joined by CRLF); [`finance/ledgerCsv.ts`](../../../../application/src/renderer/src/finance/ledgerCsv.ts) maps the rows. The header and every row have these 10 cells:

| Cell | Content |
|---|---|
| `id` | entry id (`newId()`) |
| `pos` | running number; a new entry gets the highest finite `pos` plus 1 (`nextPos`) |
| `date` | `YYYY-MM-DD` |
| `type` | `income` or `expense` |
| `amount` | amount text, canonical for entries written by this version (below) |
| `accountId` | id of an account in `accounts.json`, kept as text |
| `categoryPath` | levels separated by `/`, e.g. `Food/Groceries`; empty means no category |
| `topic` | free text |
| `tags` | tags joined with `;` |
| `referenceLink` | file path of a receipt |

A stored ledger loads leniently, an import is strict; both are described in [persistence](persistence.md) and [import and export](import-export.drawio.svg). Because v0.1.x never normalized amounts, a stored amount may still read `12,5`; only entries written by v0.2.0 or later are canonical.

## Money model

[`finance/model.ts`](../../../../application/src/renderer/src/finance/model.ts) holds the types and the money maths.

- **Canonical amount.** `normalizeAmount(input, allowNegative)` returns dot-decimal text with two decimals (`12.50`, `-3.00`) or `null`. It accepts one `.` or `,` as decimal separator and no thousands grouping (`1.234,56` is rejected, not guessed), rounds half up on the text, and builds the result from integer cents, so there is no float artefact and no `-0.00`. Zero is valid only with `allowNegative` (an opening balance may be 0, an entry may not); a value beyond the safe integer range gives `null`.
- **Cents.** `parseMoneyToCents` is the lenient reader of stored text; unparsable text gives 0. Totals and balances add integer cents; `formatCents` shows them in the `de-DE` locale with the ledger's `currencySymbol` (`DEFAULT_CURRENCY` is `€`).
- **Balance.** An account's balance is its `openingBalance` plus income minus expense of the entries that carry its id. An entry whose `accountId` is no account counts in no balance.
- **Categories.** `cleanCategoryPath` trims every segment and drops empty ones (`' Food / Groceries '` becomes `Food/Groceries`); import and `mergeCategoryPaths` both use it. `flattenCategories` lists every path prefix of the tree.
- **Dates.** `todayISO` uses the local date; `toISOString` would give the UTC day, which is yesterday after local midnight in CET.

## Ids

A ledger id comes from the page JSON, so it becomes part of a path only through `checkLedgerId`, which throws `Invalid ledger id` (followed by the id) unless it passes `isValidId` (`/^[A-Za-z0-9_-]{1,64}$/`). Folder and file names ignore case on Windows and macOS, so two ids that differ only in case name the same files.

`ledgerOf(ledgers, id)` looks a ledger up with `Object.hasOwn`, because `constructor` is a valid id and a plain lookup would return the prototype. Listing the ledgers (`ledgerIdOfMetaFile`) keeps the files in `ledgers/` whose name is a valid id plus `.meta.json`.
