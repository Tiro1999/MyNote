import type { Notebook, PageMeta } from './model'

// Test helpers shared by the notebook tests
export const NOW = '2026-06-30T20:55:47.832Z'

export function page(id: string, children: PageMeta[] = []): PageMeta {
  return { id, sectionId: 's1', title: id.toUpperCase(), createdAt: NOW, updatedAt: NOW, children }
}

export function pageIds(notebooks: Notebook[]): string[] {
  const ids = (pages: PageMeta[]): string[] => pages.flatMap((p) => [p.id, ...ids(p.children)])
  return notebooks.flatMap((notebook) => notebook.sections.flatMap((section) => ids(section.pages)))
}
