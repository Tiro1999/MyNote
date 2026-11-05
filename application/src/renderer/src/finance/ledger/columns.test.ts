import { describe, it, expect } from 'vitest'
import {
  LEDGER_COLUMNS,
  MAX_DECIMALS,
  MAX_EDIT_DECIMALS,
  MIN_COLUMN_WIDTH,
  alignClass,
  applyColumnFormat,
  clampDecimals,
  formatNumber,
  parseDecimals,
  resizedColumnWidth,
  resolveColumn,
  resolveColumns,
  startWidthDrag,
  type ColumnConfig,
  type NumberFormat
} from './columns'

const plain: NumberFormat = {
  decimals: 2,
  thousands: false,
  currencySymbol: '',
  symbolPosition: 'after'
}

describe('LEDGER_COLUMNS', () => {
  it('lists the configurable columns in display order', () => {
    expect(LEDGER_COLUMNS).toEqual([
      { id: 'date', label: 'Date' },
      { id: 'type', label: 'Type' },
      { id: 'amount', label: 'Amount' },
      { id: 'account', label: 'Account' },
      { id: 'category', label: 'Category' },
      { id: 'topic', label: 'Topic' },
      { id: 'tags', label: 'Tags' }
    ])
  })
})

describe('alignClass', () => {
  it('maps an alignment to a Tailwind class, left by default', () => {
    expect(alignClass('left')).toBe('text-left')
    expect(alignClass('center')).toBe('text-center')
    expect(alignClass('right')).toBe('text-right')
    expect(alignClass(undefined)).toBe('text-left')
  })
})

describe('formatNumber', () => {
  it('groups thousands and appends a currency symbol', () => {
    expect(
      formatNumber('1234.5', {
        decimals: 2,
        thousands: true,
        currencySymbol: '€',
        symbolPosition: 'after'
      })
    ).toBe('1.234,50 €')
  })
  it('honours no-grouping and a leading symbol, accepts comma decimals', () => {
    expect(
      formatNumber('1234,5', {
        decimals: 2,
        thousands: false,
        currencySymbol: '$',
        symbolPosition: 'before'
      })
    ).toBe('$ 1234,50')
  })
  it('passes non-numbers and empty strings through untouched', () => {
    const fmt = { ...plain, thousands: true }
    expect(formatNumber('abc', fmt)).toBe('abc')
    expect(formatNumber('', fmt)).toBe('')
  })
})

describe('formatNumber with a decimals value outside the range', () => {
  const withDecimals = (decimals: number): NumberFormat => ({ ...plain, decimals })

  it('does not throw for decimals above the limit and uses 20', () => {
    expect(() => formatNumber('1.5', withDecimals(500))).not.toThrow()
    expect(formatNumber('1.5', withDecimals(500))).toBe(formatNumber('1.5', withDecimals(MAX_DECIMALS)))
    expect(formatNumber('1.5', withDecimals(500))).toBe('1,5' + '0'.repeat(MAX_DECIMALS - 1))
  })
  it('does not throw for negative decimals and uses 0', () => {
    expect(() => formatNumber('1.5', withDecimals(-3))).not.toThrow()
    expect(formatNumber('1.6', withDecimals(-3))).toBe('2')
  })
  it('does not throw for a fraction, NaN or Infinity', () => {
    expect(formatNumber('1.5', withDecimals(2.9))).toBe('1,50')
    expect(() => formatNumber('1.5', withDecimals(NaN))).not.toThrow()
    expect(formatNumber('1.5', withDecimals(NaN))).toBe('2')
    expect(() => formatNumber('1.5', withDecimals(Infinity))).not.toThrow()
    expect(() => formatNumber('1.5', withDecimals(-Infinity))).not.toThrow()
  })
})

describe('clampDecimals', () => {
  it('cuts to a whole number from 0 to the limit', () => {
    expect(clampDecimals(2)).toBe(2)
    expect(clampDecimals(2.9)).toBe(2)
    expect(clampDecimals(-1)).toBe(0)
    expect(clampDecimals(99)).toBe(MAX_DECIMALS)
    expect(clampDecimals(99, MAX_EDIT_DECIMALS)).toBe(4)
  })
  it('turns NaN into 0', () => {
    expect(clampDecimals(NaN)).toBe(0)
  })
})

describe('parseDecimals', () => {
  it('reads the text typed in the column settings and clamps it to 0..4', () => {
    expect(parseDecimals('2')).toBe(2)
    expect(parseDecimals(' 3 ')).toBe(3)
    expect(parseDecimals('9')).toBe(4)
    expect(parseDecimals('-2')).toBe(0)
    expect(parseDecimals('1.7')).toBe(1)
    expect(parseDecimals('1,7')).toBe(1)
  })
  it('gives null for text that is no number, which is ignored', () => {
    expect(parseDecimals('')).toBeNull()
    expect(parseDecimals('   ')).toBeNull()
    expect(parseDecimals('abc')).toBeNull()
    expect(parseDecimals('1e999')).toBeNull()
    expect(parseDecimals('NaN')).toBeNull()
  })
})

