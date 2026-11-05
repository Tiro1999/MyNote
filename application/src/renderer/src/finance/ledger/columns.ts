import { LOCALE } from '../model'

export type Align = 'left' | 'center' | 'right'

export interface NumberFormat {
  decimals: number
  thousands: boolean
  currencySymbol: string // '' = none
  symbolPosition: 'before' | 'after'
}

export interface ColumnConfig {
  align?: Align
  width?: number // px; absent = auto/default
  number?: NumberFormat
}

// Configurable columns (the '#', link and delete columns stay structural)
export const LEDGER_COLUMNS: readonly { id: string; label: string }[] = [
  { id: 'date', label: 'Date' },
  { id: 'type', label: 'Type' },
  { id: 'amount', label: 'Amount' },
  { id: 'account', label: 'Account' },
  { id: 'category', label: 'Category' },
  { id: 'topic', label: 'Topic' },
  { id: 'tags', label: 'Tags' }
]

// toLocaleString throws above 100 digits and a long fraction is unreadable, so 20 is the limit
export const MAX_DECIMALS = 20
// The column settings offer 0 to 4
export const MAX_EDIT_DECIMALS = 4
export const MIN_COLUMN_WIDTH = 48

export const clampDecimals = (value: number, max = MAX_DECIMALS): number =>
  Math.min(max, Math.max(0, Math.trunc(value) || 0))

// Decimals typed in the column settings; null for text that is no number
export function parseDecimals(raw: string): number | null {
  const text = raw.trim().replace(',', '.')
  const value = text === '' ? NaN : Number(text)
  return Number.isFinite(value) ? clampDecimals(value, MAX_EDIT_DECIMALS) : null
}

// scale is the zoom of the canvas around the block: screen pixels per layout pixel
export function resizedColumnWidth(startWidth: number, dx: number, scale: number): number {
  const factor = Number.isFinite(scale) && scale > 0 ? scale : 1
  return Math.max(MIN_COLUMN_WIDTH, Math.round(startWidth + dx / factor))
}

export interface WidthDrag {
  // The width for a pointer that has moved dx screen pixels since the press
  move: (dx: number) => number
  // The width to save once the pointer is released; null = nothing moved or the width is the start width again
  finish: () => number | null
}

export function startWidthDrag(startWidth: number, scale: number): WidthDrag {
  let latest: number | null = null
  return {
    move: (dx) => (latest = resizedColumnWidth(startWidth, dx, scale)),
    finish: () => (latest === null || latest === startWidth ? null : latest)
  }
}

export const alignClass = (align: Align | undefined): string =>
  align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'

export function formatNumber(raw: string, fmt: NumberFormat): string {
  const trimmed = raw.trim()
  if (trimmed === '') return raw
  const n = Number(trimmed.replace(',', '.'))
  if (!Number.isFinite(n)) return raw
  const decimals = clampDecimals(fmt.decimals)
  const body = n.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: fmt.thousands
  })
  if (!fmt.currencySymbol) return body
  return fmt.symbolPosition === 'before'
    ? `${fmt.currencySymbol} ${body}`
    : `${body} ${fmt.currencySymbol}`
}

export function applyColumnFormat(raw: string, col: ColumnConfig): string {
  return col.number ? formatNumber(raw, col.number) : raw
}

/** Settings a column is drawn with: only the amount column has a number format; stale keys of old files are dropped. */
export function resolveColumn(
  id: string,
  stored: ColumnConfig | undefined,
  currency: string
): ColumnConfig {
  const { align, width } = stored ?? {}
  const layout: ColumnConfig = {
    ...(align !== undefined && { align }),
    ...(width !== undefined && { width })
  }
  if (id !== 'amount') return layout
  return {
    ...layout,
    number: stored?.number ?? {
      decimals: 2,
      thousands: true,
      currencySymbol: currency,
      symbolPosition: 'after'
    }
  }
}

/** The settings every configurable column is drawn with. */
export function resolveColumns(
  stored: Record<string, ColumnConfig>,
  currency: string
): Record<string, ColumnConfig> {
  return Object.fromEntries(LEDGER_COLUMNS.map(({ id }) => [id, resolveColumn(id, stored[id], currency)]))
}
