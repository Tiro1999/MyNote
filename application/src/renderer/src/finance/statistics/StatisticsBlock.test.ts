import { readFileSync } from 'node:fs'
import { createElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import type { NodeViewProps } from '@tiptap/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account, Entry } from '../model'
import { useFinanceStore, type LedgerState } from '../store'

vi.mock('../store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store')>()
  const { liveStore } = await import('../store.testing')
  return { ...actual, useFinanceStore: liveStore(actual.useFinanceStore) }
})

vi.mock('@tiptap/react', async () => {
  const { createElement: h } = await import('react')
  return { NodeViewWrapper: ({ children }: { children: ReactNode }) => h('div', { 'data-view': '' }, children) }
})

import StatisticsBlock from './StatisticsBlock'

const accounts: Account[] = [{ id: 'a1', name: 'Cash', openingBalance: '100.00' }]

const entry = (pos: number, over: Partial<Entry> = {}): Entry => ({
  id: `e${pos}`,
  pos,
  date: '2026-10-05',
  type: 'expense',
  amount: '10.00',
  accountId: 'a1',
  categoryPath: '',
  topic: '',
  tags: [],
  referenceLink: '',
  ...over
})

const ledger = (entries: Entry[], over: Partial<LedgerState> = {}): LedgerState => ({
  meta: { name: 'Home', currencySymbol: '€' },
  entries,
  saveError: null,
  loadError: null,
  ...over
})

const october = [
  entry(1, { type: 'income', amount: '1000.00', date: '2026-10-01', categoryPath: 'Pay' }),
  entry(2, { amount: '250.50', date: '2026-10-10', categoryPath: 'Food/Groceries', tags: ['t1'] }),
  entry(3, { amount: '49.50', date: '2026-10-12', categoryPath: 'Food/Restaurant', tags: ['t2'] }),
  entry(4, { amount: '20.00', date: '2026-10-20', categoryPath: '' }),
  entry(5, { amount: '99.00', date: '2026-09-30', categoryPath: 'Food/Groceries' })
]

function renderAttrs(attrs: Record<string, unknown>): string {
  const props = { node: { attrs }, updateAttributes: vi.fn() } as unknown as NodeViewProps
  return renderToString(createElement(StatisticsBlock, props))
}

const render = (over: Record<string, unknown> = {}): string => renderAttrs({ ledgerId: 'l1', ...over })

const textOf = (html: string): string =>
  html
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')

const optionValues = (html: string): string[] => [...html.matchAll(/<option value="([^"]*)"/g)].map((match) => match[1])

const setLedgers = (ledgers: Record<string, LedgerState>, over: Partial<{ accounts: Account[] }> = {}): void =>
  useFinanceStore.setState({ ledgers, accounts, ...over })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 28, 12))
  useFinanceStore.setState(useFinanceStore.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
  useFinanceStore.setState(useFinanceStore.getInitialState(), true)
})

describe('StatisticsBlock without a ledger', () => {
  it('asks for a ledger and offers the placeholder option', () => {
    const html = renderAttrs({})
    expect(textOf(html)).toContain('No ledger selected.')
    expect(html).toContain('Choose ledger…')
    expect(html).not.toContain('role="alert"')
  })

  it('treats an attribute that is no string like an empty id', () => {
    for (const value of [undefined, null, 5, { a: 1 }, ['l1']]) {
      const html = renderAttrs({ ledgerId: value })
      expect(textOf(html)).toContain('No ledger selected.')
    }
  })

  it('offers the Overall and Category views and the three periods', () => {
    const text = textOf(renderAttrs({}))
    for (const label of ['Overall', 'Category', 'This month', 'This year', 'Custom range…']) {
      expect(text).toContain(label)
    }
  })
})

describe('StatisticsBlock overall view', () => {
  beforeEach(() => setLedgers({ l1: ledger(october) }))

  it('sums the entries of this month: income, expenses and net', () => {
    const text = textOf(render())
    expect(text).toMatch(/Income\s+1\.000,00 €/)
    expect(text).toMatch(/Expenses\s+320,00 €/)
    expect(text).toMatch(/Net\s+680,00 €/)
  })

  it('leaves out the entries of other months', () => {
    expect(textOf(render())).not.toContain('419,00')
  })

  it('shows the balance of each account from the entries of the period', () => {
    expect(textOf(render())).toContain('Cash: 780,00 €')
  })

  it('draws the donut, the bars and the trend', () => {
    const html = render()
    expect(html).toContain('aria-label="Income versus expenses"')
    expect(html).toContain('aria-label="Trend"')
    expect(textOf(html)).toContain('Food')
  })

  it('names the entries without a category with the label and not with an empty text', () => {
    expect(textOf(render())).toContain('(no category)')
  })

  it('shows No data for a ledger without entries', () => {
    setLedgers({ l1: ledger([]) })
    const text = textOf(render())
    expect(text).toContain('No data')
    expect(text).toMatch(/Income\s+0,00 €/)
  })

  it('keeps only the entries with one of the tags of the tag filter', () => {
    const text = textOf(render({ tagFilter: ['t1'] }))
    expect(text).toMatch(/Expenses\s+250,50 €/)
    expect(text).toMatch(/Income\s+0,00 €/)
  })

  it('does not throw for a tag filter that is no list', () => {
    for (const value of ['t1', 5, { a: 1 }, ['t1', 2], null]) {
      expect(() => render({ tagFilter: value })).not.toThrow()
      expect(textOf(render({ tagFilter: value }))).toMatch(/Expenses\s+320,00 €/)
    }
  })

  it('shows the overall view for a mode it does not know', () => {
    expect(textOf(render({ mode: 'weekly' }))).toMatch(/Net\s+680,00 €/)
  })

  it('uses the currency symbol of the ledger', () => {
    setLedgers({ l1: ledger(october, { meta: { name: 'Home', currencySymbol: '$' } }) })
    expect(textOf(render())).toMatch(/Income\s+1\.000,00 \$/)
  })
})

