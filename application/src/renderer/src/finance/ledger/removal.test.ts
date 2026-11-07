import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFinanceStore } from '../store'
import { deleteDialog, removeLedgerBlock } from './removal'

afterEach(() => {
  useFinanceStore.setState(useFinanceStore.getInitialState(), true)
})

describe('deleteDialog', () => {
  it('names the ledger, its id and the permanent deletion of the data file', () => {
    expect(deleteDialog('l1', 'Home')).toEqual({
      title: 'Delete ledger',
      message: 'Delete ledger "Home" (#l1) and its data file permanently?',
      confirmLabel: 'Delete'
    })
  })

  it('only removes the block when the id is no ledger id, because no file belongs to it', () => {
    for (const id of ['', '../x', 'a/b']) {
      expect(deleteDialog(id, id)).toEqual({
        title: 'Remove block',
        message: 'Remove this block? It has no valid ledger id, so no file is deleted.',
        confirmLabel: 'Remove'
      })
    }
  })

  it('treats an id such as constructor like any other valid id', () => {
    expect(deleteDialog('constructor', 'constructor').message).toContain('(#constructor)')
  })
})

describe('removeLedgerBlock', () => {
  const deleteLedger = vi.fn<(id: string) => Promise<void>>()
  const calls: string[] = []

  const setup = (result: () => Promise<void>): void => {
    calls.length = 0
    deleteLedger.mockReset().mockImplementation(async (id) => {
      calls.push(`delete ${id}`)
      return result()
    })
    useFinanceStore.setState({ deleteLedger })
  }

  it('deletes the ledger, then removes the block', async () => {
    setup(() => Promise.resolve())
    const onDeleted = vi.fn(() => void calls.push('block'))
    await removeLedgerBlock('l1', onDeleted)
    expect(calls).toEqual(['delete l1', 'block'])
    expect(onDeleted).toHaveBeenCalledTimes(1)
  })

  it.each(['', '../x', 'a/b', '..', 'x\\y'])('removes only the block for the id %j and never calls deleteLedger', async (id) => {
    setup(() => Promise.resolve())
    const onDeleted = vi.fn()
    await removeLedgerBlock(id, onDeleted)
    expect(deleteLedger).not.toHaveBeenCalled()
    expect(onDeleted).toHaveBeenCalledTimes(1)
  })

  it('deletes the ledger of an id such as constructor', async () => {
    setup(() => Promise.resolve())
    await removeLedgerBlock('constructor', vi.fn())
    expect(deleteLedger).toHaveBeenCalledWith('constructor')
  })

  it('keeps the block and passes the error on when the deletion fails', async () => {
    setup(() => Promise.reject(new Error('EBUSY: resource busy or locked')))
    const onDeleted = vi.fn()
    await expect(removeLedgerBlock('l1', onDeleted)).rejects.toThrow('EBUSY')
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
