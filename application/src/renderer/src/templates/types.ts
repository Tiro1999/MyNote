import type { Editor, Range } from '@tiptap/core'

/**
 * Identifies which chapter or page is currently open in the editor, so
 * structural commands (e.g. the subpage hierarchy list) know what data to
 * look up. Mirrors `activeContentKind` / `activeContentId` from the
 * notebook store.
 */
export interface TemplateCommandContext {
  kind: 'section' | 'page' | null
  id: string | null
}

/** A single entry offered by the `/` slash-command menu. */
export interface TemplateCommand {
  /** Stable identifier, also used as the React list key. */
  id: string
  /** Text shown as the command's title in the menu. */
  title: string
  /** Short explanation shown under the title. */
  description: string
  /** Icon/emoji shown to the left of the title. */
  icon: string
  /** Extra search keywords (English + German) matched against the typed query. */
  keywords: string[]
  /** Executes the command, replacing the `/query` range that triggered it. */
  action: (editor: Editor, range: Range, context: TemplateCommandContext) => void
}
