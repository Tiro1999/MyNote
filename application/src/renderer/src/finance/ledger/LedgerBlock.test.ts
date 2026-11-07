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

import LedgerBlock from './LedgerBlock'

const accounts: Account[] = [{ id: 'a1', name: 'Cash', openingBalance: '100.00' }]

const entry = (pos: number, over: Partial<Entry> = {}): Entry => ({
  id: `e${pos}`,
  pos,
  date: '2026-03-04',
  type: 'expense',
  amount: '12.50',
  accountId: 'a1',
  categoryPath: '',
  topic: `Topic ${pos}`,
  tags: [],
  referenceLink: '',
  ...over
})

const ledger = (over: Partial<LedgerState> = {}): LedgerState => ({
  meta: { name: 'Home', currencySymbol: '€' },
  entries: [entry(1), entry(2)],
  saveError: null,
  loadError: null,
  ...over
})

function renderAttrs(attrs: Record<string, unknown>): string {
  const props = { node: { attrs }, deleteNode: vi.fn() } as unknown as NodeViewProps
  return renderToString(createElement(LedgerBlock, props))
}

const render = (ledgerId = 'l1'): string => renderAttrs({ ledgerId })

// Text of the markup: no tags, no React comment markers, entities decoded
const textOf = (html: string): string =>
  html
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')

const setLedgers = (ledgers: Record<string, LedgerState>, over: Partial<{ accounts: Account[] }> = {}): void =>
  useFinanceStore.setState({ ledgers, accounts, ...over })

const buttonLabels = (html: string): string[] =>
  [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((match) => match[1])

beforeEach(() => {
  useFinanceStore.setState(useFinanceStore.getInitialState(), true)
})

afterEach(() => {
  useFinanceStore.setState(useFinanceStore.getInitialState(), true)
})

describe('LedgerBlock with a readable ledger', () => {
  it('shows the name, the id, the toolbar and the table with the entries newest first', () => {
    setLedgers({ l1: ledger() })
    const html = render()
    const text = textOf(html)
    expect(text).toContain('Home #l1')
    expect(buttonLabels(html)).toEqual(expect.arrayContaining(['Import', 'Export', 'Reference data', 'Delete']))
    expect(html).toContain('<table')
    expect(html.indexOf('Topic 2')).toBeGreaterThan(-1)
    expect(html.indexOf('Topic 2')).toBeLessThan(html.indexOf('Topic 1'))
  })

  it('has the column headers, the draft row and the add button', () => {
    setLedgers({ l1: ledger() })
    const html = render()
    for (const label of ['Date', 'Type', 'Amount', 'Account', 'Category', 'Topic', 'Tags']) {
      expect(textOf(html)).toContain(`${label} ▾`)
    }
    expect(html).toContain('title="Configure column"')
    expect(html).toContain('placeholder="Topic"')
    expect(textOf(html)).toContain('+ Add entry')
  })

  it('shows the balance of each account below the table', () => {
    setLedgers({ l1: ledger() })
    expect(textOf(render())).toContain('Cash: 75,00 €')
  })

  it('shows no error box', () => {
    setLedgers({ l1: ledger() })
    expect(render()).not.toContain('role="alert"')
  })

  it('shows 50 rows and the pager for a long ledger', () => {
    const entries = Array.from({ length: 120 }, (_, index) => entry(index + 1))
    setLedgers({ l1: ledger({ entries }) })
    const html = render()
    expect(textOf(html)).toContain('Page 1/3 · 120 rows')
    expect(html.match(/aria-label="Delete entry"/g)).toHaveLength(50)
  })

  it('shows no pager for a short ledger', () => {
    setLedgers({ l1: ledger() })
    expect(textOf(render())).not.toContain('Page 1')
  })

  it('hints at the missing accounts', () => {
    setLedgers({ l1: ledger() }, { accounts: [] })
    expect(textOf(render())).toContain(
      'No accounts yet. Add some under "Reference data", then entries can be assigned to an account.'
    )
  })

  it('shows an entry with an unknown account as deleted', () => {
    setLedgers({ l1: ledger({ entries: [entry(1, { accountId: 'gone' })] }) })
    expect(textOf(render())).toContain('(deleted account)')
  })

  it('names no German word', () => {
    setLedgers({ l1: ledger() }, { accounts: [] })
    expect(textOf(render())).not.toMatch(
      /Ausgabe|Einnahme|Konto|Konten|Kategorie|Buchung|Beleg|Seite|Zeilen|Spalte|löschen|Noch keine/
    )
  })
})

describe('LedgerBlock with a ledger that could not be read', () => {
  const unreadable = ledger({ entries: [], loadError: 'finance/ledgers/l1.meta.json: Unexpected token' })

  it('shows one red box with the message and no editable table', () => {
    setLedgers({ l1: unreadable })
    const html = render()
    const text = textOf(html)
    expect(html.match(/role="alert"/g)).toHaveLength(1)
    expect(text).toContain('finance/ledgers/l1.meta.json: Unexpected token')
    expect(text).toContain('This ledger was not changed.')
    expect(html).not.toContain('<table')
    expect(html).not.toContain('<input')
    expect(html).not.toContain('<select')
    expect(text).not.toContain('+ Add entry')
  })

  it('keeps only Delete in the toolbar, so the user can remove the block', () => {
    setLedgers({ l1: unreadable })
    expect(buttonLabels(render())).toEqual(['Delete'])
  })
})

describe('LedgerBlock with a hostile or empty ledger id', () => {
  it.each(['../x', '', 'a/b', '..', 'x\\y'])('shows the error box for %j and does not throw', async (id) => {
    await useFinanceStore.getState().loadLedger(id)
    const html = render(id)
    expect(html).toContain('role="alert"')
    expect(textOf(html)).toContain('Invalid ledger id')
    expect(html).not.toContain('<table')
    expect(buttonLabels(html)).toEqual(['Delete'])
  })

  it.each([undefined, null, 5, { a: 1 }])('treats the attribute %j like an empty id', async (value) => {
    await useFinanceStore.getState().loadLedger('')
    const html = renderAttrs({ ledgerId: value })
    expect(html).toContain('role="alert"')
    expect(html).not.toContain('<table')
  })

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'does not mistake the id %s for a loaded ledger',
    (id) => {
      const html = render(id)
      expect(html).not.toContain('<table')
      expect(textOf(html)).toContain(`#${id}`)
      expect(textOf(html)).toContain('Loading')
    }
  )
})

