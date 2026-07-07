import { createPortal } from 'react-dom'
import type { Align, ColumnConfig, ColumnType } from '../../lib/columnConfig'

interface Props {
  open: boolean
  title: string
  value: ColumnConfig
  allowType: boolean
  onChange: (next: ColumnConfig) => void
  onResetWidth: () => void
  onClose: () => void
}

const ALIGNS: Align[] = ['left', 'center', 'right']
const ALIGN_LABEL: Record<Align, string> = { left: '⯇', center: '≡', right: '⯈' }

export default function ColumnConfigPopover({
  open,
  title,
  value,
  allowType,
  onChange,
  onResetWidth,
  onClose
}: Props): JSX.Element | null {
  if (!open) return null

  const type: ColumnType = value.type ?? 'text'
  const number = value.number ?? {
    decimals: 2,
    thousands: true,
    currencySymbol: '',
    symbolPosition: 'after' as const
  }
  const date = value.date ?? { pattern: 'dd.MM.yyyy' as const }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Spalte: {title}</h3>

        {allowType && (
          <label className="mt-3 block text-xs">
            Typ
            <select
              className="mt-1 block w-full rounded border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-700"
              value={type}
              onChange={(e) => onChange({ ...value, type: e.target.value as ColumnType })}
            >
              <option value="text">Text</option>
              <option value="number">Zahl</option>
              <option value="date">Datum</option>
            </select>
          </label>
        )}

        <div className="mt-3 text-xs">
          Ausrichtung
          <div className="mt-1 flex gap-1">
            {ALIGNS.map((a) => (
              <button
                key={a}
                className={`flex-1 rounded border px-2 py-1 ${
                  (value.align ?? 'left') === a
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-300 dark:border-gray-700'
                }`}
                onClick={() => onChange({ ...value, align: a })}
              >
                {ALIGN_LABEL[a]}
              </button>
            ))}
          </div>
        </div>

        {type === 'number' && (
          <div className="mt-3 space-y-2 text-xs">
            <label className="flex items-center justify-between">
              Nachkommastellen
              <input
                type="number"
                min={0}
                max={4}
                className="w-16 rounded border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-700"
                value={number.decimals}
                onChange={(e) =>
                  onChange({ ...value, number: { ...number, decimals: Number(e.target.value) } })
                }
              />
            </label>
            <label className="flex items-center justify-between">
              Tausendertrennung
              <input
                type="checkbox"
                checked={number.thousands}
                onChange={(e) =>
                  onChange({ ...value, number: { ...number, thousands: e.target.checked } })
                }
              />
            </label>
            <label className="flex items-center justify-between">
              Währungssymbol
              <input
                className="w-16 rounded border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-700"
                value={number.currencySymbol}
                onChange={(e) =>
                  onChange({ ...value, number: { ...number, currencySymbol: e.target.value } })
                }
              />
            </label>
            <label className="flex items-center justify-between">
              Symbolposition
              <select
                className="rounded border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-700"
                value={number.symbolPosition}
                onChange={(e) =>
                  onChange({
                    ...value,
                    number: { ...number, symbolPosition: e.target.value as 'before' | 'after' }
                  })
                }
              >
                <option value="before">davor</option>
                <option value="after">danach</option>
              </select>
            </label>
          </div>
        )}

        {type === 'date' && (
          <label className="mt-3 block text-xs">
            Datumsformat
            <select
              className="mt-1 block w-full rounded border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-700"
              value={date.pattern}
              onChange={(e) =>
                onChange({ ...value, date: { pattern: e.target.value as typeof date.pattern } })
              }
            >
              <option value="dd.MM.yyyy">TT.MM.JJJJ</option>
              <option value="dd.MM.yy">TT.MM.JJ</option>
              <option value="yyyy-MM-dd">JJJJ-MM-TT</option>
              <option value="MM/dd/yyyy">MM/TT/JJJJ</option>
            </select>
          </label>
        )}

        <div className="mt-4 flex items-center justify-between">
          <button className="text-xs text-gray-500 hover:underline" onClick={onResetWidth}>
            Breite auf Auto
          </button>
          <button
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            onClick={onClose}
          >
            Fertig
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