describe('resizedColumnWidth', () => {
  it('adds the pointer distance to the start width', () => {
    expect(resizedColumnWidth(100, 30, 1)).toBe(130)
    expect(resizedColumnWidth(100, -30, 1)).toBe(70)
  })
  it('never goes below the minimum width', () => {
    expect(MIN_COLUMN_WIDTH).toBe(48)
    expect(resizedColumnWidth(100, -500, 1)).toBe(48)
  })
  it('divides the distance by the canvas zoom of the block', () => {
    expect(resizedColumnWidth(100, 30, 0.5)).toBe(160)
    expect(resizedColumnWidth(100, 30, 2)).toBe(115)
  })
  it('gives whole pixels and survives a zero or invalid scale', () => {
    expect(resizedColumnWidth(100, 10, 3)).toBe(103)
    expect(resizedColumnWidth(100, 10, 0)).toBe(110)
    expect(resizedColumnWidth(100, 10, NaN)).toBe(110)
  })
})

describe('startWidthDrag', () => {
  it('follows the pointer and gives the final width once, when the pointer is released', () => {
    const drag = startWidthDrag(100, 1)
    expect(drag.move(10)).toBe(110)
    expect(drag.move(40)).toBe(140)
    expect(drag.finish()).toBe(140)
  })
  it('saves nothing when the pointer never moved', () => {
    expect(startWidthDrag(100, 1).finish()).toBeNull()
  })
  it('saves nothing when the width is the start width again', () => {
    const drag = startWidthDrag(100, 1)
    drag.move(25)
    drag.move(0)
    expect(drag.finish()).toBeNull()
  })
  it('keeps the minimum width and divides by the zoom', () => {
    const small = startWidthDrag(60, 1)
    small.move(-200)
    expect(small.finish()).toBe(48)
    const zoomed = startWidthDrag(100, 0.5)
    zoomed.move(20)
    expect(zoomed.finish()).toBe(140)
  })
})

describe('applyColumnFormat', () => {
  it('formats exactly when the column has a number format, else returns raw', () => {
    expect(applyColumnFormat('5', { number: plain })).toBe('5,00')
    expect(applyColumnFormat('hello', {})).toBe('hello')
    expect(applyColumnFormat('5', { align: 'right', width: 80 })).toBe('5')
  })
  it('ignores the stale type and date keys of an old meta file', () => {
    const stale = JSON.parse(
      '{"type":"date","date":{"pattern":"dd.MM.yyyy"},"align":"right"}'
    ) as ColumnConfig
    expect(applyColumnFormat('2026-07-04', stale)).toBe('2026-07-04')
  })
})

describe('resolveColumn', () => {
  const defaultNumber: NumberFormat = {
    decimals: 2,
    thousands: true,
    currencySymbol: '€',
    symbolPosition: 'after'
  }

  it('fills the default number format for the amount column', () => {
    expect(resolveColumn('amount', undefined, '€')).toEqual({ number: defaultNumber })
    expect(resolveColumn('amount', {}, '$')).toEqual({
      number: { ...defaultNumber, currencySymbol: '$' }
    })
  })
  it('keeps align, width and a stored number format of the amount column', () => {
    const stored = { align: 'left', width: 90, number: plain } as const
    expect(resolveColumn('amount', stored, '€')).toEqual(stored)
    expect(resolveColumn('amount', { align: 'right', width: 120 }, '€')).toEqual({
      align: 'right',
      width: 120,
      number: defaultNumber
    })
  })
  it('returns only align and width for every other column', () => {
    expect(resolveColumn('topic', { align: 'center', width: 100 }, '€')).toEqual({
      align: 'center',
      width: 100
    })
    expect(resolveColumn('date', undefined, '€')).toEqual({})
    expect(resolveColumn('tags', { number: plain }, '€')).toEqual({})
  })
  it('does not add keys for settings that are absent', () => {
    expect(Object.keys(resolveColumn('topic', { align: 'right' }, '€'))).toEqual(['align'])
    expect(Object.keys(resolveColumn('topic', { width: 64 }, '€'))).toEqual(['width'])
  })
  it('drops a stale type or date from an old meta file', () => {
    const stale = JSON.parse(
      '{"type":"date","date":{"pattern":"yyyy-MM-dd"},"align":"center","width":70}'
    ) as ColumnConfig
    expect(resolveColumn('date', stale, '€')).toEqual({ align: 'center', width: 70 })
    const staleAmount = JSON.parse('{"type":"number","align":"right"}') as ColumnConfig
    expect(resolveColumn('amount', staleAmount, '€')).toEqual({
      align: 'right',
      number: defaultNumber
    })
  })
})

describe('resolveColumns', () => {
  it('resolves each configurable column, with the default number format on the amount only', () => {
    const columns = resolveColumns({ topic: { align: 'center' }, amount: { width: 90 } }, '$')
    expect(Object.keys(columns)).toEqual(LEDGER_COLUMNS.map((column) => column.id))
    expect(columns.topic).toEqual({ align: 'center' })
    expect(columns.amount).toEqual({
      width: 90,
      number: { decimals: 2, thousands: true, currencySymbol: '$', symbolPosition: 'after' }
    })
    expect(columns.date).toEqual({})
  })
  it('gives every column an entry for an empty meta', () => {
    expect(Object.keys(resolveColumns({}, '€'))).toHaveLength(7)
  })
})
