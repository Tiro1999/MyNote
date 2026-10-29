import type { Entry, EntryType } from '../model'

/** An entry whose account is still a name (not yet resolved to an id). */
export type NamedEntry = Omit<Entry, 'id' | 'pos' | 'accountId'> & { accountName: string }

export interface MoneyManagerImport {
  entries: NamedEntry[]
  accountNames: string[]
  categoryPaths: string[]
  skipped: number
}

/**
 * Convert an Excel serial date (days since 1899-12-30, optional time fraction)
 * into an ISO `YYYY-MM-DD` string. The calendar date is the integer part, so we
 * floor before converting and read the UTC date to avoid timezone drift.
 */
export function excelSerialToISO(serial: string | number): string {
  const n = typeof serial === 'number' ? serial : parseFloat(serial)
  if (!Number.isFinite(n)) return ''
  // 25569 = number of days between the Excel epoch (1899-12-30) and 1970-01-01.
  const ms = (Math.floor(n) - 25569) * 86400000
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

const clean = (s: string | undefined): string => (s ?? '').trim().replace(/\//g, ' ')

/**
 * Map a MoneyManager .xlsx cell grid (first row = header) to MyNote entries.
 * Columns: 0 Datum · 1 Konto · 2 Kategorie · 3 Unterkategorie · 4 Notiz ·
 * 5 EUR · 6 Einnahmen/Ausgaben. Only `Ausgabe`/`Einkommen` rows are imported;
 * transfers (and any other type) are skipped.
 */
export function mapMoneyManager(grid: string[][]): MoneyManagerImport {
  const entries: NamedEntry[] = []
  const accountNames = new Set<string>()
  const categoryPaths = new Set<string>()
  let skipped = 0

  for (const row of grid.slice(1)) {
    const typeRaw = (row[6] ?? '').trim()
    let type: EntryType
    if (typeRaw === 'Einkommen') type = 'income'
    else if (typeRaw === 'Ausgabe') type = 'expense'
    else {
      skipped++
      continue
    }

    const date = excelSerialToISO(row[0] ?? '')
    if (!date) {
      skipped++
      continue
    }

    const accountName = (row[1] ?? '').trim()
    const kat = clean(row[2])
    const unter = clean(row[3])
    const categoryPath = kat && unter ? `${kat}/${unter}` : kat
    const amount = (row[5] ?? '0').trim().replace(',', '.')

    if (accountName) accountNames.add(accountName)
    if (categoryPath) categoryPaths.add(categoryPath)

    entries.push({
      date,
      type,
      amount,
      categoryPath,
      topic: (row[4] ?? '').trim(),
      tags: [],
      referenceLink: '',
      accountName
    })
  }

  return {
    entries,
    accountNames: [...accountNames],
    categoryPaths: [...categoryPaths],
    skipped
  }
}
