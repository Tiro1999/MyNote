import { useContext } from 'react'
import { openContextMenu } from '@renderer/ui'
import type { ContentKind, Notebook, PageMeta, Section } from '../model'
import { useNotebookStore } from '../store'
import { CHILD_NOUN, NOUN, OpenDialogContext } from './SidebarDialog'

const BRANCH = 'ml-3 border-l border-gray-200 dark:border-gray-800'
const ADD_BUTTON =
  'w-full py-1 text-left text-xs text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400'

const ROW_STYLE: Record<ContentKind, { size: string; selected: string; idle: string }> = {
  section: {
    size: 'py-1.5 text-sm',
    selected: 'bg-pink-50 font-semibold text-pink-700 dark:bg-pink-950/40 dark:text-pink-300',
    idle: 'text-gray-600 dark:text-gray-300'
  },
  page: {
    size: 'py-1 text-xs',
    selected: 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
    idle: 'text-gray-500 dark:text-gray-400'
  }
}

export function NotebookTree({ notebook }: { notebook: Notebook }): React.JSX.Element {
  const openDialog = useContext(OpenDialogContext)
  return (
    <div className={BRANCH}>
      {notebook.sections.map((section) => (
        <SectionNode key={section.id} section={section} />
      ))}
      <button
        type="button"
        className={`${ADD_BUTTON} pl-4`}
        onClick={() => openDialog({ type: 'addSection', notebookId: notebook.id })}
      >
        + Chapter
      </button>
    </div>
  )
}

function SectionNode({ section }: { section: Section }): React.JSX.Element {
  const addPage = (): Promise<void> => useNotebookStore.getState().addPage(section.id)
  return (
    <div>
      <TreeRow
        kind="section"
        id={section.id}
        name={section.name}
        color={section.color}
        collapsed={section.collapsed}
        hasChildren={section.pages.length > 0}
        onToggle={() => useNotebookStore.getState().toggleSectionCollapsed(section.id)}
        onAdd={addPage}
      />
      {!section.collapsed && (
        <div className={BRANCH}>
          {section.pages.map((page) => (
            <PageNode key={page.id} page={page} />
          ))}
          <button type="button" className={`${ADD_BUTTON} pl-3`} onClick={addPage}>
            + Page
          </button>
        </div>
      )}
    </div>
  )
}

function PageNode({ page }: { page: PageMeta }): React.JSX.Element {
  const hasChildren = page.children.length > 0
  return (
    <div>
      <TreeRow
        kind="page"
        id={page.id}
        name={page.title}
        collapsed={page.collapsed}
        hasChildren={hasChildren}
        onToggle={() => useNotebookStore.getState().togglePageCollapsed(page.id)}
        onAdd={() => useNotebookStore.getState().addSubpage(page.id)}
      />
      {hasChildren && !page.collapsed && (
        <div className={BRANCH}>
          {page.children.map((child) => (
            <PageNode key={child.id} page={child} />
          ))}
        </div>
      )}
    </div>
  )
}

interface TreeRowProps {
  kind: ContentKind
  id: string
  name: string
  color?: string
  collapsed?: boolean
  hasChildren: boolean
  onToggle(): void
  onAdd(): void
}

function TreeRow({ kind, id, name, color, collapsed, hasChildren, onToggle, onAdd }: TreeRowProps): React.JSX.Element {
  const openDialog = useContext(OpenDialogContext)
  const selected = useNotebookStore((state) => state.selection?.kind === kind && state.selection.id === id)
  const style = ROW_STYLE[kind]
  const child = CHILD_NOUN[kind]

  const openMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    openContextMenu(e.clientX, e.clientY, [
      { label: 'Rename', onSelect: () => openDialog({ type: 'rename', kind, id, name }) },
      { label: `New ${child}`, onSelect: onAdd },
      { label: 'Delete', danger: true, onSelect: () => openDialog({ type: 'delete', kind, id, name }) }
    ])
  }

  return (
    <div
      className={`group flex w-full items-center gap-1 pl-1 pr-2 hover:bg-gray-100 dark:hover:bg-gray-800 ${style.size} ${
        selected ? style.selected : style.idle
      }`}
      onContextMenu={openMenu}
    >
      {hasChildren ? (
        <button
          type="button"
          className="w-3 shrink-0 text-center text-[10px] text-gray-400 dark:text-gray-500"
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${NOUN[kind]}`}
          onClick={onToggle}
        >
          {collapsed ? '▸' : '▾'}
        </button>
      ) : (
        <span className="w-3 shrink-0" />
      )}
      <button
        type="button"
        className="flex flex-1 items-center gap-2 truncate text-left"
        onClick={() => useNotebookStore.getState().select({ kind, id })}
      >
        {color && <span className="h-2 w-2 shrink-0 rounded-xs" style={{ backgroundColor: color }} />}
        <span className="truncate">{name}</span>
      </button>
      <button
        type="button"
        className="hidden shrink-0 text-gray-400 hover:text-blue-600 group-hover:inline dark:text-gray-500 dark:hover:text-blue-400"
        title={`Add ${child}`}
        onClick={onAdd}
      >
        +
      </button>
    </div>
  )
}
