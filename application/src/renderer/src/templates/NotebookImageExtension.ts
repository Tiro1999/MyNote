import { Node, mergeAttributes } from '@tiptap/core'
import type { Editor, Range } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import ImageBlock from './ImageBlock'
import { browserImportDeps, importImageAsCopy, importImageAsLink } from '../images/import'
import { useExternalImageStore } from '../store/externalImageStore'
import type { ImageMode } from '../types'

export interface NotebookImageAttrs {
  mode: ImageMode
  src: string
  alt: string
  /** Display width in px; null means "intrinsic width, capped to the text box". */
  width: number | null
  naturalWidth: number | null
  naturalHeight: number | null
}

export interface NotebookImageOptions {
  /** Id of the canvas text box this editor belongs to — needed to detach an image
   * onto the canvas next to its host. Configured per TextBox instance. */
  hostElementId: string
}

/**
 * A picture in the text flow. Block-level atom, like Callout and TocBlock.
 *
 * The node stores only a short reference (mode + path/URL), never image bytes:
 * TextBox re-serializes the whole document on every keystroke, so embedded data
 * would cost megabytes per character typed.
 */
export const NotebookImage = Node.create<NotebookImageOptions>({
  name: 'notebookImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { hostElementId: '' }
  },

  addAttributes() {
    return {
      mode: { default: 'copy' as ImageMode },
      src: { default: '' },
      alt: { default: '' },
      width: { default: null },
      naturalWidth: { default: null },
      naturalHeight: { default: null }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-notebook-image]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-notebook-image': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlock)
  }
})

/** Inserts an image node at the current selection. */
export function insertNotebookImage(editor: Editor, attrs: NotebookImageAttrs): void {
  editor.chain().focus().insertContent({ type: 'notebookImage', attrs }).run()
}

/**
 * The `/…` text is removed *before* the picker opens, so a cancelled dialog leaves a
 * clean paragraph rather than the literal command text.
 */
function clearCommandRange(editor: Editor, range: Range): void {
  editor.chain().focus().deleteRange(range).run()
}

/** `/Bild` — pick a file and copy it, compressed, into the page's assets/ folder. */
export async function insertImageCopy(editor: Editor, range: Range): Promise<void> {
  clearCommandRange(editor, range)
  try {
    const imported = await importImageAsCopy(browserImportDeps())
    if (imported) insertNotebookImage(editor, imported)
  } catch (error) {
    console.error('Bild konnte nicht eingefügt werden:', error)
  }
}

/** `/Bildverknüpfung` — pick a file and reference it where it lies. */
export async function insertImageLink(editor: Editor, range: Range): Promise<void> {
  clearCommandRange(editor, range)
  try {
    const imported = await importImageAsLink(browserImportDeps())
    if (imported) insertNotebookImage(editor, imported)
  } catch (error) {
    console.error('Bildverknüpfung konnte nicht eingefügt werden:', error)
  }
}

/**
 * `/Bild aus URL` — stores the address only. Intrinsic dimensions are unknown until the
 * image is actually loaded, so the node view fills them in after its first successful
 * render; until then the box has no reserved aspect ratio.
 */
export async function insertImageFromUrl(editor: Editor, range: Range): Promise<void> {
  clearCommandRange(editor, range)
  const url = await useExternalImageStore.getState().promptForUrl()
  if (!url) return
  insertNotebookImage(editor, {
    mode: 'url',
    src: url,
    alt: '',
    width: null,
    naturalWidth: null,
    naturalHeight: null
  })
}

export default NotebookImage
