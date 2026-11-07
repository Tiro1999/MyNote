import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFinanceStore } from '../store'
import { addDraft, draftProblem, emptyDraft } from './draft'

afterEach(() => {
  useFinanceStore.setState(useFinanceStore.getInitialState(), true)
})

describe('emptyDraft', () => {
  it('starts as an expense of today with nothing else', () => {
    expect(emptyDraft(new Date(2026, 0, 5))).toEqual({
      date: '2026-01-05',
      type: 'expense',
      amount: '',
      accountId: '',
      categoryPath: '',
      topic: '',
      tags: [],
      referenceLink: ''
    })
  })

  it('uses the local date of now', () => {
    expect(emptyDraft().date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('gives every draft its own tag list', () => {
    expect(emptyDraft().tags).not.toBe(emptyDraft().tags)
  })
})

describe('draftProblem', () => {
  const ready = { ...emptyDraft(), amount: '12.50', accountId: 'a1' }

  it('is null when the draft has a valid amount and an account', () => {
    expect(draftProblem(ready)).toBeNull()
  })

  it('names the missing amount', () => {
    expect(draftProblem({ ...ready, amount: '' })).toBe('Enter an amount above 0.')
  })

  it('treats an amount that is not valid like a missing one', () => {
    expect(draftProblem({ ...ready, amount: 'abc' })).toBe('Enter an amount above 0.')
    expect(draftProblem({ ...ready, amount: '0.00' })).toBe('Enter an amount above 0.')
    expect(draftProblem({ ...ready, amount: '-3.00' })).toBe('Enter an amount above 0.')
  })

  it('names the missing account', () => {
    expect(draftProblem({ ...ready, accountId: '' })).toBe('Choose an account.')
  })

  it('names both when both are missing', () => {
    expect(draftProblem(emptyDraft())).toBe('Enter an amount and choose an account.')
  })

  it('refuses a draft whose amount field shows an invalid text, although the stored amount is valid', () => {
    expect(draftProblem(ready, { amountInvalid: true })).toBe('Fix the amount first.')
  })

  it('puts the invalid amount before the other problems', () => {
    expect(draftProblem(emptyDraft(), { amountInvalid: true })).toBe('Fix the amount first.')
    expect(draftProblem({ ...ready, accountId: '' }, { amountInvalid: true })).toBe('Fix the amount first.')
  })

  it('does not mind the flag when it is false or missing', () => {
    expect(draftProblem(ready, { amountInvalid: false })).toBeNull()
    expect(draftProblem(ready, {})).toBeNull()
  })
})

describe('addDraft', () => {
  const ready = { ...emptyDraft(), amount: '12.50', accountId: 'a1' }
  const withAddEntry = (addEntry: () => Promise<void>): void => useFinanceStore.setState({ addEntry })

  it('adds a ready draft to the ledger and gives no hint', async () => {
    const addEntry = vi.fn(async () => undefined)
    withAddEntry(addEntry)
    expect(await addDraft('l1', ready, false)).toBeNull()
    expect(addEntry).toHaveBeenCalledTimes(1)
    expect(addEntry).toHaveBeenCalledWith('l1', ready)
  })

  it('adds nothing and gives the hint while the amount field shows an invalid text', async () => {
    const addEntry = vi.fn(async () => undefined)
    withAddEntry(addEntry)
    expect(await addDraft('l1', ready, true)).toBe('Fix the amount first.')
    expect(addEntry).not.toHaveBeenCalled()
  })

  it('adds nothing and names what is missing', async () => {
    const addEntry = vi.fn(async () => undefined)
    withAddEntry(addEntry)
    expect(await addDraft('l1', { ...ready, accountId: '' }, false)).toBe('Choose an account.')
    expect(await addDraft('l1', { ...ready, amount: '' }, false)).toBe('Enter an amount above 0.')
    expect(await addDraft('l1', emptyDraft(), false)).toBe('Enter an amount and choose an account.')
    expect(addEntry).not.toHaveBeenCalled()
  })

  it('lets a rejected precondition reach the caller, which keeps the draft', async () => {
    withAddEntry(vi.fn(async () => Promise.reject(new Error('Ledger l1 is not loaded'))))
    await expect(addDraft('l1', ready, false)).rejects.toThrow('Ledger l1 is not loaded')
  })
})
