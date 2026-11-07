import { describe, expect, it } from 'vitest'
import { PAGE_SIZE, PAGINATE_THRESHOLD, pageWindow, pagerLabel } from './pager'

describe('pageWindow', () => {
  it('shows every row up to the threshold', () => {
    expect(PAGINATE_THRESHOLD).toBe(100)
    expect(pageWindow(0, 0)).toEqual({ paginated: false, page: 0, pageCount: 1, start: 0, end: 0 })
    expect(pageWindow(100, 0)).toEqual({ paginated: false, page: 0, pageCount: 1, start: 0, end: 100 })
  })

  it('splits a longer ledger into pages of 50 rows', () => {
    expect(PAGE_SIZE).toBe(50)
    expect(pageWindow(101, 0)).toEqual({ paginated: true, page: 0, pageCount: 3, start: 0, end: 50 })
    expect(pageWindow(120, 1)).toEqual({ paginated: true, page: 1, pageCount: 3, start: 50, end: 100 })
    expect(pageWindow(120, 2)).toEqual({ paginated: true, page: 2, pageCount: 3, start: 100, end: 120 })
  })

  it('keeps the page inside the range when rows were deleted or the page is invalid', () => {
    expect(pageWindow(120, 9)).toMatchObject({ page: 2, start: 100, end: 120 })
    expect(pageWindow(120, -4)).toMatchObject({ page: 0, start: 0, end: 50 })
    expect(pageWindow(120, NaN)).toMatchObject({ page: 0, start: 0, end: 50 })
    expect(pageWindow(60, 1)).toMatchObject({ paginated: false, page: 0, start: 0, end: 60 })
  })
})

describe('pagerLabel', () => {
  it('reads Page n/m with the row count', () => {
    expect(pagerLabel(pageWindow(120, 0), 120)).toBe('Page 1/3 · 120 rows')
    expect(pagerLabel(pageWindow(120, 2), 120)).toBe('Page 3/3 · 120 rows')
  })
})
