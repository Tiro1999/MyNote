import { messageOf } from '@shared/errors'
import { newId } from '@renderer/storage'
import type { Account, CategoryNode } from '../model'
import { useFinanceStore } from '../store'

export const NEW_CATEGORY_NAME = 'New'

export const newAccount = (): Account => ({ id: newId(), name: '', openingBalance: '0' })

export const newCategory = (): CategoryNode => ({ name: NEW_CATEGORY_NAME, children: [] })

// A slash separates the levels of a category path, so it cannot be part of a name
export const cleanCategoryName = (name: string): string => name.replaceAll('/', '')

// What the dialog saves: names trimmed, rows without a name dropped
export const cleanAccounts = (accounts: Account[]): Account[] =>
  accounts.map((account) => ({ ...account, name: account.name.trim() })).filter((account) => account.name !== '')

// A nameless category without subcategories is dropped; one with subcategories is refused, so no entered row is lost
export function cleanCategories(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => {
    const name = cleanCategoryName(node.name).trim()
    const children = cleanCategories(node.children)
    if (name !== '') return [{ name, children }]
    if (children.length > 0) throw new Error('A category needs a name.')
    return []
  })
}

// Saves both files, nothing is written when a name is missing; gives the error message, null = saved
export async function saveReferenceData(accounts: Account[], categories: CategoryNode[]): Promise<string | null> {
  try {
    const cleanedAccounts = cleanAccounts(accounts)
    const cleanedCategories = cleanCategories(categories)
    const { saveAccounts, saveCategories } = useFinanceStore.getState()
    await saveAccounts(cleanedAccounts)
    await saveCategories(cleanedCategories)
    return null
  } catch (error) {
    return messageOf(error)
  }
}