describe('StatisticsBlock category view', () => {
  beforeEach(() => setLedgers({ l1: ledger(october) }))

  it('lists the main categories with the table headers', () => {
    const html = render({ mode: 'category' })
    const text = textOf(html)
    expect(text).toContain('All main categories')
    for (const header of ['Category', 'Expenses', 'Count', 'Avg']) expect(text).toContain(header)
    expect(html).toContain('aria-label="Pie chart"')
    expect(text).toMatch(/Food\s+300,00 €\s+2\s+150,00 €/)
  })

  it('drills into the focused category', () => {
    const text = textOf(render({ mode: 'category', categoryFocus: 'Food' }))
    expect(text).toContain('Food/Groceries')
    expect(text).toContain('Food/Restaurant')
    expect(text).not.toContain('(no category)')
  })

  it('offers the paths of the entries as focus', () => {
    const values = optionValues(render({ mode: 'category' }))
    expect(values).toEqual(expect.arrayContaining(['Pay', 'Food/Groceries', 'Food/Restaurant']))
    expect(values).not.toContain('(no category)')
  })
})

describe('StatisticsBlock errors', () => {
  it('shows the load error of the ledger in a red box and no figures', () => {
    setLedgers({ l1: ledger([], { loadError: 'finance/ledgers/l1.meta.json: Unexpected token' }) })
    const html = render()
    expect(html.match(/role="alert"/g)).toHaveLength(1)
    expect(textOf(html)).toContain(
      'This ledger could not be read: finance/ledgers/l1.meta.json: Unexpected token'
    )
    expect(textOf(html)).not.toContain('Income')
    expect(textOf(html)).not.toContain('No data')
  })

  it('shows the reference error and leaves out the balances', () => {
    setLedgers({ l1: ledger(october) })
    useFinanceStore.setState({ referenceError: 'finance/accounts.json: Unexpected token' })
    const html = render()
    expect(textOf(html)).toContain('Accounts could not be read: finance/accounts.json: Unexpected token')
    expect(textOf(html)).toMatch(/Income\s+1\.000,00 €/)
    expect(textOf(html)).not.toContain('Cash:')
  })

  it('shows both boxes when the ledger and the reference data are unreadable', () => {
    setLedgers({ l1: ledger([], { loadError: 'broken' }) })
    useFinanceStore.setState({ referenceError: 'also broken' })
    expect(render().match(/role="alert"/g)).toHaveLength(2)
  })

  it.each(['../x', 'a/b', '..', 'x\\y', 'a'.repeat(65)])('shows the error box for the id %j and does not throw', async (id) => {
    await useFinanceStore.getState().loadLedger(id)
    const html = render({ ledgerId: id })
    expect(html).toContain('role="alert"')
    expect(textOf(html)).toContain('This ledger could not be read: Invalid ledger id')
    expect(textOf(html)).not.toContain('Income')
  })

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'does not mistake the id %s for a loaded ledger',
    (id) => {
      const html = render({ ledgerId: id })
      expect(textOf(html)).toContain('Loading ledger…')
      expect(textOf(html)).not.toContain('Income')
    }
  )

  it('shows a loading line while the ledger loads', () => {
    expect(textOf(render())).toContain('Loading ledger…')
  })
})

describe('StatisticsBlock ledger choice', () => {
  it('keeps the bound ledger selectable before the list is there', () => {
    setLedgers({ l1: ledger(october) })
    const html = render()
    expect(html).toMatch(/<option value="l1"[^>]*selected/)
    expect(textOf(html)).toContain('Home #l1')
  })

  it('offers only the placeholder for an empty id before the list is there', () => {
    expect(optionValues(renderAttrs({})).filter((value) => value === '')).toHaveLength(1)
  })
})

describe('StatisticsBlock cannot delete a ledger', () => {
  it('has no button in any view', () => {
    setLedgers({ l1: ledger(october) })
    expect(render()).not.toContain('<button')
    expect(render({ mode: 'category' })).not.toContain('<button')
    expect(renderAttrs({})).not.toContain('<button')
  })

  it('does not ask the store to delete and does not use the browser dialogs', () => {
    const source = readFileSync(new URL('./StatisticsBlock.tsx', import.meta.url), 'utf8')
    expect(source).not.toMatch(/deleteLedger|window\.confirm|confirm\(|🗑/)
  })
})

describe('StatisticsBlock language', () => {
  it('shows no German word', () => {
    setLedgers({ l1: ledger(october) })
    for (const mode of ['overall', 'category']) {
      expect(textOf(render({ mode }))).not.toMatch(
        /Einnahmen|Ausgaben|Netto|Gesamt|Kategorie|Quelle|Keine Daten|Anzahl|Dieses?\s|Zeitraum|Saldo/
      )
    }
  })
})
