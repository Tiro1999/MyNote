import { useState } from 'react'
import { useNotebookStore } from '../../store/notebookStore'
import type { Notebook, Section, PageMeta } from '../../types'
import TextInputDialog from '../Common/TextInputDialog'
import ContextMenu, { ContextMenuItem } from '../Common/ContextMenu'
import ThemeToggle from '../Common/ThemeToggle'

type RenameTarget = { kind: 'notebook' | 'section' | 'page'; id: string; initialValue: string }
type MenuState = { x: number; y: number; items: ContextMenuItem[] }

export default function Sidebar(): JSX.Element {
  const {
    notebooks,
    activeNotebookId,
    activeContentKind,
    activeContentId,
    setActiveNotebook,
    setActiveSection,
    setActivePage,
    addNotebook,
    addSection,
    addPage,
    addSubpage,
    renameNotebook,
    renameSection,
    renamePage,
    toggleSectionCollapsed,
    togglePageCollapsed
  } = useNotebookStore()
  const [notebookDialogOpen, setNotebookDialogOpen] = useState(false)
  const [sectionNotebookId, setSectionNotebookId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)

  const openMenu = (e: React.MouseEvent, items: ContextMenuItem[]): void => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  const handleRenameConfirm = async (value: string): Promise<void> => {
    if (!renameTarget) return
    if (renameTarget.kind === 'notebook') await renameNotebook(renameTarget.id, value)
    else if (renameTarget.kind === 'section') await renameSection(renameTarget.id, value)
    else await renamePage(renameTarget.id, value)
    setRenameTarget(null)
  }

  return (
    <>
      <aside className="flex h-full w-60 shrink-0 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-800">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Notebooks
          </span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              onClick={() => setNotebookDialogOpen(true)}
            >
              + New
            </button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto">
          {notebooks.map((nb) => (
            <div key={nb.id}>
              <button
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  activeNotebookId === nb.id
                    ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-200'
                }`}
                onClick={() => setActiveNotebook(nb.id)}
                onContextMenu={(e) =>
                  openMenu(e, [
                    {
                      label: 'Rename',
                      onClick: () => setRenameTarget({ kind: 'notebook', id: nb.id, initialValue: nb.name })
                    }
                  ])
                }
              >
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: nb.color }}
                />
                <span className="truncate">{nb.name}</span>
              </button>
              {activeNotebookId === nb.id && (
                <SectionList
                  notebook={nb}
                  activeContentKind={activeContentKind}
                  activeContentId={activeContentId}
                  onSectionClick={setActiveSection}
                  onPageClick={setActivePage}
                  onAddSection={() => setSectionNotebookId(nb.id)}
                  onAddPage={addPage}
                  onAddSubpage={addSubpage}
                  onToggleSectionCollapsed={toggleSectionCollapsed}
                  onTogglePageCollapsed={togglePageCollapsed}
                  onSectionContextMenu={(e, section) =>
                    openMenu(e, [
                      {
                        label: 'Rename',
                        onClick: () =>
                          setRenameTarget({ kind: 'section', id: section.id, initialValue: section.name })
                      },
                      { label: 'New page', onClick: () => addPage(section.id) }
                    ])
                  }
                  onPageContextMenu={(e, page) =>
                    openMenu(e, [
                      {
                        label: 'Rename',
                        onClick: () =>
                          setRenameTarget({ kind: 'page', id: page.id, initialValue: page.title })
                      },
                      { label: 'New subpage', onClick: () => addSubpage(page.id) }
                    ])
                  }
                />
              )}
            </div>
          ))}
        </nav>
      </aside>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
      <TextInputDialog
        open={notebookDialogOpen}
        title="Create notebook"
        label="Notebook name"
        confirmLabel="Create"
        onCancel={() => setNotebookDialogOpen(false)}
        onConfirm={async (name) => {
          await addNotebook(name)
          setNotebookDialogOpen(false)
        }}
      />
      <TextInputDialog
        open={sectionNotebookId !== null}
        title="Create chapter"
        label="Chapter name"
        confirmLabel="Create"
        onCancel={() => setSectionNotebookId(null)}
        onConfirm={async (name) => {
          if (!sectionNotebookId) return
          await addSection(sectionNotebookId, name)
          setSectionNotebookId(null)
        }}
      />
      <TextInputDialog
        open={renameTarget !== null}
        title={
          renameTarget?.kind === 'notebook'
            ? 'Rename notebook'
            : renameTarget?.kind === 'section'
              ? 'Rename chapter'
              : 'Rename page'
        }
        label="Name"
        confirmLabel="Rename"
        initialValue={renameTarget?.initialValue ?? ''}
        onCancel={() => setRenameTarget(null)}
        onConfirm={handleRenameConfirm}
      />
    </>
  )
}

function SectionList({
  notebook,
  activeContentKind,
  activeContentId,
  onSectionClick,
  onPageClick,
  onAddSection,
  onAddPage,
  onAddSubpage,
  onToggleSectionCollapsed,
  onTogglePageCollapsed,
  onSectionContextMenu,
  onPageContextMenu
}: {
  notebook: Notebook
  activeContentKind: 'section' | 'page' | null
  activeContentId: string | null
  onSectionClick: (id: string) => void
  onPageClick: (id: string) => Promise<void>
  onAddSection: () => void
  onAddPage: (sectionId: string) => void
  onAddSubpage: (parentPageId: string) => void
  onToggleSectionCollapsed: (id: string) => void
  onTogglePageCollapsed: (id: string) => void
  onSectionContextMenu: (e: React.MouseEvent, section: Section) => void
  onPageContextMenu: (e: React.MouseEvent, page: PageMeta) => void
}): JSX.Element {
  return (
    <div className="ml-3 border-l border-gray-200 dark:border-gray-800">
      {notebook.sections.map((section) => {
        const hasPages = section.pages.length > 0
        const isActive = activeContentKind === 'section' && activeContentId === section.id
        return (
          <div key={section.id}>
            <div
              className={`group flex w-full items-center gap-1 py-1.5 pl-1 pr-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${
                isActive
                  ? 'bg-pink-50 font-semibold text-pink-700 dark:bg-pink-950/40 dark:text-pink-300'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
              onContextMenu={(e) => onSectionContextMenu(e, section)}
            >
              <button
                className="w-3 shrink-0 text-center text-[10px] text-gray-400 dark:text-gray-500"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleSectionCollapsed(section.id)
                }}
                aria-label={section.collapsed ? 'Expand chapter' : 'Collapse chapter'}
              >
                {hasPages ? (section.collapsed ? '▸' : '▾') : ''}
              </button>
              <button
                className="flex flex-1 items-center gap-2 truncate text-left"
                onClick={() => onSectionClick(section.id)}
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: section.color }}
                />
                <span className="truncate">{section.name}</span>
              </button>
              <button
                className="hidden shrink-0 text-gray-400 hover:text-blue-600 group-hover:inline dark:text-gray-500 dark:hover:text-blue-400"
                title="Add page"
                onClick={(e) => {
                  e.stopPropagation()
                  onAddPage(section.id)
                }}
              >
                +
              </button>
            </div>
            {!section.collapsed && (
              <PageList
                section={section}
                activeContentKind={activeContentKind}
                activeContentId={activeContentId}
                onPageClick={onPageClick}
                onTogglePageCollapsed={onTogglePageCollapsed}
                onAddPage={() => onAddPage(section.id)}
                onAddSubpage={onAddSubpage}
                onPageContextMenu={onPageContextMenu}
              />
            )}
          </div>
        )
      })}
      <button
        className="w-full py-1 pl-4 text-left text-xs text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400"
        onClick={onAddSection}
      >
        + Chapter
      </button>
    </div>
  )
}

