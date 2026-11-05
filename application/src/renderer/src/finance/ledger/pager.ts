// Long ledgers paginate so the grid never renders thousands of inputs at once
export const PAGE_SIZE = 50
export const PAGINATE_THRESHOLD = 100

export interface PageWindow {
  paginated: boolean
  page: number
  pageCount: number
  start: number
  end: number
}

// The rows of one page as a slice range; the page is kept inside the range
export function pageWindow(total: number, page: number): PageWindow {
  if (total <= PAGINATE_THRESHOLD) return { paginated: false, page: 0, pageCount: 1, start: 0, end: total }
  const pageCount = Math.ceil(total / PAGE_SIZE)
  const shown = Number.isFinite(page) ? Math.min(pageCount - 1, Math.max(0, Math.trunc(page))) : 0
  const start = shown * PAGE_SIZE
  return { paginated: true, page: shown, pageCount, start, end: Math.min(total, start + PAGE_SIZE) }
}

export const pagerLabel = ({ page, pageCount }: PageWindow, total: number): string =>
  `Page ${page + 1}/${pageCount} · ${total} rows`
