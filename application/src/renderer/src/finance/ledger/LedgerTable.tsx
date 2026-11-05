import { memo, useMemo, useRef, useState } from 'react'
import { messageOf } from '@shared/errors'
import { notify, usePointerDrag } from '@renderer/ui'
import type { Account, CategoryNode, Entry, EntryDraft } from '../model'
import { flattenCategories } from '../model'
import { reportFailure } from '../reportFailure'
import { ledgerOf, useFinanceStore } from '../store'
import type { LedgerState } from '../store'
import ColumnConfigPopover from './ColumnConfigPopover'
import EntryCells, { CELL_CLASS } from './EntryCells'
import { LEDGER_COLUMNS, alignClass, resolveColumns, startWidthDrag } from './columns'
import type { ColumnConfig, WidthDrag } from './columns'
import { addDraft, emptyDraft } from './draft'
import { pageWindow, pagerLabel } from './pager'
import type { PageWindow } from './pager'
import { pickReceipt } from './receipt'

const NO_COLUMNS: Record<string, ColumnConfig> = {}
const PAGER_BUTTON = 'disabled:opacity-40'

interface Props {
  ledgerId: string
  ledger: LedgerState
  accounts: Account[]
  categories: CategoryNode[]
  referenceLocked: boolean
}

interface Shared {
  columns: Record<string, ColumnConfig>
  accounts: Account[]
  categoryPaths: string[]
  referenceLocked: boolean
}

// Reads the stored columns at the moment of the call, so a change never rests on a stale copy
function saveColumn(ledgerId: string, id: string, change: (stored: ColumnConfig) => ColumnConfig): void {
  const { ledgers, saveLedgerColumns } = useFinanceStore.getState()
  const stored = ledgerOf(ledgers, ledgerId)?.meta.columns ?? NO_COLUMNS
  reportFailure(saveLedgerColumns(ledgerId, { ...stored, [id]: change(stored[id] ?? {}) }))
}

interface HeaderProps {
  label: string
  config: ColumnConfig
  onConfigure: () => void
  onResize: (width: number) => void
}

// The width follows the pointer in local state and is saved once, when the pointer is released
function ColumnHeader({ label, config, onConfigure, onResize }: HeaderProps): React.JSX.Element {
  const cell = useRef<HTMLTableCellElement>(null)
  const widthDrag = useRef<WidthDrag | null>(null)
  const [dragWidth, setDragWidth] = useState<number | null>(null)

  const drag = usePointerDrag(
    (dx) => setDragWidth(widthDrag.current?.move(dx) ?? null),
    () => {
      const width = widthDrag.current?.finish() ?? null
      widthDrag.current = null
      if (width !== null) onResize(width)
      setDragWidth(null)
    }
  )

  const width = dragWidth ?? config.width
  return (
    <th
      ref={cell}
      scope="col"
      className={`${CELL_CLASS} relative ${alignClass(config.align)}`}
      style={width ? { width } : undefined}
    >
      <button type="button" className="hover:underline" title="Configure column" onClick={onConfigure}>
        {label} ▾
      </button>
      <span
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none select-none"
        onPointerDown={(e) => {
          const th = cell.current
          if (e.button !== 0 || !th) return
          e.preventDefault()
          e.stopPropagation()
          // The canvas zoom scales the block, so the layout width differs from the width on screen
          const layout = th.offsetWidth
          widthDrag.current = startWidthDrag(layout, layout > 0 ? th.getBoundingClientRect().width / layout : 1)
          drag(e)
        }}
      />
    </th>
  )
}

interface PagerProps {
  view: PageWindow
  total: number
  onPage: (page: number) => void
}

function Pager({ view, total, onPage }: PagerProps): React.JSX.Element {
  const first = view.page === 0
  const last = view.page >= view.pageCount - 1
  return (
    <div className="mb-1 flex items-center justify-end gap-2 text-xs text-gray-500 dark:text-gray-400">
      <button type="button" aria-label="First page" className={PAGER_BUTTON} disabled={first} onClick={() => onPage(0)}>
        «
      </button>
      <button
        type="button"
        aria-label="Previous page"
        className={PAGER_BUTTON}
        disabled={first}
        onClick={() => onPage(view.page - 1)}
      >
        ‹
      </button>
      <span className="tabular-nums">{pagerLabel(view, total)}</span>
      <button
        type="button"
        aria-label="Next page"
        className={PAGER_BUTTON}
        disabled={last}
        onClick={() => onPage(view.page + 1)}
      >
        ›
      </button>
      <button
        type="button"
        aria-label="Last page"
        className={PAGER_BUTTON}
        disabled={last}
        onClick={() => onPage(view.pageCount - 1)}
      >
        »
      </button>
    </div>
  )
}

