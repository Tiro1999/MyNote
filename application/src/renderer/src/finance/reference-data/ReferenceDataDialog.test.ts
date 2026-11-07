import { createElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFinanceStore } from '../store'

vi.mock('../store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store')>()
  const { liveStore } = await import('../store.testing')
  return { ...actual, useFinanceStore: liveStore(actual.useFinanceStore) }
})

interface ModalProps {
  title: string
  size?: string
  children: ReactNode
  footer: ReactNode
}

const modal = vi.hoisted(() => ({ props: null as ModalProps | null }))

vi.mock('@renderer/ui', async () => {
  const { createElement: h } = await import('react')
  return {
    buttonClass: { primary: 'primary', secondary: 'secondary' },
    Modal: (props: ModalProps) => {
      modal.props = props
      return h('section', { 'data-title': props.title }, props.children, props.footer)
    }
  }
})

import { ReferenceDataEditor } from './ReferenceDataDialog'

const accounts = [
  { id: 'a1', name: 'Cash', openingBalance: '10.00' },
  { id: 'a2', name: 'Bank', openingBalance: '-5.50' }
]
const categories = [{ name: 'Food', children: [{ name: 'Groceries', children: [] }] }]

const render = (over: Partial<{ accounts: typeof accounts; categories: typeof categories }> = {}): string =>
  renderToString(
    createElement(ReferenceDataEditor, {
      initialAccounts: over.accounts ?? accounts,
      initialCategories: over.categories ?? categories,
      onClose: vi.fn()
    })
  )

afterEach(() => {
  useFinanceStore.setState(useFinanceStore.getInitialState(), true)
  modal.props = null
})

describe('ReferenceDataEditor', () => {
  it('is a large modal titled Reference data', () => {
    render()
    expect(modal.props?.title).toBe('Reference data')
    expect(modal.props?.size).toBe('lg')
  })

  it('shows the headings, the fields and the buttons in English', () => {
    const html = render()
    for (const text of [
      'Accounts',
      'Categories',
      '+ Account',
      '+ Main category',
      '+ Subcategory',
      'Cancel',
      'Save'
    ]) {
      expect(html).toContain(text)
    }
    expect(html).toContain('placeholder="Account name"')
    expect(html).toContain('placeholder="Opening balance"')
  })

  it('lists the accounts with name and opening balance, and the category tree', () => {
    const html = render()
    expect(html).toContain('value="Cash"')
    expect(html).toContain('value="10.00"')
    expect(html).toContain('value="-5.50"')
    expect(html).toContain('value="Food"')
    expect(html).toContain('value="Groceries"')
  })

  it('shows no error and lets the user save while the files are readable', () => {
    const html = render()
    expect(html).not.toContain('role="alert"')
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Save</)
  })

  it('shows the read error, locks the fields and disables Save when the files could not be read', () => {
    useFinanceStore.setState({ referenceError: 'finance/accounts.json: Unexpected token' })
    const html = render()
    expect(html).toContain('Accounts and categories could not be read: finance/accounts.json: Unexpected token. They are not changed.')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save</)
    expect(html).toContain('<fieldset')
    expect(html).toMatch(/<fieldset[^>]*disabled=""/)
  })

  it('hosts the opening balance in a div, because its error message is a div and must not sit in a span', () => {
    expect(render()).not.toMatch(/<span[^>]*><input/)
  })

  it('shows an empty editor without rows', () => {
    const html = render({ accounts: [], categories: [] })
    expect(html).not.toContain('placeholder="Account name"')
    expect(html).toContain('+ Account')
  })

  it('names no German word', () => {
    expect(render()).not.toMatch(/Konto|Kategorie|Speichern|Abbrechen|Neu\b/)
  })
})
