import { beforeEach, describe, expect, it, vi } from 'vitest'

const notify = vi.hoisted(() => vi.fn())

vi.mock('@renderer/ui', () => ({ notify }))

import { reportFailure } from './reportFailure'

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  notify.mockReset()
})

describe('reportFailure', () => {
  it('shows the message of a rejection as an error toast', async () => {
    reportFailure(Promise.reject(new Error('Ledger l1 is not loaded')))
    await settle()
    expect(notify).toHaveBeenCalledWith('Ledger l1 is not loaded', 'error')
  })

  it('handles a rejection that is no Error', async () => {
    reportFailure(Promise.reject('plain text'))
    await settle()
    expect(notify).toHaveBeenCalledWith('plain text', 'error')
  })

  it('says nothing when the task succeeds', async () => {
    reportFailure(Promise.resolve())
    await settle()
    expect(notify).not.toHaveBeenCalled()
  })
})
