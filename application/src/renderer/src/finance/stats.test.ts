import { describe, it, expect } from 'vitest'
import {
  filterEntries,
  computeTotals,
  computeAccountSaldos,
  breakdownByCategory
} from './stats'
import type { Entry, Account } from './model'

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

describe('computeAccountSaldos', () => {
  it('adds income and subtracts expense onto a negative opening balance', () => {
    const accounts: Account[] = [{ id: 'a', name: 'Giro', openingBalance: '-100' }]
    const r = computeAccountSaldos(
      [mk({ accountId: 'a', type: 'income', amount: '250' }), mk({ accountId: 'a', type: 'expense', amount: '50' })],
      accounts
    )
    expect(r[0]).toMatchObject({ accountId: 'a', name: 'Giro', openingCents: -10000, flowCents: 20000, saldoCents: 10000 })
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
})
