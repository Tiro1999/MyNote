import { beforeEach, describe, expect, it, vi } from 'vitest'

const pickFile = vi.hoisted(() => vi.fn<(filters: unknown[]) => Promise<string | null>>())

vi.mock('@renderer/storage', () => ({ pickFile }))

import { RECEIPT_FILTERS, pickReceipt } from './receipt'

beforeEach(() => {
  pickFile.mockReset()
})

describe('pickReceipt', () => {
  it('asks for a PDF or image file under the name Receipts', async () => {
    pickFile.mockResolvedValue('C:\\receipts\\a.pdf')
    await pickReceipt()
    expect(RECEIPT_FILTERS).toEqual([{ name: 'Receipts', extensions: ['pdf', 'png', 'jpg', 'jpeg'] }])
    expect(pickFile).toHaveBeenCalledWith(RECEIPT_FILTERS)
  })

  it('gives the chosen path', async () => {
    pickFile.mockResolvedValue('/receipts/receipt.png')
    expect(await pickReceipt()).toBe('/receipts/receipt.png')
  })

  it('gives null when the dialog was cancelled', async () => {
    pickFile.mockResolvedValue(null)
    expect(await pickReceipt()).toBeNull()
  })

  it('lets a failure of the dialog reach the caller', async () => {
    pickFile.mockRejectedValue(new Error('dialog failed'))
    await expect(pickReceipt()).rejects.toThrow('dialog failed')
  })
})
