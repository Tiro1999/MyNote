import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { nanoid } from 'nanoid'
import { useFinanceStore } from '../../finance/store'
import type { Account, CategoryNode } from '../../finance/model'

interface Props {
  open: boolean
  onClose: () => void
}

const MAX_DEPTH = 4

function CategoryEditor({
  nodes,
  depth,
  onChange
}: {
  nodes: CategoryNode[]
  depth: number
  onChange: (next: CategoryNode[]) => void
}): JSX.Element {
  const update = (i: number, next: CategoryNode): void =>
    onChange(nodes.map((n, idx) => (idx === i ? next : n)))
  const remove = (i: number): void => onChange(nodes.filter((_, idx) => idx !== i))
  return (
    <ul className="ml-3 border-l border-gray-200 pl-3 dark:border-gray-800">
      {nodes.map((node, i) => (
        <li key={i} className="mt-1">
          <div className="flex items-center gap-2">
            <input
              className="rounded-sm border border-gray-300 bg-transparent px-1 text-sm dark:border-gray-700"
              value={node.name}
              onChange={(e) => update(i, { ...node, name: e.target.value.replace(/\//g, '') })}
            />
            {depth < MAX_DEPTH && (
              <button
                className="text-xs text-blue-600 dark:text-blue-400"
                onClick={() =>
                  update(i, { ...node, children: [...node.children, { name: 'Neu', children: [] }] })
                }
              >
                + Unter
              </button>
            )}
            <button className="text-xs text-red-600" onClick={() => remove(i)}>
              ✕
            </button>
          </div>
          {node.children.length > 0 && (
            <CategoryEditor
              nodes={node.children}
              depth={depth + 1}
              onChange={(next) => update(i, { ...node, children: next })}
            />
          )}
        </li>
      ))}
    </ul>
  )
}

export default function ReferenceDataDialog({ open, onClose }: Props): JSX.Element | null {
  const { saveAccounts, saveCategories, loadReferenceData } = useFinanceStore()
  const [draftAccounts, setDraftAccounts] = useState<Account[]>([])
  const [draftCategories, setDraftCategories] = useState<CategoryNode[]>([])

  useEffect(() => {
    if (!open) return
    loadReferenceData().then(() => {
      setDraftAccounts(useFinanceStore.getState().accounts)
      setDraftCategories(useFinanceStore.getState().categories)
    })
  }, [open, loadReferenceData])

  if (!open) return null

  const save = async (): Promise<void> => {
    await saveAccounts(draftAccounts)
    await saveCategories(draftCategories)
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Konten &amp; Kategorien
        </h2>

        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Konten</h3>
        {draftAccounts.map((acc, i) => (
          <div key={acc.id} className="mt-2 flex items-center gap-2">
            <input
              className="flex-1 rounded-sm border border-gray-300 bg-transparent px-2 py-1 text-sm dark:border-gray-700"
              value={acc.name}
              placeholder="Kontoname"
              onChange={(e) =>
                setDraftAccounts(
                  draftAccounts.map((a, idx) => (idx === i ? { ...a, name: e.target.value } : a))
                )
              }
            />
            <input
              className="w-28 rounded-sm border border-gray-300 bg-transparent px-2 py-1 text-sm dark:border-gray-700"
              value={acc.openingBalance}
              placeholder="Startsaldo"
              onChange={(e) =>
                setDraftAccounts(
                  draftAccounts.map((a, idx) =>
                    idx === i ? { ...a, openingBalance: e.target.value } : a
                  )
                )
              }
            />
            <button
              className="text-xs text-red-600"
              onClick={() => setDraftAccounts(draftAccounts.filter((_, idx) => idx !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400"
          onClick={() =>
            setDraftAccounts([...draftAccounts, { id: nanoid(6), name: '', openingBalance: '0' }])
          }
        >
          + Konto
        </button>

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Kategorien
        </h3>
        <CategoryEditor nodes={draftCategories} depth={1} onChange={setDraftCategories} />
        <button
          className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400"
          onClick={() => setDraftCategories([...draftCategories, { name: 'Neu', children: [] }])}
        >
          + Hauptkategorie
        </button>

        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
            onClick={onClose}
          >
            Abbrechen
          </button>
          <button
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            onClick={save}
          >
            Speichern
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
