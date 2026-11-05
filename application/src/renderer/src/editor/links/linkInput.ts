import type { Editor } from '@tiptap/core'
import { allowedLinkUrl } from './allowedLinkUrl'

// An empty input removes the link; anything outside the allowlist is rejected (false) and changes nothing
export function applyLinkInput(editor: Editor, input: string): boolean {
  if (!input.trim()) {
    editor.chain().focus().unsetLink().run()
    return true
  }
  const href = allowedLinkUrl(input)
  if (!href) return false
  editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
  return true
}
