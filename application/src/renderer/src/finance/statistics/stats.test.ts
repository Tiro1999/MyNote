import { describe, it, expect } from 'vitest'
import {
  filterEntries,
  computeTotals,
  computeAccountBalances,
  breakdownByCategory,
  monthlyBuckets,
  parseStatsSettings,
  presetRange
} from './stats'
import type { Entry, Account } from '../model'

const mk = (over: Partial<Entry>): Entry => ({
  id: 'x', pos: 1, date: '2026-06-01', type: 'expense', amount: '10',
  accountId: 'a', categoryPath: '', topic: '', tags: [], referenceLink: '', ...over
})

describe('filterEntries', () => {
  const entries = [
    mk({ date: '2026-05-31', tags: ['t1'] }),
    mk({ date: '2026-06-15', tags: ['t2'] }),
    mk({ date: '2026-07-01', tags: ['t1', 't2'] })
  ]
  it('filters by inclusive date range', () => {
    const r = filterEntries(entries, { range: { from: '2026-06-01', to: '2026-06-30' } })
    expect(r.map((e) => e.date)).toEqual(['2026-06-15'])
  })
  it('filters by any-of tags', () => {
    const r = filterEntries(entries, { tags: ['t1'] })
    expect(r).toHaveLength(2)
  })
})

describe('computeTotals', () => {
  it('sums income, expense and net in cents', () => {
    const r = computeTotals([
      mk({ type: 'income', amount: '100' }),
      mk({ type: 'expense', amount: '30' }),
      mk({ type: 'expense', amount: '12.50' })
    ])
    expect(r).toEqual({ incomeCents: 10000, expenseCents: 4250, netCents: 5750 })
  })
})

describe('computeAccountBalances', () => {
  it('adds income and subtracts expense onto a negative opening balance', () => {
    const accounts: Account[] = [{ id: 'a', name: 'Giro', openingBalance: '-100' }]
    const r = computeAccountBalances(
      [mk({ accountId: 'a', type: 'income', amount: '250' }), mk({ accountId: 'a', type: 'expense', amount: '50' })],
      accounts
    )
    expect(r[0]).toMatchObject({ accountId: 'a', name: 'Giro', openingCents: -10000, flowCents: 20000, balanceCents: 10000 })
  })

  it('ignores the entries of other accounts and gives an account without entries its opening balance', () => {
    const accounts: Account[] = [
      { id: 'a', name: 'Giro', openingBalance: '10' },
      { id: 'b', name: 'Cash', openingBalance: '5.50' }
    ]
    const r = computeAccountBalances([mk({ accountId: 'a', type: 'expense', amount: '4' })], accounts)
    expect(r.map((balance) => balance.balanceCents)).toEqual([600, 550])
  })
})

