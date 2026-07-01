import { useState } from 'react'
import { useNotebookStore } from '../../store/notebookStore'
import type { Notebook, Section } from '../../types'
import TextInputDialog from '../Common/TextInputDialog'
import ThemeToggle from '../Common/ThemeToggle'

export default function Sidebar(): JSX.Element {
  const {
    notebooks,
    activeNotebookId,
    activeSectionId,
    activePageId,
    setActiveNotebook,
    setActiveSection,
    setActivePage,
    addNotebook,
    addSection,
    addPage
  } = useNotebookStore()
  const [notebookDialogOpen, setNotebookDialogOpen] = useState(false)
  const [sectionNotebookId, setSectionNotebookId] = useState<string | null>(null)

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
                  activeSectionId={activeSectionId}
                  activePageId={activePageId}
                  onSectionClick={setActiveSection}
                  onPageClick={setActivePage}
                  onAddSection={() => setSectionNotebookId(nb.id)}
                  onAddPage={addPage}
                />
              )}
            </div>
          ))}
        </nav>
      </aside>
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
        title="Create section"
        label="Section name"
        confirmLabel="Create"
        onCancel={() => setSectionNotebookId(null)}
        onConfirm={async (name) => {
          if (!sectionNotebookId) return
          await addSection(sectionNotebookId, name)
          setSectionNotebookId(null)
        }}
      />
    </>
  )
}

function SectionList({
  notebook,
  activeSectionId,
  activePageId,
  onSectionClick,
  onPageClick,
  onAddSection,
  onAddPage
}: {
  notebook: Notebook
  activeSectionId: string | null
  activePageId: string | null
  onSectionClick: (id: string) => void
  onPageClick: (id: string) => Promise<void>
  onAddSection: () => void
  onAddPage: (sectionId: string) => void
}): JSX.Element {
  return (
    <div className="ml-3 border-l border-gray-200 dark:border-gray-800">
      {notebook.sections.map((section) => (
        <div key={section.id}>
          <button
            className={`flex w-full items-center gap-2 py-1.5 pl-3 pr-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${
              activeSectionId === section.id
                ? 'font-semibold text-pink-700 dark:text-pink-300'
                : 'text-gray-600 dark:text-gray-300'
            }`}
            onClick={() => onSectionClick(section.id)}
          >
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: section.color }}
            />
            <span className="truncate">{section.name}</span>
          </button>
          {activeSectionId === section.id && (
            <PageList
              section={section}
              activePageId={activePageId}
              onPageClick={onPageClick}
              onAddPage={() => onAddPage(section.id)}
            />
          )}
        </div>
      ))}
      <button
        className="w-full py-1 pl-4 text-left text-xs text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400"
        onClick={onAddSection}
      >
        + Section
      </button>
    </div>
  )
}

function PageList({
  section,
  activePageId,
  onPageClick,
  onAddPage
}: {
  section: Section
  activePageId: string | null
  onPageClick: (id: string) => Promise<void>
  onAddPage: () => void
}): JSX.Element {
  return (
    <div className="ml-3 border-l border-gray-200 dark:border-gray-800">
      {section.pages.map((page) => (
        <button
          key={page.id}
          className={`block w-full truncate py-1 pl-3 pr-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-800 ${
            activePageId === page.id
              ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
              : 'text-gray-500 dark:text-gray-400'
          }`}
          onClick={() => onPageClick(page.id)}
        >
          {page.title}
        </button>
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
