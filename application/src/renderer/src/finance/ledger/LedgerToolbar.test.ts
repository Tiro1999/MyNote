import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import LedgerToolbar from './LedgerToolbar'

const render = (over: Partial<Parameters<typeof LedgerToolbar>[0]> = {}): string =>
  renderToString(
    createElement(LedgerToolbar, { ledgerId: 'l1', name: 'Home', readable: true, onDeleted: vi.fn(), ...over })
  )

const labels = (html: string): string[] => [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1])

describe('LedgerToolbar', () => {
  it('offers Import, Export, Reference data and Delete for a readable ledger', () => {
    expect(labels(render())).toEqual(['Import', 'Export', 'Reference data', 'Delete'])
  })

  it('offers only Delete while the ledger is not readable, so the block can still be removed', () => {
    expect(labels(render({ readable: false }))).toEqual(['Delete'])
  })

  it('opens no dialog at the start', () => {
    expect(render()).not.toContain('role="dialog"')
  })
})
