import { describe, expect, it } from 'vitest'
import {
  ACCOUNTS_PATH,
  CATEGORIES_PATH,
  checkLedgerId,
  ledgerCsvPath,
  ledgerIdOfMetaFile,
  ledgerMetaPath
} from './paths'

const badIds = ['../x', 'a/b', 'a\\b', '..', '', 'x'.repeat(65)]

describe('fixed paths', () => {
  it('keeps the on-disk locations of v0.1.x', () => {
    expect(ACCOUNTS_PATH).toBe('finance/accounts.json')
    expect(CATEGORIES_PATH).toBe('finance/categories.json')
  })
})

describe('ledgerCsvPath and ledgerMetaPath', () => {
  it('build the v0.1.x file names for a valid id', () => {
    expect(ledgerCsvPath('abc_12-X')).toBe('finance/ledgers/abc_12-X.csv')
    expect(ledgerMetaPath('abc_12-X')).toBe('finance/ledgers/abc_12-X.meta.json')
  })

  it('accept names that are only special on a plain object', () => {
    expect(ledgerCsvPath('constructor')).toBe('finance/ledgers/constructor.csv')
    expect(ledgerMetaPath('__proto__')).toBe('finance/ledgers/__proto__.meta.json')
  })

  it.each(badIds)('never let the id %j reach a path', (id) => {
    expect(() => ledgerCsvPath(id)).toThrow('Invalid ledger id: ' + id)
    expect(() => ledgerMetaPath(id)).toThrow('Invalid ledger id: ' + id)
  })
})

describe('checkLedgerId', () => {
  it('returns a valid id and throws for any other value', () => {
    expect(checkLedgerId('l1')).toBe('l1')
    expect(() => checkLedgerId('a/b')).toThrow('Invalid ledger id: a/b')
  })
})

describe('ledgerIdOfMetaFile', () => {
  it('gives the id of a meta file name', () => {
    expect(ledgerIdOfMetaFile('abc.meta.json')).toBe('abc')
    expect(ledgerIdOfMetaFile('a_b-C9.meta.json')).toBe('a_b-C9')
  })

  it.each(['abc.csv', 'abc.meta.json.bak', '.meta.json', 'a.b.meta.json', `${'x'.repeat(65)}.meta.json`])(
    'gives null for %j',
    (name) => {
      expect(ledgerIdOfMetaFile(name)).toBeNull()
    }
  )
})
