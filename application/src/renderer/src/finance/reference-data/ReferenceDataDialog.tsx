import { useEffect, useState } from 'react'
import { messageOf } from '@shared/errors'
import { Modal, buttonClass, notify } from '@renderer/ui'
import ErrorBox from '../ErrorBox'
import CommitInput, { signedAmount } from '../ledger/CommitInput'
import type { Account, CategoryNode } from '../model'
import { useFinanceStore } from '../store'
import { cleanCategoryName, newAccount, newCategory, saveReferenceData } from './referenceData'

const MAX_DEPTH = 4
const INPUT_CLASS =
  'rounded-sm border border-gray-300 bg-transparent px-2 py-1 text-sm disabled:opacity-50 dark:border-gray-700'
const HEADING_CLASS = 'text-xs font-semibold uppercase tracking-wider text-gray-400'
const ADD_CLASS = 'mt-2 text-xs font-medium text-blue-600 disabled:opacity-50 dark:text-blue-400'

interface CategoryEditorProps {
  nodes: CategoryNode[]
  depth: number
  onChange: (next: CategoryNode[]) => void
}

function CategoryEditor({ nodes, depth, onChange }: CategoryEditorProps): React.JSX.Element {
  const update = (index: number, next: CategoryNode): void =>
    onChange(nodes.map((node, at) => (at === index ? next : node)))
  const remove = (index: number): void => onChange(nodes.filter((_, at) => at !== index))
  return (
    <ul className="ml-3 border-l border-gray-200 pl-3 dark:border-gray-800">
      {nodes.map((node, index) => (
        <li key={index} className="mt-1">
          <div className="flex items-center gap-2">
            <input
              className={`${INPUT_CLASS} px-1`}
              value={node.name}
              placeholder="Category name"
              aria-label="Category name"
              onChange={(e) => update(index, { ...node, name: cleanCategoryName(e.target.value) })}
            />
            {depth < MAX_DEPTH && (
              <button
                type="button"
                className="text-xs text-blue-600 disabled:opacity-50 dark:text-blue-400"
                onClick={() => update(index, { ...node, children: [...node.children, newCategory()] })}
              >
                + Subcategory
              </button>
            )}
            <button
              type="button"
              className="text-xs text-red-600 disabled:opacity-50"
              aria-label="Remove category"
              onClick={() => remove(index)}
            >
              ✕
            </button>
          </div>
          {node.children.length > 0 && (
            <CategoryEditor
              nodes={node.children}
              depth={depth + 1}
              onChange={(next) => update(index, { ...node, children: next })}
            />
          )}
        </li>
      ))}
    </ul>
  )
}

interface EditorProps {
  initialAccounts: Account[]
  initialCategories: CategoryNode[]
  onClose: () => void
}

export function ReferenceDataEditor({ initialAccounts, initialCategories, onClose }: EditorProps): React.JSX.Element {
  const referenceError = useFinanceStore((state) => state.referenceError)
  const [accounts, setAccounts] = useState(initialAccounts)
  const [categories, setCategories] = useState(initialCategories)
  const [failure, setFailure] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Opening balances with text that is not a number yet; Save waits until none is left
  const [invalidCount, setInvalidCount] = useState(0)
  const locked = referenceError !== null

  const changeAccount = (id: string, patch: Partial<Account>): void =>
    setAccounts((list) => list.map((account) => (account.id === id ? { ...account, ...patch } : account)))
  const trackInvalid = (invalid: boolean): void => setInvalidCount((count) => count + (invalid ? 1 : -1))

  const save = async (): Promise<void> => {
    setSaving(true)
    setFailure(null)
    const message = await saveReferenceData(accounts, categories)
    if (message === null) {
      onClose()
    } else {
      setFailure(message)
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Reference data"
      size="lg"
      onClose={() => {
        if (!saving) onClose()
      }}
      footer={
        <>
          <button type="button" className={buttonClass.secondary} disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={buttonClass.primary}
            disabled={locked || saving || invalidCount > 0}
            onClick={save}
          >
            Save
          </button>
        </>
      }
    >
      {locked && (
        <div className="mt-3">
          <ErrorBox>{`Accounts and categories could not be read: ${referenceError}. They are not changed.`}</ErrorBox>
        </div>
      )}
      <fieldset disabled={locked || saving} className="min-w-0">
        <h3 className={`mt-4 ${HEADING_CLASS}`}>Accounts</h3>
        {accounts.map((account) => (
          <div key={account.id} className="mt-2 flex items-start gap-2">
            <input
              className={`${INPUT_CLASS} flex-1`}
              value={account.name}
              placeholder="Account name"
              aria-label="Account name"
              onChange={(e) => changeAccount(account.id, { name: e.target.value })}
            />
            <div className="flex w-28 flex-col">
              <CommitInput
                className={`${INPUT_CLASS} w-28`}
                label="Opening balance"
                placeholder="Opening balance"
                value={account.openingBalance}
                validate={signedAmount}
                onCommit={(openingBalance) => changeAccount(account.id, { openingBalance })}
                onInvalidChange={trackInvalid}
              />
            </div>
            <button
              type="button"
              className="py-1 text-xs text-red-600 disabled:opacity-50"
              aria-label="Remove account"
              onClick={() => setAccounts((list) => list.filter(({ id }) => id !== account.id))}
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className={ADD_CLASS} onClick={() => setAccounts((list) => [...list, newAccount()])}>
          + Account
        </button>

        <h3 className={`mt-5 ${HEADING_CLASS}`}>Categories</h3>
        <CategoryEditor nodes={categories} depth={1} onChange={setCategories} />
        <button type="button" className={ADD_CLASS} onClick={() => setCategories((list) => [...list, newCategory()])}>
          + Main category
        </button>
      </fieldset>
      {failure !== null && (
        <div className="mt-3">
          <ErrorBox>{failure}</ErrorBox>
        </div>
      )}
    </Modal>
  )
}

interface Props {
  onClose: () => void
}

// Mounts per opening: reads the files first, so the editor starts from what is on disk
export default function ReferenceDataDialog({ onClose }: Props): React.JSX.Element | null {
  const [initial, setInitial] = useState<{ accounts: Account[]; categories: CategoryNode[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    const open = async (): Promise<void> => {
      try {
        await useFinanceStore.getState().loadReferenceData()
      } catch (error) {
        notify(messageOf(error), 'error')
      }
      const { accounts, categories } = useFinanceStore.getState()
      if (!cancelled) setInitial({ accounts, categories })
    }
    void open()
    return () => {
      cancelled = true
    }
  }, [])

  return initial && <ReferenceDataEditor initialAccounts={initial.accounts} initialCategories={initial.categories} onClose={onClose} />
}
