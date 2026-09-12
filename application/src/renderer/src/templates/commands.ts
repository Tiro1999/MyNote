import { CALLOUT_META, insertCallout } from './CalloutExtension'
import type { CalloutVariant } from './CalloutExtension'
import { insertTableOfContents } from './TocBlockExtension'
import { insertPageHierarchy } from './PageHierarchyBlockExtension'
import { insertTable } from './TableCommand'
import { insertFinanceLedger } from './FinanceLedgerExtension'
import { insertFinanceStats } from './StatisticsBlockExtension'
import { insertImageCopy, insertImageFromUrl, insertImageLink } from './NotebookImageExtension'
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

const IMAGE_COMMANDS: TemplateCommand[] = [
  {
    id: 'image-copy',
    title: 'Bild',
    description: 'Bild auswählen und komprimiert ins Notizbuch kopieren',
    icon: '🖼️',
    keywords: ['bild', 'image', 'picture', 'foto', 'photo', 'grafik', 'kopie'],
    action: (editor, range) => {
      void insertImageCopy(editor, range)
    }
  },
  {
    id: 'image-link',
    title: 'Bildverknüpfung',
    description: 'Auf eine lokale Bilddatei verweisen, ohne sie zu kopieren',
    icon: '🔗',
    keywords: ['bild', 'bildverknüpfung', 'bildlink', 'verknüpfung', 'referenz', 'image link'],
    action: (editor, range) => {
      void insertImageLink(editor, range)
    }
  },
  {
    id: 'image-url',
    title: 'Bild aus URL',
    description: 'Bild von einer Webadresse einbinden (wird beim Anzeigen geladen)',
    icon: '🌐',
    keywords: ['bild', 'bildurl', 'url', 'web', 'www', 'internet', 'image url'],
    action: (editor, range) => {
      void insertImageFromUrl(editor, range)
    }
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
  return [...CALLOUT_COMMANDS, ...STRUCTURE_COMMANDS, ...IMAGE_COMMANDS, ...FINANCE_COMMANDS]
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
