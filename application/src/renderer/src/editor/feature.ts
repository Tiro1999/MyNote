import type { AnyExtension, Editor, Range } from '@tiptap/core'

export interface SlashItem {
  id: string
  title: string
  description: string
  icon: string
  keywords: string[]
  run(editor: Editor, range: Range): void
}

// See documentation/software/renderer/editor/feature-registry.md
export interface EditorFeature {
  name: string
  extensions: AnyExtension[]
  slashItems: SlashItem[]
}

export function filterSlashItems(items: SlashItem[], query: string): SlashItem[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return items
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(normalized) ||
      item.keywords.some((keyword) => keyword.toLowerCase().includes(normalized))
  )
}
