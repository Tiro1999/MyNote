import { afterEach, describe, expect, it, vi } from 'vitest'
import { isValidId } from '@renderer/storage'
import type { Account, CategoryNode } from '../model'
import { useFinanceStore } from '../store'
import {
  NEW_CATEGORY_NAME,
  cleanAccounts,
  cleanCategories,
  cleanCategoryName,
  newAccount,
  newCategory,
  saveReferenceData
} from './referenceData'

afterEach(() => {
  useFinanceStore.setState(useFinanceStore.getInitialState(), true)
})

const node = (name: string, children: CategoryNode[] = []): CategoryNode => ({ name, children })

describe('cleanCategoryName', () => {
  it('removes every slash, because a slash separates the levels of a path', () => {
    expect(cleanCategoryName('Food/Groceries')).toBe('FoodGroceries')
    expect(cleanCategoryName('//')).toBe('')
  })
  it('keeps spaces, so a name can be typed word by word', () => {
    expect(cleanCategoryName('Eating out ')).toBe('Eating out ')
  })
})

describe('cleanAccounts', () => {
  it('trims the names and keeps id, balance and order', () => {
    const accounts = [
      { id: 'b', name: '  Bank ', openingBalance: '-5.00' },
      { id: 'a', name: 'Cash', openingBalance: '0' }
    ]
    expect(cleanAccounts(accounts)).toEqual([
      { id: 'b', name: 'Bank', openingBalance: '-5.00' },
      { id: 'a', name: 'Cash', openingBalance: '0' }
    ])
  })
  it('drops accounts whose trimmed name is empty', () => {
    const accounts = [
      { id: 'a', name: '', openingBalance: '0' },
      { id: 'b', name: '   ', openingBalance: '0' },
      { id: 'c', name: 'Cash', openingBalance: '0' }
    ]
    expect(cleanAccounts(accounts).map((account) => account.id)).toEqual(['c'])
  })
  it('does not change its input', () => {
    const accounts = [{ id: 'a', name: ' x ', openingBalance: '0' }]
    cleanAccounts(accounts)
    expect(accounts[0].name).toBe(' x ')
  })
})

describe('cleanCategories', () => {
  it('trims names and removes slashes on every level', () => {
    const tree = [node(' Food ', [node('Out/side'), node(' Home ')]), node('Rent')]
    expect(cleanCategories(tree)).toEqual([node('Food', [node('Outside'), node('Home')]), node('Rent')])
  })
  it('drops a category without a name when it has no subcategories', () => {
    const tree = [node('  '), node('Food', [node(''), node('Home')]), node('/')]
    expect(cleanCategories(tree)).toEqual([node('Food', [node('Home')])])
  })
  it('drops a category without a name whose subcategories are all without a name too', () => {
    expect(cleanCategories([node(' ', [node(''), node('/')]), node('Rent')])).toEqual([node('Rent')])
  })
  it('refuses a category without a name that has subcategories', () => {
    const message = 'A category needs a name.'
    expect(() => cleanCategories([node('  ', [node('Lost')])])).toThrow(message)
    expect(() => cleanCategories([node('Food', [node('/', [node('Deep')])])])).toThrow(message)
  })
  it('gives an empty tree for an empty tree', () => {
    expect(cleanCategories([])).toEqual([])
  })
})

describe('new rows', () => {
  it('creates an account with a fresh valid id, no name and a balance of 0', () => {
    const first = newAccount()
    expect(isValidId(first.id)).toBe(true)
    expect(first).toMatchObject({ name: '', openingBalance: '0' })
    expect(newAccount().id).not.toBe(first.id)
  })
  it('names a new category New and gives it no subcategories', () => {
    expect(NEW_CATEGORY_NAME).toBe('New')
    expect(newCategory()).toEqual({ name: 'New', children: [] })
    expect(newCategory().children).not.toBe(newCategory().children)
  })
})

describe('saveReferenceData', () => {
  const accounts: Account[] = [
    { id: 'a1', name: ' Cash ', openingBalance: '10.00' },
    { id: 'a2', name: '', openingBalance: '0' }
  ]
  const categories = [node(' Food/ ', [node('Home')]), node('')]
  const calls: string[] = []
  const saveAccounts = vi.fn<(accounts: Account[]) => Promise<void>>()
  const saveCategories = vi.fn<(categories: CategoryNode[]) => Promise<void>>()

  const setup = (failing: { accounts?: Error; categories?: Error } = {}): void => {
    calls.length = 0
    saveAccounts.mockReset().mockImplementation(async () => {
      calls.push('accounts')
      if (failing.accounts) throw failing.accounts
    })
    saveCategories.mockReset().mockImplementation(async () => {
      calls.push('categories')
      if (failing.categories) throw failing.categories
    })
    useFinanceStore.setState({ saveAccounts, saveCategories })
  }

  it('saves the accounts, then the categories, both cleaned, and gives no error', async () => {
    setup()
    expect(await saveReferenceData(accounts, categories)).toBeNull()
    expect(calls).toEqual(['accounts', 'categories'])
    expect(saveAccounts).toHaveBeenCalledWith([{ id: 'a1', name: 'Cash', openingBalance: '10.00' }])
    expect(saveCategories).toHaveBeenCalledWith([node('Food', [node('Home')])])
  })

  it('writes nothing and gives the message when a category without a name has subcategories', async () => {
    setup()
    expect(await saveReferenceData(accounts, [node('', [node('Lost')])])).toBe('A category needs a name.')
    expect(saveAccounts).not.toHaveBeenCalled()
    expect(saveCategories).not.toHaveBeenCalled()
  })

  it('gives the message and does not go on when saving the accounts fails', async () => {
    setup({ accounts: new Error('finance/accounts.json: read failed') })
    expect(await saveReferenceData(accounts, categories)).toBe('finance/accounts.json: read failed')
    expect(saveCategories).not.toHaveBeenCalled()
  })

  it('gives the message when saving the categories fails', async () => {
    setup({ categories: new Error('EBUSY: resource busy or locked') })
    expect(await saveReferenceData(accounts, categories)).toBe('EBUSY: resource busy or locked')
    expect(calls).toEqual(['accounts', 'categories'])
  })
})
