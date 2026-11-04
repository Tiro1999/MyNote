import { CALLOUT_META, insertCallout } from '../blocks/callout'
import type { CalloutVariant } from '../blocks/callout'
import { insertTableOfContents } from '../blocks/toc'
import { insertPageHierarchy } from '../blocks/pageHierarchy'
import { insertTable } from '../blocks/table/tableCommand'
// eslint-disable-next-line no-restricted-imports -- removed in phase 4
import { insertFinanceLedger, insertFinanceStats } from '@renderer/finance'
import type { TemplateCommand } from '../feature'

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
  },
  {
    id: 'table',
    title: 'Tabelle',
    description: 'Fügt eine 3×3-Tabelle ein — per Hover-+ an den Rändern oder Rechtsklick erweiterbar',
    icon: '▦',
    keywords: ['table', 'tabelle', 'grid'],
    action: (editor, range) => insertTable(editor, range)
  }
]

const FINANCE_COMMANDS: TemplateCommand[] = [
  {
    id: 'table-usecase',
    title: 'Finanz-Tabelle (Einnahmen/Ausgaben)',
    description: 'Fügt einen CSV-gestützten Finanz-Ledger ein',
    icon: '💶',
    keywords: ['finance', 'finanzen', 'tableusecase', 'ledger', 'einnahmen', 'ausgaben', 'budget'],
    action: (editor, range) => {
      void insertFinanceLedger(editor, range)
    }
  },
  {
    id: 'statistics-from-table',
    title: 'Finanz-Statistik',
    description: 'Wertet einen Finanz-Ledger aus (Gesamt & Kategorie)',
    icon: '📊',
    keywords: ['statistics', 'statistik', 'statisticsfromtable', 'auswertung', 'charts', 'finance'],
    action: (editor, range) => insertFinanceStats(editor, range)
  }
]

/** All available `/` slash commands, in menu order. */
export function getTemplateCommands(): TemplateCommand[] {
  return [...CALLOUT_COMMANDS, ...STRUCTURE_COMMANDS, ...FINANCE_COMMANDS]
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
