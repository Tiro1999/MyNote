import type { AnyExtension } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import StarterKit from '@tiptap/starter-kit'
import { legacyNodes } from './blocks/legacy'
import type { EditorFeature } from './feature'
import { linkGuard } from './links/link'
import { SlashCommand } from './slash-command/SlashCommand'

export function buildExtensions(features: EditorFeature[]): AnyExtension[] {
  return [
    // Clicks on links go through linkGuard, so Link must not open them itself
    StarterKit.configure({ link: { openOnClick: false } }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TableKit.configure({ table: false }),
    ...legacyNodes,
    linkGuard,
    SlashCommand.configure({ items: features.flatMap((feature) => feature.slashItems) }),
    ...features.flatMap((feature) => feature.extensions)
  ]
}
