import { describe, expect, it } from 'vitest'
import type { CategoryNode } from './model'
import { MAX_CATEGORY_DEPTH, parseAccounts, parseCategories, parseLedgerMeta } from './validate'

const account = { id: 'a1', name: 'Cash', openingBalance: '10.00' }

// A chain of nodes that is `levels` deep
function chain(levels: number): CategoryNode[] {
  let tree: CategoryNode[] = []
  for (let level = 0; level < levels; level++) tree = [{ name: `n${level}`, children: tree }]
  return tree
}

const numberFormat = { decimals: 2, thousands: true, currencySymbol: '€', symbolPosition: 'after' }

describe('parseAccounts', () => {
  it('accepts the list a v0.1.x notebook folder holds', () => {
    expect(parseAccounts([])).toEqual([])
    expect(parseAccounts([account, { id: 'a2', name: '', openingBalance: '-5.5' }])).toEqual([
      account,
      { id: 'a2', name: '', openingBalance: '-5.5' }
    ])
  })

  it('drops fields the type does not have', () => {
    expect(parseAccounts([{ ...account, color: 'red' }])).toEqual([account])
  })

  it.each([[{}], [null]])('rejects %j instead of a list', (raw) => {
    expect(() => parseAccounts(raw)).toThrow('Expected a list of accounts')
  })

  it.each([[null], [['a1']]])('rejects the entry %j that is not an object', (item) => {
    expect(() => parseAccounts([item])).toThrow('must be an object')
  })

  it.each([
    ['id missing', { name: 'x', openingBalance: '0' }, 'id must be a string'],
    ['id empty', { id: '', name: 'x', openingBalance: '0' }, 'id must not be empty'],
    ['name a number', { id: 'a1', name: 5, openingBalance: '0' }, 'name must be a string'],
    ['openingBalance a number', { id: 'a1', name: 'x', openingBalance: 0 }, 'openingBalance must be a string']
  ])('rejects an account with %s', (_label, item, message) => {
    expect(() => parseAccounts([item])).toThrow(message)
  })

  it('rejects a repeated id', () => {
    expect(() => parseAccounts([account, { ...account, name: 'Other' }])).toThrow('Duplicate account id "a1"')
  })
})

describe('parseCategories', () => {
  it('accepts a nested tree and does not check the names', () => {
    const tree = [
      { name: 'Food', children: [{ name: 'Groceries', children: [] }] },
      { name: '', children: [] },
      { name: ' a/b ', children: [] }
    ]
    expect(parseCategories(tree)).toEqual(tree)
    expect(parseCategories([])).toEqual([])
  })

  it('drops fields the type does not have', () => {
    expect(parseCategories([{ name: 'A', children: [], note: 1 }])).toEqual([{ name: 'A', children: [] }])
  })

  it.each([[{}], [null]])('rejects %j instead of a list', (raw) => {
    expect(() => parseCategories(raw)).toThrow('Expected a list of categories')
  })

  it.each([
    ['a node that is not an object', [null], 'must be an object'],
    ['a name that is not a string', [{ name: 1, children: [] }], 'name must be a string'],
    ['no children', [{ name: 'A' }], 'children must be an array'],
    ['a bad node deeper down', [{ name: 'A', children: [{ name: 'B', children: 'x' }] }], 'children must be an array']
  ])('rejects %s', (_label, raw, message) => {
    expect(() => parseCategories(raw)).toThrow(message)
  })

  it(`accepts ${MAX_CATEGORY_DEPTH} levels and rejects one more`, () => {
    expect(parseCategories(chain(MAX_CATEGORY_DEPTH))).toEqual(chain(MAX_CATEGORY_DEPTH))
    expect(() => parseCategories(chain(MAX_CATEGORY_DEPTH + 1))).toThrow('nested deeper than 32 levels')
  })
})