function PageList({
  section,
  activeContentKind,
  activeContentId,
  onPageClick,
  onTogglePageCollapsed,
  onAddPage,
  onAddSubpage,
  onPageContextMenu
}: {
  section: Section
  activeContentKind: 'section' | 'page' | null
  activeContentId: string | null
  onPageClick: (id: string) => Promise<void>
  onTogglePageCollapsed: (id: string) => void
  onAddPage: () => void
  onAddSubpage: (parentPageId: string) => void
  onPageContextMenu: (e: React.MouseEvent, page: PageMeta) => void
}): JSX.Element {
  return (
    <div className="ml-3 border-l border-gray-200 dark:border-gray-800">
      {section.pages.map((page) => (
        <PageNode
          key={page.id}
          page={page}
          activeContentKind={activeContentKind}
          activeContentId={activeContentId}
          onPageClick={onPageClick}
          onTogglePageCollapsed={onTogglePageCollapsed}
          onAddSubpage={onAddSubpage}
          onPageContextMenu={onPageContextMenu}
        />
      ))}
      <button
        className="w-full py-1 pl-3 text-left text-xs text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400"
        onClick={onAddPage}
      >
        + Page
      </button>
    </div>
  )
}

function PageNode({
  page,
  activeContentKind,
  activeContentId,
  onPageClick,
  onTogglePageCollapsed,
  onAddSubpage,
  onPageContextMenu
}: {
  page: PageMeta
  activeContentKind: 'section' | 'page' | null
  activeContentId: string | null
  onPageClick: (id: string) => Promise<void>
  onTogglePageCollapsed: (id: string) => void
  onAddSubpage: (parentPageId: string) => void
  onPageContextMenu: (e: React.MouseEvent, page: PageMeta) => void
}): JSX.Element {
  const hasChildren = page.children.length > 0
  const isActive = activeContentKind === 'page' && activeContentId === page.id

  return (
    <div>
      <div
        className={`group flex w-full items-center gap-1 py-1 pl-1 pr-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 ${
          isActive
            ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
            : 'text-gray-500 dark:text-gray-400'
        }`}
        onContextMenu={(e) => onPageContextMenu(e, page)}
      >
        <button
          className="w-3 shrink-0 text-center text-[10px] text-gray-400 dark:text-gray-500"
          onClick={(e) => {
            e.stopPropagation()
            if (hasChildren) onTogglePageCollapsed(page.id)
          }}
          aria-label={page.collapsed ? 'Expand page' : 'Collapse page'}
        >
          {hasChildren ? (page.collapsed ? '▸' : '▾') : ''}
        </button>
        <button className="flex-1 truncate text-left" onClick={() => onPageClick(page.id)}>
          {page.title}
        </button>
        <button
          className="hidden shrink-0 text-gray-400 hover:text-blue-600 group-hover:inline dark:text-gray-500 dark:hover:text-blue-400"
          title="Add subpage"
          onClick={(e) => {
            e.stopPropagation()
            onAddSubpage(page.id)
          }}
        >
          +
        </button>
      </div>
      {hasChildren && !page.collapsed && (
        <div className="ml-3 border-l border-gray-200 dark:border-gray-800">
          {page.children.map((child) => (
            <PageNode
              key={child.id}
              page={child}
              activeContentKind={activeContentKind}
              activeContentId={activeContentId}
              onPageClick={onPageClick}
              onTogglePageCollapsed={onTogglePageCollapsed}
              onAddSubpage={onAddSubpage}
              onPageContextMenu={onPageContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
}
