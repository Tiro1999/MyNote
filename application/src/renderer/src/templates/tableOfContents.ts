import type { Editor, Range } from '@tiptap/core'

interface HeadingEntry {
  pos: number
  level: number
  text: string
  id: string | null
}

interface TocItem {
  level: number
  text: string
  slug: string
}

interface TocTreeNode extends TocItem {
  children: TocTreeNode[]
}

/** Converts heading text into a stable, URL/DOM-safe slug for anchoring. */
function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (ä -> a, etc.)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

/** Groups a flat, ordered heading list into a nested tree by heading level. */
function buildTocTree(items: TocItem[]): TocTreeNode[] {
  const root: TocTreeNode[] = []
  const stack: TocTreeNode[] = []
  for (const item of items) {
    const node: TocTreeNode = { ...item, children: [] }
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop()
    }
    if (stack.length === 0) root.push(node)
    else stack[stack.length - 1].children.push(node)
    stack.push(node)
  }
  return root
}

/** Renders a TOC tree into TipTap/ProseMirror JSON: a nested bullet list of templateLinks. */
function tocTreeToContent(nodes: TocTreeNode[]): Record<string, unknown>[] {
  return nodes.map((node) => {
    const content: Record<string, unknown>[] = [
      {
        type: 'paragraph',
        content: [
          { type: 'templateLink', attrs: { kind: 'heading', targetId: node.slug, label: node.text } }
        ]
      }
    ]
    if (node.children.length > 0) {
      content.push({ type: 'bulletList', content: tocTreeToContent(node.children) })
    }
    return { type: 'listItem', content }
  })
}

/**
 * Scans the current page for headings, assigns each one a stable slug id
 * (only if it doesn't already have one — existing ids from a previous TOC
 * are reused), then replaces the `/toc` range with a heading followed by a
 * nested bullet list of clickable links to each heading.
 */
export function insertTableOfContents(editor: Editor, range: Range): void {
  const { state } = editor
  const headings: HeadingEntry[] = []
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headings.push({
        pos,
        level: node.attrs.level as number,
        text: node.textContent,
        id: (node.attrs.id as string | null) ?? null
      })
    }
  })

  if (headings.length === 0) {
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertContent('<p><em>Keine Überschriften auf dieser Seite gefunden.</em></p>')
      .run()
    return
  }

  const usedSlugs = new Set<string>()
  const tr = state.tr
  const items: TocItem[] = headings.map((heading, index) => {
    let slug = heading.id
    if (!slug) {
      const base = slugify(heading.text) || `abschnitt-${index + 1}`
      slug = base
      let suffix = 1
      while (usedSlugs.has(slug)) {
        slug = `${base}-${suffix}`
        suffix += 1
      }
      const node = state.doc.nodeAt(heading.pos)
      if (node) tr.setNodeMarkup(heading.pos, undefined, { ...node.attrs, id: slug })
    }
    usedSlugs.add(slug)
    return { level: heading.level, text: heading.text || `Abschnitt ${index + 1}`, slug }
  })

  if (tr.docChanged) editor.view.dispatch(tr)

  const listContent = tocTreeToContent(buildTocTree(items))

  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent([
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Inhaltsverzeichnis' }]
      },
      { type: 'bulletList', content: listContent }
    ])
    .run()
}
