import type { ColumnConfig, DateFormat, NumberFormat } from './columnConfig'

export function formatNumber(raw: string, fmt: NumberFormat): string {
  const trimmed = raw.trim()
  if (trimmed === '') return raw
  const n = Number(trimmed.replace(',', '.'))
  if (!Number.isFinite(n)) return raw
  const body = n.toLocaleString('de-DE', {
    minimumFractionDigits: fmt.decimals,
    maximumFractionDigits: fmt.decimals,
    useGrouping: fmt.thousands
  })
  if (!fmt.currencySymbol) return body
  return fmt.symbolPosition === 'before'
    ? `${fmt.currencySymbol} ${body}`
    : `${body} ${fmt.currencySymbol}`
}

export function formatDate(raw: string, fmt: DateFormat): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim())
  if (!m) return raw
  const [, y, mo, d] = m
  switch (fmt.pattern) {
    case 'dd.MM.yyyy':
      return `${d}.${mo}.${y}`
    case 'dd.MM.yy':
      return `${d}.${mo}.${y.slice(2)}`
    case 'MM/dd/yyyy':
      return `${mo}/${d}/${y}`
    case 'yyyy-MM-dd':
      return `${y}-${mo}-${d}`
  }
}

export function applyColumnFormat(raw: string, col: ColumnConfig): string {
  if (col.type === 'number' && col.number) return formatNumber(raw, col.number)
  if (col.type === 'date' && col.date) return formatDate(raw, col.date)
  return raw
}
