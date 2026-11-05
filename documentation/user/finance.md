# Finance: ledgers and statistics

How to use the optional finance module: ledger blocks, reference data, import and export, and statistics. Start with [Getting started](getting-started.md).

Type `/` and choose **Ledger (income and expenses)** to insert a ledger block, or **Statistics** to insert an evaluation of one. A ledger is stored in the notebook folder under `finance/`, not in the page, and accounts and categories are shared by all ledgers of the folder.

## The ledger block

The title shows the ledger name and its id. The toolbar has **Import**, **Export**, **Reference data** and **Delete**. The table has the columns Date, Type (Expense/Income), Amount, Account, Category, Topic and Tags, a receipt button (🔗, 📎 once a file is linked) and ✕ to delete an entry. The most recently added entry is on top; above 100 entries the table shows 50 per page with « ‹ › » buttons. Under the table, each account shows its balance: opening balance plus income minus expenses.

To add an entry, fill the row at the bottom and click **+ Add entry**. It needs an amount above 0 and an account; otherwise a hint says what is missing. The receipt button picks a PDF, PNG or JPEG file and stores its path with the entry.

Click a column title to **Configure column**: alignment, **Auto width** and, for Amount, the decimals (0–4), the thousands separator, the currency symbol and its position. Drag the right edge of a title to resize the column.

## Amounts

- Type a plain number with a dot as decimal separator, such as `12.50`; a comma works as well. No thousands separators, no currency symbol. MyNote rounds to cents and stores `12.50`; the table shows it in the column format, by default `1.234,50 €`.
- An entry amount must be above 0 (the type says income or expense). An opening balance may be negative.
- A text that is not an amount stays in the field with a red message, for example "Enter an amount above 0, e.g. 12.50", and nothing is saved. Fix it, or press Escape to go back to the stored value. In **Reference data**, **Save** waits until no opening balance holds such a text.

## Reference data

**Reference data** opens a dialog for the accounts (name and opening balance) and the categories (up to four levels: **+ Main category**, **+ Subcategory**). **Save** writes both lists. Rows with an empty name are dropped, a `/` is removed from category names, and a nameless category with subcategories is refused with "A category needs a name.".

## Import and export

**Import** asks for the **Source** and then for a file; the result reads "N entries imported · M skipped · A accounts and C categories created."

| Source | Notes |
|--------|-------|
| Money Manager (.xlsx) | The German export, first sheet. It creates the accounts (opening balance 0) and categories it needs. Transfers and invalid rows are skipped |
| MyNote (.csv) | A file exported by MyNote: it must have the exact header, otherwise "This is not a MyNote ledger CSV". Rows with an invalid date, type or amount are skipped. The CSV holds account ids, not names, so an id that does not exist in this notebook folder shows "(deleted account)" and counts in no balance |

A file may be up to 10 MB. Importing the same file twice adds its entries twice. A failed import shows a red box with the reason.

**Export** saves all entries as CSV; the save dialog suggests the ledger name and id as the file name. Text is written as it is, including receipt paths; a spreadsheet reads text that starts with `=`, `+`, `-` or `@` as a formula, so check a file from someone else before opening it. To import a file again after Excel opened it, save it as "CSV UTF-8 (comma delimited)": a file with `;` separators is refused.

## Statistics

Choose the **Ledger**, the **View** (Overall or Category) and the **Period** (This month, This year, or Custom range… with From and To). Overall shows income, expenses and net with a donut chart, the balance of each account, the biggest categories and the net per month. Category shows a pie, bars and a table (Category, Expenses, Count, Avg) for the category you pick. The block only reads; it cannot delete a ledger.

## Errors

A red **Not saved: …** box above the table means the last write failed, for example because Excel holds the CSV open. The change stays in the app and the file on disk is unchanged; the next successful write clears the box ([details](network-storage.md#when-a-save-fails)). Other red boxes say that a ledger or the reference data could not be read; they stay unchanged until the file is fixed.

## Delete

**Delete** in the toolbar of a ledger block is the only place that deletes a ledger. It asks for confirmation before it deletes the ledger and its data file permanently. A block without a valid ledger id has no file; **Delete** then opens the dialog "Remove block" with the button **Remove**, which only takes the block out of the page. Removing a ledger block any other way, by deleting the text, the text box or the page, leaves the ledger's files in `finance/ledgers/` and the Statistics block can still list it.
