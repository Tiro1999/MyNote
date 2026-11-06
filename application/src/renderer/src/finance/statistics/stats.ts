import type { Account, Entry } from '../model'
import { categoryAtDepth, isStringArray, parseMoneyToCents, splitCategoryPath } from '../model'

export interface DateRange {
  from: string
  to: string
}

export type Preset = 'month' | 'year' | 'custom'

// today is an ISO date (YYYY-MM-DD); an empty custom bound leaves that side open
export function presetRange(preset: Preset, today: string, custom: DateRange): DateRange {
  const year = today.slice(0, 4)
  if (preset === 'year') return { from: `${year}-01-01`, to: `${year}-12-31` }
  if (preset === 'month') {
    const month = today.slice(5, 7)
    // Day 0 of the next month is the last day of this one
    const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()
    return { from: `${year}-${month}-01`, to: `${year}-${month}-${String(lastDay).padStart(2, '0')}` }
  }
  return { from: custom.from || '0000-01-01', to: custom.to || '9999-12-31' }
}

export function filterEntries(
  entries: Entry[],
  opts: { range?: DateRange; tags?: string[] }
): Entry[] {
  return entries.filter((e) => {
    if (opts.range && (e.date < opts.range.from || e.date > opts.range.to)) return false
    if (opts.tags && opts.tags.length > 0 && !opts.tags.some((t) => e.tags.includes(t))) return false
    return true
  })
}

export interface Totals {
  incomeCents: number
  expenseCents: number
  netCents: number
}

export function computeTotals(entries: Entry[]): Totals {
  let incomeCents = 0
  let expenseCents = 0
  for (const e of entries) {
    const cents = parseMoneyToCents(e.amount)
    if (e.type === 'income') incomeCents += cents
    else expenseCents += cents
  }
  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents }
}

export interface AccountBalance {
  accountId: string
  name: string
  balanceCents: number
}

export function computeAccountBalances(entries: Entry[], accounts: Account[]): AccountBalance[] {
  return accounts.map((acc) => {
    let balanceCents = parseMoneyToCents(acc.openingBalance)
    for (const e of entries) {
      if (e.accountId !== acc.id) continue
      const cents = parseMoneyToCents(e.amount)
      balanceCents += e.type === 'income' ? cents : -cents
    }
    return { accountId: acc.id, name: acc.name, balanceCents }
  })
}

export interface CategoryBucket {
  key: string
  incomeCents: number
  expenseCents: number
  count: number
}

// See documentation/software/renderer/finance/statistics.drawio.svg
export function breakdownByCategory(
  entries: Entry[],
  depth: number,
  focusPath?: string
): CategoryBucket[] {
  const focus = splitCategoryPath(focusPath ?? '')
  const buckets = new Map<string, CategoryBucket>()
  for (const e of entries) {
    if (focus.length > 0) {
      const segs = splitCategoryPath(e.categoryPath)
      if (segs.length < focus.length || !focus.every((seg, idx) => segs[idx] === seg)) continue
    }
    const key = categoryAtDepth(e.categoryPath, depth) // '' = no category
    const b = buckets.get(key) ?? { key, incomeCents: 0, expenseCents: 0, count: 0 }
    const cents = parseMoneyToCents(e.amount)
    if (e.type === 'income') b.incomeCents += cents
    else b.expenseCents += cents
    b.count += 1
    buckets.set(key, b)
  }
  return [...buckets.values()].sort((a, b) => b.expenseCents - a.expenseCents)
}

export interface MonthBucket {
  month: string
  incomeCents: number
  expenseCents: number
}

export function monthlyBuckets(entries: Entry[]): MonthBucket[] {
  const buckets = new Map<string, MonthBucket>()
  for (const e of entries) {
    const month = e.date.slice(0, 7) // YYYY-MM
    const b = buckets.get(month) ?? { month, incomeCents: 0, expenseCents: 0 }
    const cents = parseMoneyToCents(e.amount)
    if (e.type === 'income') b.incomeCents += cents
    else b.expenseCents += cents
    buckets.set(month, b)
  }
  return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month))
}

export interface StatsSettings {
  ledgerId: string
  mode: 'overall' | 'category'
  from: string
  to: string
  categoryFocus: string
  tagFilter: string[]
}

const textOrEmpty = (value: unknown): string => (typeof value === 'string' ? value : '')

// A pasted or hand-edited page can carry anything as an attribute; this gives the types the block relies on
export function parseStatsSettings(attrs: Record<string, unknown>): StatsSettings {
  return {
    ledgerId: textOrEmpty(attrs.ledgerId),
    mode: attrs.mode === 'category' ? 'category' : 'overall',
    from: textOrEmpty(attrs.from),
    to: textOrEmpty(attrs.to),
    categoryFocus: textOrEmpty(attrs.categoryFocus),
    tagFilter: isStringArray(attrs.tagFilter) ? attrs.tagFilter : []
  }
}
