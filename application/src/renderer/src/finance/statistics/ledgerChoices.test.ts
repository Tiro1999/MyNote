import { describe, expect, it } from 'vitest'
import { loadLedgerChoices } from './ledgerChoices'

describe('loadLedgerChoices', () => {
  it('gives the listed ledgers and no error', async () => {
    const choices = [{ id: 'l1', name: 'Home' }]
    expect(await loadLedgerChoices(async () => choices)).toEqual({ choices, error: null })
  })

  it('turns a failed listing into a message instead of a rejection', async () => {
    const result = await loadLedgerChoices(() => Promise.reject(new Error('EACCES: permission denied')))
    expect(result).toEqual({ choices: [], error: 'EACCES: permission denied' })
  })

  it('also catches a listing that fails before it returns a promise', async () => {
    const result = await loadLedgerChoices(() => {
      throw new Error('no data folder')
    })
    expect(result).toEqual({ choices: [], error: 'no data folder' })
  })

  it('handles a rejection that is no Error', async () => {
    expect(await loadLedgerChoices(() => Promise.reject('plain text'))).toEqual({ choices: [], error: 'plain text' })
  })
})
