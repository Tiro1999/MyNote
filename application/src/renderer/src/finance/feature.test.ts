import type { Editor, JSONContent, NodeConfig } from '@tiptap/core'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { isValidId } from '@renderer/storage'

const notify = vi.hoisted(() => vi.fn())

vi.mock('@renderer/ui', async (importOriginal) => ({ ...(await importOriginal<typeof import('@renderer/ui')>()), notify }))

import { financeFeature } from './feature'
import { useFinanceStore } from './store'

const range = { from: 3, to: 8 }
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

// An editor that records what the chain inserts, in the order of the calls it sees
function recordingEditor(log: string[]): { editor: Editor; inserted: JSONContent[] } {
  const inserted: JSONContent[] = []
  const chain = {
    focus: () => chain,
    deleteRange: () => chain,
    insertContent: (content: JSONContent) => {
      inserted.push(content)
      log.push('insert')
      return chain
    },
    run: () => true
  }
  return { editor: { chain: () => chain } as unknown as Editor, inserted }
}

const item = (id: string): (typeof financeFeature.slashItems)[number] => {
  const found = financeFeature.slashItems.find((entry) => entry.id === id)
  if (!found) throw new Error(`no slash item ${id}`)
  return found
}

let log: string[]
let createLedger: Mock<(ledgerId: string, name: string) => Promise<void>>

beforeEach(() => {
  log = []
  notify.mockReset()
  createLedger = vi.fn(async (_ledgerId: string, _name: string) => {
    log.push('create')
  })
  useFinanceStore.setState({ createLedger })
})

describe('financeFeature', () => {
  it('registers both finance nodes with their React views', () => {
    expect(financeFeature.name).toBe('finance')
    expect(financeFeature.extensions.map((extension) => extension.name)).toEqual(['financeLedger', 'financeStats'])
    expect(financeFeature.extensions.every((extension) => (extension.config as NodeConfig).addNodeView !== undefined)).toBe(true)
  })

  it('offers the slash items ledger and statistics, in English', () => {
    expect(financeFeature.slashItems.map((entry) => entry.id)).toEqual(['ledger', 'statistics'])
    expect(item('ledger').title).toBe('Ledger (income and expenses)')
    expect(item('statistics').title).toBe('Statistics')
    expect(item('ledger').keywords).toEqual(['finance', 'ledger', 'income', 'expenses', 'budget'])
    expect(item('statistics').keywords).toEqual(['statistics', 'charts', 'evaluation', 'finance'])
    for (const entry of financeFeature.slashItems) {
      expect(entry.description).not.toMatch(/[äöüß]|Finanz|Ledger-|Auswertung/)
      expect(entry.icon).not.toBe('')
    }
  })
})

describe('the ledger slash item', () => {
  it('inserts a block with a fresh valid id at once and creates the ledger after it', () => {
    const { editor, inserted } = recordingEditor(log)
    item('ledger').run(editor, range)
    expect(inserted).toHaveLength(1)
    const { type, attrs } = inserted[0]
    expect(type).toBe('financeLedger')
    expect(isValidId(attrs?.ledgerId)).toBe(true)
    expect(createLedger).toHaveBeenCalledWith(attrs?.ledgerId, 'New ledger')
    expect(log).toEqual(['insert', 'create'])
  })

  it('does not wait for the ledger files', () => {
    createLedger.mockReturnValue(new Promise(() => undefined))
    const { editor, inserted } = recordingEditor(log)
    expect(item('ledger').run(editor, range)).toBeUndefined()
    expect(inserted).toHaveLength(1)
  })

  it('gives every block its own id', () => {
    const { editor, inserted } = recordingEditor(log)
    item('ledger').run(editor, range)
    item('ledger').run(editor, range)
    expect(inserted[0].attrs?.ledgerId).not.toBe(inserted[1].attrs?.ledgerId)
  })

  it('shows the failure of creating the ledger as an error toast and keeps the block', async () => {
    createLedger.mockRejectedValue(new Error('EBUSY: resource busy or locked'))
    const { editor, inserted } = recordingEditor(log)
    item('ledger').run(editor, range)
    await settle()
    expect(inserted).toHaveLength(1)
    expect(notify).toHaveBeenCalledWith('EBUSY: resource busy or locked', 'error')
  })

  it('says nothing when the ledger is created', async () => {
    const { editor } = recordingEditor(log)
    item('ledger').run(editor, range)
    await settle()
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('the statistics slash item', () => {
  it('inserts a block with the default attributes and touches no ledger', () => {
    const { editor, inserted } = recordingEditor(log)
    item('statistics').run(editor, range)
    expect(inserted).toEqual([{ type: 'financeStats' }])
    expect(createLedger).not.toHaveBeenCalled()
  })
})