const EntryRow = memo(function EntryRow({
  ledgerId,
  entry,
  ...shared
}: Shared & { ledgerId: string; entry: Entry }): React.JSX.Element {
  const update = (next: Entry): void => reportFailure(useFinanceStore.getState().updateEntry(ledgerId, next))

  const linkReceipt = async (): Promise<void> => {
    try {
      const path = await pickReceipt()
      if (path) update({ ...entry, referenceLink: path })
    } catch (error) {
      notify(messageOf(error), 'error')
    }
  }

  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className={CELL_CLASS}>{entry.pos}</td>
      <EntryCells entry={entry} {...shared} onChange={(patch) => update({ ...entry, ...patch })} />
      <td className={`${CELL_CLASS} text-center`}>
        <button type="button" title="Link receipt" aria-label="Link receipt" onClick={linkReceipt}>
          {entry.referenceLink ? '📎' : '🔗'}
        </button>
      </td>
      <td className={`${CELL_CLASS} text-center`}>
        <button
          type="button"
          className="text-red-600"
          aria-label="Delete entry"
          onClick={() => reportFailure(useFinanceStore.getState().deleteEntry(ledgerId, entry.id))}
        >
          ✕
        </button>
      </td>
    </tr>
  )
})

function DraftRows({ ledgerId, ...shared }: Shared & { ledgerId: string }): React.JSX.Element {
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft)
  const [hint, setHint] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  // The amount field shows a text that is not an amount; the draft still holds the last valid amount
  const [amountInvalid, setAmountInvalid] = useState(false)

  const add = async (): Promise<void> => {
    setAdding(true)
    try {
      const refused = await addDraft(ledgerId, draft, amountInvalid)
      setHint(refused)
      if (refused === null) setDraft(emptyDraft())
    } catch (error) {
      notify(messageOf(error), 'error')
    } finally {
      setAdding(false)
    }
  }

  return (
    <>
      <tr className="border-t-2 border-gray-300 dark:border-gray-700">
        <td className={`${CELL_CLASS} text-gray-400`}>＋</td>
        <EntryCells
          draft
          entry={draft}
          {...shared}
          onChange={(patch) => {
            setDraft((current) => ({ ...current, ...patch }))
            setHint(null)
          }}
          onInvalidChange={setAmountInvalid}
        />
        <td className={CELL_CLASS}></td>
        <td className={CELL_CLASS}></td>
      </tr>
      <tr>
        <td colSpan={10} className="px-2 pt-2">
          <button
            type="button"
            className="rounded-sm bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:bg-blue-300"
            disabled={adding}
            onClick={add}
          >
            + Add entry
          </button>
          {hint !== null && (
            <span role="status" className="ml-3 text-amber-600 dark:text-amber-500">
              {hint}
            </span>
          )}
        </td>
      </tr>
    </>
  )
}

export default function LedgerTable({
  ledgerId,
  ledger,
  accounts,
  categories,
  referenceLocked
}: Props): React.JSX.Element {
  const { entries, meta } = ledger
  const columns = useMemo(() => resolveColumns(meta.columns ?? NO_COLUMNS, meta.currencySymbol), [meta])
  const categoryPaths = useMemo(() => flattenCategories(categories), [categories])
  const rows = useMemo(() => [...entries].reverse(), [entries])
  const [page, setPage] = useState(0)
  const [configured, setConfigured] = useState<string | null>(null)

  const view = pageWindow(rows.length, page)
  const shared: Shared = { columns, accounts, categoryPaths, referenceLocked }
  const configuredColumn = LEDGER_COLUMNS.find((column) => column.id === configured)

  return (
    <>
      {view.paginated && <Pager view={view} total={rows.length} onPage={setPage} />}
      <div className="max-h-96 overflow-auto">
        <table className="w-full table-auto border-collapse text-xs">
          <thead className="text-gray-400">
            <tr className="border-b border-gray-200 dark:border-gray-800">
              <th className={`${CELL_CLASS} w-8 text-left`}>#</th>
              {LEDGER_COLUMNS.map(({ id, label }) => (
                <ColumnHeader
                  key={id}
                  label={label}
                  config={columns[id]}
                  onConfigure={() => setConfigured(id)}
                  onResize={(width) => saveColumn(ledgerId, id, (stored) => ({ ...stored, width }))}
                />
              ))}
              <th className={`${CELL_CLASS} w-6`}></th>
              <th className={`${CELL_CLASS} w-6`}></th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(view.start, view.end).map((entry) => (
              <EntryRow key={entry.id} ledgerId={ledgerId} entry={entry} {...shared} />
            ))}
          </tbody>
          <tfoot>
            <DraftRows ledgerId={ledgerId} {...shared} />
          </tfoot>
        </table>
      </div>
      {configuredColumn && (
        <ColumnConfigPopover
          title={configuredColumn.label}
          value={columns[configuredColumn.id]}
          onChange={(next) => saveColumn(ledgerId, configuredColumn.id, () => next)}
          onResetWidth={() =>
            saveColumn(ledgerId, configuredColumn.id, ({ width: _width, ...rest }) => rest)
          }
          onClose={() => setConfigured(null)}
        />
      )}
    </>
  )
}
