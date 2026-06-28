import { useNotebookStore } from '../../store/notebookStore'
import type { Notebook, Section } from '../../types'

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

  return (
    <aside className="flex flex-col h-full w-60 border-r border-gray-200 bg-gray-50 shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Notebooks
        </span>
        <button
          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
          onClick={() => {
            const name = window.prompt('Notebook name:')
            if (name?.trim()) addNotebook(name.trim())
          }}
        >
          + New
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto">
        {notebooks.map((nb) => (
          <div key={nb.id}>
            <button
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-100 ${
                activeNotebookId === nb.id
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-gray-700'
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
                onAddSection={(name) => addSection(nb.id, name)}
                onAddPage={addPage}
              />
            )}
          </div>
        ))}
      </nav>
    </aside>
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
  onAddSection: (name: string) => void
  onAddPage: (sectionId: string) => void
}): JSX.Element {
  return (
    <div className="ml-3 border-l border-gray-200">
      {notebook.sections.map((section) => (
        <div key={section.id}>
          <button
            className={`w-full text-left pl-3 pr-2 py-1.5 text-sm flex items-center gap-2 hover:bg-gray-100 ${
              activeSectionId === section.id ? 'text-pink-700 font-semibold' : 'text-gray-600'
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
        className="w-full text-left pl-4 py-1 text-xs text-gray-400 hover:text-blue-600"
        onClick={() => {
          const name = window.prompt('Section name:')
          if (name?.trim()) onAddSection(name.trim())
        }}
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
    <div className="ml-3 border-l border-gray-200">
      {section.pages.map((page) => (
        <button
          key={page.id}
          className={`w-full text-left pl-3 pr-2 py-1 text-xs hover:bg-gray-100 truncate block ${
            activePageId === page.id ? 'text-blue-700 font-semibold bg-blue-50' : 'text-gray-500'
          }`}
          onClick={() => onPageClick(page.id)}
        >
          {page.title}
        </button>
      ))}
      <button
        className="w-full text-left pl-3 py-1 text-xs text-gray-400 hover:text-blue-600"
        onClick={onAddPage}
      >
        + Page
      </button>
    </div>
  )
}