describe('parseLedgerMeta', () => {
  const metaWith = (column: unknown): unknown => ({ name: 'n', currencySymbol: '€', columns: { amount: column } })
  const decimalsOf = (decimals: unknown): number | undefined =>
    parseLedgerMeta(metaWith({ number: { ...numberFormat, decimals } })).columns?.amount.number?.decimals

  it('accepts name and currency alone and adds no columns', () => {
    const meta = parseLedgerMeta({ name: 'Home', currencySymbol: '€' })
    expect(meta).toEqual({ name: 'Home', currencySymbol: '€' })
    expect('columns' in meta).toBe(false)
  })

  it('keeps a full column config', () => {
    const raw = {
      name: 'Home',
      currencySymbol: '$',
      columns: {
        amount: { align: 'right', width: 90.5, number: numberFormat },
        topic: { align: 'left' },
        tags: {}
      }
    }
    expect(parseLedgerMeta(raw)).toEqual(raw)
  })

  it('drops keys of old files that a column no longer has', () => {
    const raw = {
      name: 'Home',
      currencySymbol: '€',
      columns: {
        amount: { type: 'number', align: 'right', number: numberFormat },
        date: { type: 'date', date: { pattern: 'dd.MM.yyyy' }, width: 80 }
      }
    }
    expect(parseLedgerMeta(raw).columns).toEqual({
      amount: { align: 'right', number: numberFormat },
      date: { width: 80 }
    })
  })

  it('drops top-level keys the type does not have', () => {
    expect(parseLedgerMeta({ name: 'Home', currencySymbol: '€', extra: true })).toEqual({
      name: 'Home',
      currencySymbol: '€'
    })
  })

  it.each([[[]], [null]])('rejects %j instead of an object', (raw) => {
    expect(() => parseLedgerMeta(raw)).toThrow('must be an object')
  })

  it.each([
    ['no name', { currencySymbol: '€' }, 'name must be a string'],
    ['a currency symbol that is null', { name: 'n', currencySymbol: null }, 'currencySymbol must be a string'],
    ['columns as a list', { name: 'n', currencySymbol: '€', columns: [] }, 'must be an object'],
    ['a column that is not an object', { name: 'n', currencySymbol: '€', columns: { amount: 'wide' } }, 'must be an object']
  ])('rejects %s', (_label, raw, message) => {
    expect(() => parseLedgerMeta(raw)).toThrow(message)
  })

  it.each([
    ['align justify', { align: 'justify' }, 'align must be left or center or right'],
    ['align null', { align: null }, 'align must be'],
    ['width 0', { width: 0 }, 'width must be'],
    ['width NaN', { width: NaN }, 'width must be'],
    ['width a string', { width: '90' }, 'width must be'],
    ['number null', { number: null }, 'must be an object'],
    ['decimals a string', { number: { ...numberFormat, decimals: '2' } }, 'decimals must be a number'],
    ['decimals NaN', { number: { ...numberFormat, decimals: NaN } }, 'decimals must be a number'],
    ['decimals Infinity', { number: { ...numberFormat, decimals: Infinity } }, 'decimals must be a number'],
    ['decimals missing', { number: { thousands: true, currencySymbol: '', symbolPosition: 'after' } }, 'decimals must be a number'],
    ['thousands a string', { number: { ...numberFormat, thousands: 'yes' } }, 'thousands must be true or false'],
    ['number currencySymbol a number', { number: { ...numberFormat, currencySymbol: 5 } }, 'currencySymbol must be a string'],
    ['symbolPosition middle', { number: { ...numberFormat, symbolPosition: 'middle' } }, 'symbolPosition must be before or after']
  ])('rejects a column with %s', (_label, column, message) => {
    expect(() => parseLedgerMeta(metaWith(column))).toThrow(message)
  })

  it.each([
    [0, 0],
    [2, 2],
    [20, 20],
    [21, 20],
    [99, 20],
    [1e9, 20],
    [-1, 0],
    [-0.5, 0],
    [1.5, 1],
    [2.9, 2]
  ])('turns decimals %j into the whole number %j between 0 and 20', (decimals, expected) => {
    expect(decimalsOf(decimals)).toBe(expected)
  })

  it('accepts a width that is a fraction', () => {
    expect(parseLedgerMeta(metaWith({ align: 'center', width: 0.5 })).columns?.amount).toEqual({ align: 'center', width: 0.5 })
  })

  it('names the column in the message', () => {
    expect(() => parseLedgerMeta(metaWith({ align: 'x' }))).toThrow('Column "amount"')
  })

  it('keeps a column id such as __proto__ as an own key without touching the prototype', () => {
    const raw = JSON.parse('{"name":"n","currencySymbol":"€","columns":{"__proto__":{"align":"left"}}}')
    const columns = parseLedgerMeta(raw).columns ?? {}
    expect(Object.keys(columns)).toEqual(['__proto__'])
    expect(Object.getPrototypeOf(columns)).toBe(Object.prototype)
    expect(JSON.stringify(columns)).toBe('{"__proto__":{"align":"left"}}')
  })
})
