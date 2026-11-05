import { describeValue, fieldsOf, textOf } from '@renderer/storage'
import { clampDecimals } from './ledger/columns'
import type { Align, ColumnConfig, NumberFormat } from './ledger/columns'
import type { Account, CategoryNode, LedgerMeta } from './model'

export const MAX_CATEGORY_DEPTH = 32
const ALIGNMENTS: readonly Align[] = ['left', 'center', 'right']
const SYMBOL_POSITIONS: readonly NumberFormat['symbolPosition'][] = ['before', 'after']

type Fields = Record<string, unknown>

function choiceOf<T extends string>(fields: Fields, key: string, choices: readonly T[], where: string): T {
  const value = fields[key]
  const found = choices.find((choice) => choice === value)
  if (found !== undefined) return found
  throw new Error(`${where}: ${key} must be ${choices.join(' or ')}, got ${describeValue(value)}`)
}

// Checks the shape the code relies on; fields the type does not have are dropped
export function parseAccounts(raw: unknown): Account[] {
  if (!Array.isArray(raw)) throw new Error(`Expected a list of accounts, got ${describeValue(raw)}`)
  const seen = new Set<string>()
  return raw.map((item, index) => {
    const where = `Account ${index + 1}`
    const fields = fieldsOf(item, where)
    const id = textOf(fields, 'id', where)
    if (id === '') throw new Error(`${where}: id must not be empty`)
    if (seen.has(id)) throw new Error(`Duplicate account id ${describeValue(id)}`)
    seen.add(id)
    return {
      id,
      name: textOf(fields, 'name', where),
      openingBalance: textOf(fields, 'openingBalance', where)
    }
  })
}

function parseCategoryNodes(list: unknown[], depth: number): CategoryNode[] {
  return list.map((item) => {
    if (depth > MAX_CATEGORY_DEPTH) {
      throw new Error(`Categories are nested deeper than ${MAX_CATEGORY_DEPTH} levels`)
    }
    const fields = fieldsOf(item, 'A category')
    const name = textOf(fields, 'name', 'A category')
    const { children } = fields
    if (!Array.isArray(children)) {
      throw new Error(`Category ${describeValue(name)}: children must be an array, got ${describeValue(children)}`)
    }
    return { name, children: parseCategoryNodes(children, depth + 1) }
  })
}

// Names are not checked: v0.1.x files hold whatever the user typed
export function parseCategories(raw: unknown): CategoryNode[] {
  if (!Array.isArray(raw)) throw new Error(`Expected a list of categories, got ${describeValue(raw)}`)
  return parseCategoryNodes(raw, 1)
}

// v0.1.x never limited decimals, so a number is cut to a whole number from 0 to 20 instead of rejected
function parseNumberFormat(raw: unknown, where: string): NumberFormat {
  const fields = fieldsOf(raw, where)
  const { decimals, thousands } = fields
  if (typeof decimals !== 'number' || !Number.isFinite(decimals)) {
    throw new Error(`${where}: decimals must be a number, got ${describeValue(decimals)}`)
  }
  if (typeof thousands !== 'boolean') {
    throw new Error(`${where}: thousands must be true or false, got ${describeValue(thousands)}`)
  }
  return {
    decimals: clampDecimals(decimals),
    thousands,
    currencySymbol: textOf(fields, 'currencySymbol', where),
    symbolPosition: choiceOf(fields, 'symbolPosition', SYMBOL_POSITIONS, where)
  }
}

// Keys of old files that ColumnConfig no longer has (type, date) are dropped
function parseColumn(raw: unknown, where: string): ColumnConfig {
  const fields = fieldsOf(raw, where)
  const column: ColumnConfig = {}
  if (fields.align !== undefined) column.align = choiceOf(fields, 'align', ALIGNMENTS, where)
  if (fields.width !== undefined) {
    const { width } = fields
    if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) {
      throw new Error(`${where}: width must be a number above 0, got ${describeValue(width)}`)
    }
    column.width = width
  }
  if (fields.number !== undefined) column.number = parseNumberFormat(fields.number, `${where}: number`)
  return column
}

// fromEntries defines own keys, so a column id such as __proto__ cannot change the prototype
function parseColumns(raw: unknown): Record<string, ColumnConfig> {
  const columns = fieldsOf(raw, 'Columns')
  return Object.fromEntries(
    Object.entries(columns).map(([id, column]) => [id, parseColumn(column, `Column ${describeValue(id)}`)])
  )
}

export function parseLedgerMeta(raw: unknown): LedgerMeta {
  const where = 'Ledger settings'
  const fields = fieldsOf(raw, where)
  const meta: LedgerMeta = {
    name: textOf(fields, 'name', where),
    currencySymbol: textOf(fields, 'currencySymbol', where)
  }
  if (fields.columns !== undefined) meta.columns = parseColumns(fields.columns)
  return meta
}
