import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Account, EntryDraft } from '../model'
import CommitInput from './CommitInput'
import EntryCells from './EntryCells'
import type { ColumnConfig } from './columns'

type Props = Parameters<typeof EntryCells>[0]

const accounts: Account[] = [
  { id: 'a1', name: 'Cash', openingBalance: '0' },
  { id: 'a2', name: 'Bank', openingBalance: '0' }
]

const entry: EntryDraft = {
  date: '2026-03-04',
  type: 'income',
  amount: '1234.5',
  accountId: 'a1',
  categoryPath: 'Food',
  topic: 'Lunch',
  tags: ['work', 'trip'],
  referenceLink: ''
}

const amountFormat: ColumnConfig = {
  number: { decimals: 2, thousands: true, currencySymbol: '€', symbolPosition: 'after' }
}

function render(over: Partial<Props> = {}): string {
  const props: Props = {
    entry,
    columns: { amount: amountFormat },
    accounts,
    categoryPaths: ['Food', 'Food/Groceries', 'Rent'],
    onChange: vi.fn(),
    ...over
  }
  const row = createElement('tr', null, createElement(EntryCells, props))
  return renderToString(createElement('table', null, createElement('tbody', null, row)))
}

const cells = (html: string): string[] => html.match(/<td[\s\S]*?<\/td>/g) ?? []
const optionsOf = (html: string): string[] => [...html.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((m) => m[1])

describe('EntryCells', () => {
  it('renders the seven cells: date, type, amount, account, category, topic, tags', () => {
    const html = render()
    expect(cells(html)).toHaveLength(7)
    expect(html).toContain('value="2026-03-04"')
    expect(html).toContain('value="Lunch"')
    expect(html).toContain('value="work, trip"')
  })

  it('offers Expense and Income', () => {
    const [, type] = cells(render())
    expect(optionsOf(type)).toEqual(['Expense', 'Income'])
    expect(type).toMatch(/<option value="income" selected="">Income<\/option>/)
  })

  it('shows the amount in the column number format', () => {
    expect(render()).toContain('value="1.234,50 €"')
  })

  it('shows the raw amount when the column has no number format', () => {
    expect(render({ columns: {} })).toContain('value="1234.5"')
  })

  describe('account', () => {
    const accountCell = (over: Partial<EntryDraft>): string => cells(render({ entry: { ...entry, ...over } }))[3]

    it('labels the empty option with a dash and lists the accounts', () => {
      expect(optionsOf(accountCell({ accountId: '' }))).toEqual(['—', 'Cash', 'Bank'])
    })
    it('adds no deleted-account option for a known or an empty account', () => {
      expect(accountCell({ accountId: 'a2' })).not.toContain('(deleted account)')
      expect(accountCell({ accountId: '' })).not.toContain('(deleted account)')
    })
    it('adds the deleted-account option, selected, for an unknown account id', () => {
      const html = accountCell({ accountId: 'gone' })
      expect(optionsOf(html)).toEqual(['—', '(deleted account)', 'Cash', 'Bank'])
      expect(html).toMatch(/<option value="gone" selected="">\(deleted account\)<\/option>/)
    })
    it('selects the stored account', () => {
      expect(accountCell({ accountId: 'a2' })).toMatch(/<option value="a2" selected="">Bank<\/option>/)
    })
  })

  describe('category', () => {
    const categoryCell = (over: Partial<EntryDraft>): string => cells(render({ entry: { ...entry, ...over } }))[4]

    it('labels the empty option with a dash and lists every path', () => {
      expect(optionsOf(categoryCell({ categoryPath: '' }))).toEqual(['—', 'Food', 'Food/Groceries', 'Rent'])
    })
    it('adds the stored path as an option when the tree does not have it', () => {
      const html = categoryCell({ categoryPath: 'Old/Path' })
      expect(optionsOf(html)).toEqual(['—', 'Old/Path', 'Food', 'Food/Groceries', 'Rent'])
      expect(html).toMatch(/<option value="Old\/Path" selected="">Old\/Path<\/option>/)
    })
    it('adds no extra option for a path of the tree', () => {
      expect(optionsOf(categoryCell({ categoryPath: 'Food/Groceries' }))).toHaveLength(4)
    })
  })

  describe('alignment', () => {
    it('right-aligns the amount by default and left-aligns the other cells', () => {
      const [date, , amount, , , topic] = cells(render())
      expect(amount).toContain('text-right')
      expect(date).toContain('text-left')
      expect(topic).toContain('text-left')
    })
    it('follows the column settings', () => {
      const columns: Record<string, ColumnConfig> = {
        amount: { ...amountFormat, align: 'left' },
        topic: { align: 'center' },
        tags: { align: 'right' },
        category: { align: 'center' }
      }
      const [, , amount, , category, topic, tags] = cells(render({ columns }))
      expect(amount).toContain('text-left')
      expect(amount).not.toContain('text-right')
      expect(category).toContain('text-center')
      expect(topic).toContain('text-center')
      expect(tags).toContain('text-right')
    })
  })

  describe('draft row', () => {
    it('shows hints in the empty fields', () => {
      const empty: EntryDraft = { ...entry, amount: '', topic: '', tags: [] }
      const html = render({ entry: empty, draft: true })
      expect(html).toContain('placeholder="0,00"')
      expect(html).toContain('placeholder="Topic"')
      expect(html).toContain('placeholder="tag1, tag2"')
    })
    it('shows no hints in a stored row', () => {
      expect(render()).not.toContain('placeholder=')
    })
  })

  describe('amount field that reports an invalid text', () => {
    function amountInput(onInvalidChange?: (invalid: boolean) => void): ReactElement<{ label: string; onInvalidChange?: unknown }> {
      const find = (node: ReactNode): ReactElement<{ label: string; onInvalidChange?: unknown }>[] => {
        if (!isValidElement(node)) return []
        const element = node as ReactElement<{ label?: string; children?: ReactNode; onInvalidChange?: unknown }>
        const own = element.type === CommitInput && element.props.label === 'Amount' ? [element as never] : []
        return [...own, ...Children.toArray(element.props.children).flatMap(find)]
      }
      const cells = EntryCells({ entry, columns: {}, accounts, categoryPaths: [], onChange: vi.fn(), onInvalidChange })
      return find(cells)[0]
    }

    it('passes the callback on to the amount field', () => {
      const onInvalidChange = vi.fn()
      expect(amountInput(onInvalidChange).props.onInvalidChange).toBe(onInvalidChange)
    })

    it('needs no callback', () => {
      expect(amountInput().props.onInvalidChange).toBeUndefined()
    })
  })

  describe('reference data that could not be read', () => {
    const accountCell = (over: Partial<EntryDraft>): string =>
      cells(render({ referenceLocked: true, entry: { ...entry, ...over } }))[3]

    it('shows an unknown account as unavailable, because the list is not known', () => {
      const html = accountCell({ accountId: 'gone' })
      expect(optionsOf(html)).toContain('(unavailable)')
      expect(html).not.toContain('(deleted account)')
    })
    it('keeps the dash for an empty account', () => {
      expect(optionsOf(accountCell({ accountId: '' }))).toEqual(['—', 'Cash', 'Bank'])
    })

    it('disables the account and category pickers only', () => {
      const [date, type, amount, account, category, topic, tags] = cells(render({ referenceLocked: true }))
      expect(account).toContain('disabled=""')
      expect(category).toContain('disabled=""')
      for (const other of [date, type, amount, topic, tags]) expect(other).not.toContain('disabled=""')
    })
    it('leaves them enabled otherwise', () => {
      expect(render()).not.toContain('disabled=""')
    })
  })

  it('labels every field for assistive technology', () => {
    const html = render()
    for (const label of ['Date', 'Type', 'Amount', 'Account', 'Category', 'Topic', 'Tags']) {
      expect(html).toContain(`aria-label="${label}"`)
    }
  })
})
