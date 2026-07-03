import { CALLOUT_META, insertCallout } from './CalloutExtension'
import type { CalloutVariant } from './CalloutExtension'
import { insertTableOfContents } from './TocBlockExtension'
import { insertPageHierarchy } from './PageHierarchyBlockExtension'
import type { TemplateCommand } from './types'

/** Extra English/German search keywords per callout variant, in addition to the variant id itself. */
const CALLOUT_KEYWORDS: Record<CalloutVariant, string[]> = {
  info: ['info', 'information'],
  note: ['note', 'hinweis', 'notiz', 'notice'],
  warning: ['warning', 'warnung', 'achtung', 'caution'],
  error: ['error', 'fehler', 'problem', 'danger']
}

const CALLOUT_COMMANDS: TemplateCommand[] = (Object.keys(CALLOUT_META) as CalloutVariant[]).map(
  (variant) => {
    const meta = CALLOUT_META[variant]
    return {
      id: `callout-${variant}`,
      title: meta.label,
      description: `${meta.label}-Kasten einfügen`,
      icon: meta.icon,
      keywords: [variant, ...CALLOUT_KEYWORDS[variant]],
      action: (editor, range) => insertCallout(editor, range, variant)
    }
  }
)

const STRUCTURE_COMMANDS: TemplateCommand[] = [
  {
    id: 'table-of-contents',
    title: 'Inhaltsverzeichnis',
    description: 'Verlinkt alle Überschriften dieser Seite (aktualisiert sich automatisch)',
    icon: '📑',
    keywords: ['toc', 'table of contents', 'inhaltsverzeichnis', 'contents', 'überschriften', 'headings'],
    action: (editor, range) => insertTableOfContents(editor, range)
  },
  {
    id: 'page-hierarchy',
    title: 'Seitenhierarchie',
    description: 'Listet die Unterseiten dieser Seite/dieses Kapitels als Links auf (aktualisiert sich automatisch)',
    icon: '🗂️',
    keywords: ['subpages', 'unterseiten', 'seitenhierarchie', 'hierarchy', 'pages', 'seiten'],
    action: (editor, range, context) => insertPageHierarchy(editor, range, context)
  }
]

/** All available `/` slash commands, in menu order. */
export function getTemplateCommands(): TemplateCommand[] {
  return [...CALLOUT_COMMANDS, ...STRUCTURE_COMMANDS]
}

/** Filters commands by title or keyword against the typed query (case-insensitive substring match). */
export function filterTemplateCommands(query: string): TemplateCommand[] {
  const normalized = query.trim().toLowerCase()
  const commands = getTemplateCommands()
  if (!normalized) return commands
  return commands.filter(
    (command) =>
      command.title.toLowerCase().includes(normalized) ||
      command.keywords.some((keyword) => keyword.toLowerCase().includes(normalized))
  )
}
