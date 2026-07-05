export interface Account {
  id: string
  name: string
  /** Canonical dot-decimal string; may be negative. */
  openingBalance: string
}

export interface CategoryNode {
  name: string
  children: CategoryNode[]
}

export type EntryType = 'income' | 'expense'

export interface Entry {
  id: string
  pos: number
  /** ISO YYYY-MM-DD */
  date: string
  type: EntryType
  /** Canonical dot-decimal string, > 0. */
  amount: string
  accountId: string
  /** e.g. "Essen/Lebensmittel"; empty = uncategorized. */
  categoryPath: string
  topic: string
  tags: string[]
  referenceLink: string
}

export interface LedgerMeta {
  name: string
  currencySymbol: string
}

/**
 * Parse a user/stored decimal (dot or comma) into integer cents, rounded to the
 * nearest cent. Parses via string rather than `value * 100` to avoid IEEE-754
 * errors (e.g. `1.005 * 100 === 100.4999…` would truncate to 100, not 101).
 */
export function parseMoneyToCents(input: string): number {
  const match = input.trim().replace(',', '.').match(/^(-?)(\d*)(?:\.(\d+))?$/)
  if (!match) return 0
  const [, sign, intPart, fracPart = ''] = match
  const whole = Number(intPart || '0')
  const centsFrac = Number((fracPart + '00').slice(0, 2))
  const roundUp = fracPart.length > 2 && Number(fracPart[2]) >= 5 ? 1 : 0
  const cents = whole * 100 + centsFrac + roundUp
  return sign === '-' ? -cents : cents
}

/** Format integer cents as "1.234,56 <symbol>" (de-DE grouping). */
export function formatCents(cents: number, symbol: string): string {
  const amount = (cents / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return `${amount} ${symbol}`
}

export function splitCategoryPath(path: string): string[] {
  return path.length === 0 ? [] : path.split('/')
}

export function categoryAtDepth(path: string, depth: number): string {
  return splitCategoryPath(path).slice(0, depth).join('/')
}