describe('breakdownByCategory', () => {
  const entries = [
    mk({ type: 'expense', amount: '10', categoryPath: 'Essen/Lebensmittel' }),
    mk({ type: 'expense', amount: '5', categoryPath: 'Essen/Restaurant' }),
    mk({ type: 'expense', amount: '7', categoryPath: 'Wohnen/Miete' })
  ]
  it('groups at depth 1', () => {
    const r = breakdownByCategory(entries, 1)
    const essen = r.find((b) => b.key === 'Essen')
    expect(essen?.expenseCents).toBe(1500)
    expect(r.find((b) => b.key === 'Wohnen')?.expenseCents).toBe(700)
  })
  it('drills into a focus subtree, grouping its children', () => {
    const r = breakdownByCategory(entries, 2, 'Essen')
    expect(r.map((b) => b.key).sort()).toEqual(['Essen/Lebensmittel', 'Essen/Restaurant'])
  })

  it('keys the entries without a category by the empty string and counts them', () => {
    const r = breakdownByCategory(
      [mk({ amount: '3', categoryPath: '' }), mk({ amount: '4', categoryPath: '' }), mk({ amount: '1', categoryPath: 'Food' })],
      1
    )
    expect(r.find((bucket) => bucket.key === '')).toMatchObject({ expenseCents: 700, count: 2 })
  })

  it('does not mistake a category named like the UI label for the entries without one', () => {
    const r = breakdownByCategory([mk({ categoryPath: '(no category)' }), mk({ categoryPath: '' })], 1)
    expect(r.map((bucket) => bucket.key).sort()).toEqual(['', '(no category)'])
  })

  it('sorts by expense, highest first, and keeps the first-seen order of equal expenses', () => {
    const r = breakdownByCategory(
      [
        mk({ amount: '5', categoryPath: 'B' }),
        mk({ amount: '9', categoryPath: 'A' }),
        mk({ amount: '5', categoryPath: 'C' }),
        mk({ type: 'income', amount: '99', categoryPath: 'D' })
      ],
      1
    )
    expect(r.map((bucket) => bucket.key)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('counts income in its bucket but sorts by expense only', () => {
    const r = breakdownByCategory([mk({ type: 'income', amount: '50', categoryPath: 'Pay' })], 1)
    expect(r).toEqual([{ key: 'Pay', incomeCents: 5000, expenseCents: 0, count: 1 }])
  })

  it('gives nothing for an empty list', () => {
    expect(breakdownByCategory([], 1)).toEqual([])
  })
})

describe('monthlyBuckets', () => {
  it('groups by YYYY-MM, sums income and expense and sorts by month', () => {
    const r = monthlyBuckets([
      mk({ date: '2026-03-31', type: 'expense', amount: '10' }),
      mk({ date: '2026-01-05', type: 'income', amount: '100' }),
      mk({ date: '2026-03-01', type: 'income', amount: '20.50' }),
      mk({ date: '2026-01-31', type: 'expense', amount: '1' }),
      mk({ date: '2025-12-24', type: 'expense', amount: '7' })
    ])
    expect(r).toEqual([
      { month: '2025-12', incomeCents: 0, expenseCents: 700 },
      { month: '2026-01', incomeCents: 10000, expenseCents: 100 },
      { month: '2026-03', incomeCents: 2050, expenseCents: 1000 }
    ])
  })

  it('gives nothing for an empty list', () => {
    expect(monthlyBuckets([])).toEqual([])
  })

  it('uses the entries as given, without a second filter', () => {
    const r = monthlyBuckets([mk({ date: '1999-01-01' }), mk({ date: '2999-12-31' })])
    expect(r.map((bucket) => bucket.month)).toEqual(['1999-01', '2999-12'])
  })
})

describe('presetRange', () => {
  const custom = { from: '2026-03-02', to: '2026-04-09' }

  it('ends the month on its last real day', () => {
    expect(presetRange('month', '2026-10-28', custom)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(presetRange('month', '2026-11-05', custom)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(presetRange('month', '2026-12-31', custom)).toEqual({ from: '2026-12-01', to: '2026-12-31' })
    expect(presetRange('month', '2026-01-01', custom)).toEqual({ from: '2026-01-01', to: '2026-01-31' })
  })

  it('knows February in leap and common years', () => {
    expect(presetRange('month', '2024-02-10', custom)).toEqual({ from: '2024-02-01', to: '2024-02-29' })
    expect(presetRange('month', '2026-02-10', custom)).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(presetRange('month', '2100-02-10', custom).to).toBe('2100-02-28')
    expect(presetRange('month', '2000-02-10', custom).to).toBe('2000-02-29')
  })

  it('covers the whole year', () => {
    expect(presetRange('year', '2026-10-28', custom)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(presetRange('year', '2024-02-29', custom)).toEqual({ from: '2024-01-01', to: '2024-12-31' })
  })

  it('takes the custom range as it is', () => {
    expect(presetRange('custom', '2026-10-28', custom)).toEqual(custom)
  })

  it('leaves an empty custom bound open', () => {
    expect(presetRange('custom', '2026-10-28', { from: '', to: '' })).toEqual({ from: '0000-01-01', to: '9999-12-31' })
    expect(presetRange('custom', '2026-10-28', { from: '2026-05-01', to: '' })).toEqual({
      from: '2026-05-01',
      to: '9999-12-31'
    })
    expect(presetRange('custom', '2026-10-28', { from: '', to: '2026-05-31' })).toEqual({
      from: '0000-01-01',
      to: '2026-05-31'
    })
  })

  it('includes the first and the last day of the month when filtering', () => {
    const range = presetRange('month', '2026-02-10', custom)
    const kept = filterEntries(
      [mk({ date: '2026-01-31' }), mk({ date: '2026-02-01' }), mk({ date: '2026-02-28' }), mk({ date: '2026-03-01' })],
      { range }
    )
    expect(kept.map((entry) => entry.date)).toEqual(['2026-02-01', '2026-02-28'])
  })
})

describe('parseStatsSettings', () => {
  const stored = {
    ledgerId: 'l1',
    mode: 'category',
    from: '2026-01-01',
    to: '2026-03-31',
    categoryFocus: 'Food',
    tagFilter: ['weekly', 'shared']
  }

  it('reads the six attributes of a stored block', () => {
    expect(parseStatsSettings(stored)).toEqual(stored)
  })

  it('gives today’s defaults for a block without attributes', () => {
    expect(parseStatsSettings({})).toEqual({
      ledgerId: '',
      mode: 'overall',
      from: '',
      to: '',
      categoryFocus: '',
      tagFilter: []
    })
  })

  it('replaces a value of the wrong type by its default', () => {
    expect(
      parseStatsSettings({ ledgerId: 5, mode: 'weekly', from: null, to: {}, categoryFocus: [], tagFilter: 'a,b' })
    ).toEqual({ ledgerId: '', mode: 'overall', from: '', to: '', categoryFocus: '', tagFilter: [] })
  })

  it('drops a tag filter that is not a list of strings', () => {
    expect(parseStatsSettings({ tagFilter: ['a', 2] }).tagFilter).toEqual([])
    expect(parseStatsSettings({ tagFilter: [['a']] }).tagFilter).toEqual([])
    expect(parseStatsSettings({ tagFilter: null }).tagFilter).toEqual([])
  })

  it('keeps a hostile ledger id as text for the store to refuse', () => {
    expect(parseStatsSettings({ ledgerId: '../x' }).ledgerId).toBe('../x')
    expect(parseStatsSettings({ ledgerId: 'constructor' }).ledgerId).toBe('constructor')
  })
})