describe('LedgerBlock while the ledger loads', () => {
  it('shows a loading line, no table and only Delete', () => {
    const html = render('l1')
    expect(textOf(html)).toContain('Loading ledger…')
    expect(html).not.toContain('<table')
    expect(buttonLabels(html)).toEqual(['Delete'])
  })
})

describe('LedgerBlock with a failed write', () => {
  it('shows "Not saved" above the table and keeps the data on screen', () => {
    setLedgers({ l1: ledger({ saveError: 'EBUSY: resource busy or locked' }) })
    const html = render()
    expect(textOf(html)).toContain('Not saved: EBUSY: resource busy or locked')
    expect(html.indexOf('Not saved')).toBeLessThan(html.indexOf('<table'))
    expect(html).toContain('Topic 1')
    expect(html).toContain('<input')
  })

  it('shows the box until the next successful write clears the error', () => {
    setLedgers({ l1: ledger({ saveError: 'EBUSY' }) })
    expect(textOf(render())).toContain('Not saved: EBUSY')
    setLedgers({ l1: ledger({ saveError: null }) })
    expect(textOf(render())).not.toContain('Not saved')
  })
})

describe('LedgerBlock with reference data that could not be read', () => {
  it('shows the message and locks the account and category pickers', () => {
    setLedgers({ l1: ledger() }, { accounts: [] })
    useFinanceStore.setState({ referenceError: 'finance/accounts.json: Unexpected token' })
    const html = render()
    expect(textOf(html)).toContain(
      'Accounts and categories could not be read: finance/accounts.json: Unexpected token. They are not changed.'
    )
    expect(html).toContain('<table')
    expect(html.match(/<select[^>]*disabled=""/g)?.length).toBeGreaterThan(0)
    expect(textOf(html)).not.toContain('No accounts yet')
  })

  it('shows the account of every entry as unavailable instead of deleted', () => {
    setLedgers({ l1: ledger({ entries: [entry(1, { accountId: 'a1' }), entry(2, { accountId: 'gone' })] }) }, { accounts: [] })
    useFinanceStore.setState({ referenceError: 'finance/accounts.json: Unexpected token' })
    const text = textOf(render())
    expect(text).toContain('(unavailable)')
    expect(text).not.toContain('(deleted account)')
  })

  it('shows the reference box next to the ledger box when the ledger is unreadable too', () => {
    setLedgers({ l1: ledger({ entries: [], loadError: 'broken' }) })
    useFinanceStore.setState({ referenceError: 'also broken' })
    expect(render().match(/role="alert"/g)).toHaveLength(2)
  })
})
