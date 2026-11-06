export const LOCALE = 'de-DE'
export const DEFAULT_CURRENCY = '€'
// Type words of a Money Manager export; data values, not UI text
export const MONEY_MANAGER = { income: 'Einkommen', expense: 'Ausgabe' } as const

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

// An entry before the store gives it an id and a pos
export type EntryDraft = Omit<Entry, 'id' | 'pos'>

export type Align = 'left' | 'center' | 'right'

export interface NumberFormat {
  decimals: number
  thousands: boolean
  currencySymbol: string // '' = none
  symbolPosition: 'before' | 'after'
}

export interface ColumnConfig {
  align?: Align
  width?: number // px; absent = auto/default
  number?: NumberFormat
}

export interface LedgerMeta {
  name: string
  currencySymbol: string
  columns?: Record<string, ColumnConfig>
}

/** Integer cents from stored or typed text, rounded half up with string maths; unparsable text gives 0. */
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

const AMOUNT_PATTERN = /^(-?)(\d*)(?:[.,](\d+))?$/

/** Canonical dot-decimal text with two decimals, or null when the input is not a valid amount. */
export function normalizeAmount(input: string, allowNegative: boolean): string | null {
  const text = input.trim()
  const match = AMOUNT_PATTERN.exec(text)
  if (!match) return null
  const [, sign, intPart, fracPart] = match
  if (intPart === '' && fracPart === undefined) return null
  if (sign === '-' && !allowNegative) return null
  const cents = Math.abs(parseMoneyToCents(text))
  if (!Number.isSafeInteger(cents)) return null
  if (cents === 0 && !allowNegative) return null
  const rest = cents % 100
  const whole = (cents - rest) / 100
  const negative = sign === '-' && cents > 0
  return `${negative ? '-' : ''}${whole}.${String(rest).padStart(2, '0')}`
}

/** Format integer cents as "1.234,56 <symbol>" in the app locale. */
export function formatCents(cents: number, symbol: string): string {
  const amount = (cents / 100).toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return `${amount} ${symbol}`
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function parseTags(text: string): string[] {
  return text
    .split(/[,;]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

/** Local calendar date as YYYY-MM-DD. */
export function todayISO(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function splitCategoryPath(path: string): string[] {
  return path.length === 0 ? [] : path.split('/')
}

// Segments trimmed and empty ones dropped; '' = no category
export function cleanCategoryPath(path: string): string {
  return splitCategoryPath(path)
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '')
    .join('/')
}

export function categoryAtDepth(path: string, depth: number): string {
  return splitCategoryPath(path).slice(0, depth).join('/')
}

/** Every path prefix of the tree, parents before their children. */
export function flattenCategories(nodes: CategoryNode[], prefix = ''): string[] {
  return nodes.flatMap((node) => {
    const path = prefix ? `${prefix}/${node.name}` : node.name
    return [path, ...flattenCategories(node.children, path)]
  })
}
