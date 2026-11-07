import { describe, expect, it } from 'vitest'
import { exportFileName } from './exportFileName'

describe('exportFileName', () => {
  it('suggests <ledger name>-<id>.csv', () => {
    expect(exportFileName('Haushalt 2026/Q1', 'k3J_9a')).toBe('Haushalt 2026-Q1-k3J_9a.csv')
  })

  it('replaces the characters Windows forbids and control characters with -', () => {
    expect(exportFileName('a\\b/c:d*e?f"g<h>i|j', 'id1')).toBe('a-b-c-d-e-f-g-h-i-j-id1.csv')
    expect(exportFileName('Tab\there\u0000\u007f\u009f', 'id1')).toBe('Tab-here----id1.csv')
  })

  it('trims the name and falls back to ledger-<id>.csv when nothing is left', () => {
    expect(exportFileName('  Konto  ', 'id1')).toBe('Konto-id1.csv')
    expect(exportFileName('', 'id1')).toBe('ledger-id1.csv')
    expect(exportFileName('   ', 'id1')).toBe('ledger-id1.csv')
  })
})
