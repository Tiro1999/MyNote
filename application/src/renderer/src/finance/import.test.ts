import { describe, it, expect } from 'vitest'
import { excelSerialToISO, mapMoneyManager } from './import'

describe('excelSerialToISO', () => {
  it('converts an Excel serial (with time fraction) to the calendar date', () => {
    expect(excelSerialToISO('45658.75')).toBe('2025-01-01')
    expect(excelSerialToISO(45658)).toBe('2025-01-01')
    expect(excelSerialToISO('')).toBe('')
    expect(excelSerialToISO('abc')).toBe('')
  })
})

describe('mapMoneyManager', () => {
  const header = [
    'Datum',
    'Konto',
    'Kategorie',
    'Unterkategorie',
    'Notiz',
    'EUR',
    'Einnahmen/Ausgaben'
  ]
  // Fully fictional sample data — no real account, category or transaction values.
  const grid = [
    header,
    ['45658.5', 'Konto A', 'Freizeit', 'Kino', 'Beispiel 1', '5.0', 'Ausgabe'],
    ['45659.5', 'Konto B', 'Arbeit', 'Gehalt', 'Beispiel 2', '850.0', 'Einkommen'],
    ['45660.5', 'Konto A', 'Haushalt', '', 'Beispiel 3', '2.49', 'Ausgabe'],
    ['45661.5', 'Konto A', 'Umbuchung', '', 'Beispiel 4', '100.0', 'Ausgehender Transfer']
  ]

  it('maps rows, joins category path, skips transfers', () => {
    const r = mapMoneyManager(grid)
    expect(r.skipped).toBe(1)
    expect(r.entries).toHaveLength(3)
    expect(r.entries[0]).toMatchObject({
      date: '2025-01-01',
      type: 'expense',
      amount: '5.0',
      categoryPath: 'Freizeit/Kino',
      topic: 'Beispiel 1',
      accountName: 'Konto A'
    })
    expect(r.entries[1].type).toBe('income')
    expect(r.entries[2].categoryPath).toBe('Haushalt') // empty subcategory → just the category
  })

  it('collects distinct account names and category paths', () => {
    const r = mapMoneyManager(grid)
    expect(r.accountNames.sort()).toEqual(['Konto A', 'Konto B'])
    expect(r.categoryPaths).toContain('Freizeit/Kino')
    expect(r.categoryPaths).toContain('Arbeit/Gehalt')
  })
})
