import { Modal, buttonClass } from '@renderer/ui'
import CommitInput from './CommitInput'
import type { Validate } from './CommitInput'
import { MAX_EDIT_DECIMALS, parseDecimals } from './columns'
import type { Align, ColumnConfig, NumberFormat } from './columns'

interface Props {
  title: string
  value: ColumnConfig
  onChange: (next: ColumnConfig) => void
  onResetWidth: () => void
  onClose: () => void
}

const ALIGNS: Align[] = ['left', 'center', 'right']
const ALIGN_LABEL: Record<Align, string> = { left: '⯇', center: '≡', right: '⯈' }
const FIELD = 'w-16 rounded-sm border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-700'

const validateDecimals: Validate = (raw) => {
  const decimals = parseDecimals(raw)
  return decimals === null
    ? { error: `Enter a whole number from 0 to ${MAX_EDIT_DECIMALS}` }
    : { value: String(decimals) }
}

export default function ColumnConfigPopover({ title, value, onChange, onResetWidth, onClose }: Props): React.JSX.Element {
  const { number } = value
  const changeNumber = (patch: Partial<NumberFormat>): void => {
    if (number) onChange({ ...value, number: { ...number, ...patch } })
  }

  return (
    <Modal
      title={`Column: ${title}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={buttonClass.ghost}
            disabled={value.width === undefined}
            onClick={onResetWidth}
          >
            Auto width
          </button>
          <button type="button" className={buttonClass.primary} onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <div className="mt-3 text-xs">
        Alignment
        <div className="mt-1 flex gap-1">
          {ALIGNS.map((align) => (
            <button
              key={align}
              type="button"
              aria-label={`Align ${align}`}
              aria-pressed={(value.align ?? 'left') === align}
              className={`flex-1 rounded-sm border px-2 py-1 ${
                (value.align ?? 'left') === align
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-300 dark:border-gray-700'
              }`}
              onClick={() => onChange({ ...value, align })}
            >
              {ALIGN_LABEL[align]}
            </button>
          ))}
        </div>
      </div>

      {number && (
        <div className="mt-3 space-y-2 text-xs">
          <div className="flex items-start justify-between gap-2">
            Decimals
            <div className="flex flex-col items-end">
              <CommitInput
                className={FIELD}
                label="Decimals"
                value={String(number.decimals)}
                validate={validateDecimals}
                onCommit={(text) => changeNumber({ decimals: Number(text) })}
              />
            </div>
          </div>
          <label className="flex items-center justify-between">
            Thousands separator
            <input
              type="checkbox"
              checked={number.thousands}
              onChange={(e) => changeNumber({ thousands: e.target.checked })}
            />
          </label>
          <div className="flex items-start justify-between gap-2">
            Currency symbol
            <div className="flex flex-col items-end">
              <CommitInput
                className={FIELD}
                label="Currency symbol"
                value={number.currencySymbol}
                onCommit={(currencySymbol) => changeNumber({ currencySymbol })}
              />
            </div>
          </div>
          <label className="flex items-center justify-between">
            Symbol position
            <select
              className="rounded-sm border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-700"
              value={number.symbolPosition}
              onChange={(e) => changeNumber({ symbolPosition: e.target.value === 'before' ? 'before' : 'after' })}
            >
              <option value="before">before</option>
              <option value="after">after</option>
            </select>
          </label>
        </div>
      )}
    </Modal>
  )
}
