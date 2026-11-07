import { normalizeAmount, todayISO } from '../model'
import type { EntryDraft } from '../model'
import { useFinanceStore } from '../store'

export const emptyDraft = (now?: Date): EntryDraft => ({
  date: todayISO(now),
  type: 'expense',
  amount: '',
  accountId: '',
  categoryPath: '',
  topic: '',
  tags: [],
  referenceLink: ''
})

// What the draft still needs before it can be added; null = ready. An invalid text in the amount field is not in the draft.
export function draftProblem(draft: EntryDraft, { amountInvalid = false }: { amountInvalid?: boolean } = {}): string | null {
  if (amountInvalid) return 'Fix the amount first.'
  const noAmount = normalizeAmount(draft.amount, false) === null
  const noAccount = draft.accountId === ''
  if (noAmount && noAccount) return 'Enter an amount and choose an account.'
  if (noAmount) return 'Enter an amount above 0.'
  return noAccount ? 'Choose an account.' : null
}

// Adds the draft to the ledger; the hint says why it was not added, null = added. A rejection reaches the caller.
export async function addDraft(ledgerId: string, draft: EntryDraft, amountInvalid: boolean): Promise<string | null> {
  const problem = draftProblem(draft, { amountInvalid })
  if (problem !== null) return problem
  await useFinanceStore.getState().addEntry(ledgerId, draft)
  return null
}
