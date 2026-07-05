import type { Account, Entry } from './model'
import { parseMoneyToCents, categoryAtDepth, splitCategoryPath } from './model'

export interface DateRange {
  from: string
  to: string
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

export interface AccountSaldo {
  accountId: string
  name: string
  openingCents: number
  flowCents: number
  saldoCents: number
}

export function computeAccountSaldos(entries: Entry[], accounts: Account[]): AccountSaldo[] {
  return accounts.map((acc) => {
    const opening = parseMoneyToCents(acc.openingBalance)
    let flow = 0
    for (const e of entries) {
      if (e.accountId !== acc.id) continue
      const cents = parseMoneyToCents(e.amount)
      flow += e.type === 'income' ? cents : -cents
    }
    return {
      accountId: acc.id,
      name: acc.name,
      openingCents: opening,
      flowCents: flow,
      saldoCents: opening + flow
    }
  })
}

export interface CategoryBucket {
  key: string
  incomeCents: number
  expenseCents: number
  count: number
}

/**
 * Group entries by category key. Without `focusPath`, keys are the top-`depth`
 * path. With `focusPath`, only entries under that path are grouped, keyed at
 * `depth` (one level deeper than the focus).
 */
export function breakdownByCategory(
  entries: Entry[],
  depth: number,
  focusPath?: string
): CategoryBucket[] {
  const buckets = new Map<string, CategoryBucket>()
  for (const e of entries) {
    if (focusPath) {
      const segs = splitCategoryPath(e.categoryPath)
      const focus = splitCategoryPath(focusPath)
      const underFocus = focus.every((seg, idx) => segs[idx] === seg) && segs.length >= focus.length
      if (!underFocus) continue
    }
    const key = categoryAtDepth(e.categoryPath, depth) || '(ohne Kategorie)'
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

export function monthlyBuckets(entries: Entry[], range: DateRange): MonthBucket[] {
  const buckets = new Map<string, MonthBucket>()
  for (const e of filterEntries(entries, { range })) {
    const month = e.date.slice(0, 7) // YYYY-MM
    const b = buckets.get(month) ?? { month, incomeCents: 0, expenseCents: 0 }
    const cents = parseMoneyToCents(e.amount)
    if (e.type === 'income') b.incomeCents += cents
    else b.expenseCents += cents
    buckets.set(month, b)
  }
  return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month))
}
