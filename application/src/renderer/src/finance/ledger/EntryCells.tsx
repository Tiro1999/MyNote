import type { Account, EntryDraft } from '../model'
import { parseTags } from '../model'
import CommitInput, { positiveAmount, tagList } from './CommitInput'
import { alignClass, applyColumnFormat } from './columns'
import type { Align, ColumnConfig } from './columns'

export const CELL_CLASS = 'px-2 py-0.5 align-middle whitespace-nowrap'
const FIELD_CLASS = 'bg-transparent field-sizing-content min-w-14 max-w-[24rem]'
const SELECT_CLASS = 'bg-transparent max-w-[24rem]'

interface Props {
  entry: EntryDraft
  // Settings of each column as it is drawn (see resolveColumns)
  columns: Record<string, ColumnConfig>
  accounts: Account[]
  categoryPaths: string[]
  // The accounts and categories could not be read, so the pickers would show a wrong list
  referenceLocked?: boolean
  // The draft row shows hints in its empty fields
  draft?: boolean
  onChange: (patch: Partial<EntryDraft>) => void
  // The amount field holds a text that is not an amount (and is not in the entry)
  onInvalidChange?: (invalid: boolean) => void
}

export default function EntryCells({
  entry,
  columns,
  accounts,
  categoryPaths,
  referenceLocked = false,
  draft = false,
  onChange,
  onInvalidChange
}: Props): React.JSX.Element {
  const alignOf = (id: string): Align | undefined => columns[id]?.align ?? (id === 'amount' ? 'right' : undefined)
  const cellClass = (id: string): string => `${CELL_CLASS} ${alignClass(alignOf(id))}`
  const fieldClass = (id: string): string => `${FIELD_CLASS} ${alignClass(alignOf(id))}`
  const hint = (text: string): string | undefined => (draft ? text : undefined)

  const accountUnknown = entry.accountId !== '' && !accounts.some((account) => account.id === entry.accountId)
  const categoryUnknown = entry.categoryPath !== '' && !categoryPaths.includes(entry.categoryPath)

  return (
    <>
      <td className={cellClass('date')}>
        <input
          className={FIELD_CLASS}
          type="date"
          aria-label="Date"
          value={entry.date}
          onChange={(e) => {
            // A cleared date keeps the old one
            if (e.target.value !== '') onChange({ date: e.target.value })
          }}
        />
      </td>
      <td className={cellClass('type')}>
        <select
          className={SELECT_CLASS}
          aria-label="Type"
          value={entry.type}
          onChange={(e) => onChange({ type: e.target.value === 'income' ? 'income' : 'expense' })}
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </td>
      <td className={cellClass('amount')}>
        <CommitInput
          className={fieldClass('amount')}
          label="Amount"
          placeholder={hint('0,00')}
          value={entry.amount}
          format={(stored) => applyColumnFormat(stored, columns.amount ?? {})}
          validate={positiveAmount}
          onCommit={(amount) => onChange({ amount })}
          onInvalidChange={onInvalidChange}
        />
      </td>
      <td className={cellClass('account')}>
        <select
          className={SELECT_CLASS}
          aria-label="Account"
          value={entry.accountId}
          disabled={referenceLocked}
          onChange={(e) => onChange({ accountId: e.target.value })}
        >
          <option value="">—</option>
          {accountUnknown && (
            <option value={entry.accountId}>{referenceLocked ? '(unavailable)' : '(deleted account)'}</option>
          )}
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </td>
      <td className={cellClass('category')}>
        <select
          className={SELECT_CLASS}
          aria-label="Category"
          value={entry.categoryPath}
          disabled={referenceLocked}
          onChange={(e) => onChange({ categoryPath: e.target.value })}
        >
          <option value="">—</option>
          {categoryUnknown && <option value={entry.categoryPath}>{entry.categoryPath}</option>}
          {categoryPaths.map((path) => (
            <option key={path} value={path}>
              {path}
            </option>
          ))}
        </select>
      </td>
      <td className={cellClass('topic')}>
        <CommitInput
          className={fieldClass('topic')}
          label="Topic"
          placeholder={hint('Topic')}
          value={entry.topic}
          onCommit={(topic) => onChange({ topic })}
        />
      </td>
      <td className={cellClass('tags')}>
        <CommitInput
          className={fieldClass('tags')}
          label="Tags"
          placeholder={hint('tag1, tag2')}
          value={entry.tags.join(', ')}
          validate={tagList}
          onCommit={(text) => onChange({ tags: parseTags(text) })}
        />
      </td>
    </>
  )
}
