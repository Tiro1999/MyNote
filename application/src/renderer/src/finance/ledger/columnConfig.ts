export type ColumnType = 'text' | 'number' | 'date'
export type Align = 'left' | 'center' | 'right'

export interface NumberFormat {
  decimals: number
  thousands: boolean
  currencySymbol: string // '' = none
  symbolPosition: 'before' | 'after'
}

export interface DateFormat {
  pattern: 'dd.MM.yyyy' | 'yyyy-MM-dd' | 'MM/dd/yyyy' | 'dd.MM.yy'
}

export interface ColumnConfig {
  type?: ColumnType // /table only; ledger columns pass their intrinsic type
  align?: Align
  width?: number // px; absent = auto/default
  number?: NumberFormat
  date?: DateFormat
}
