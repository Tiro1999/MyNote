import Heading from '@tiptap/extension-heading'

/**
 * Extends the standard heading node with an `id` attribute rendered as
 * `data-heading-id`. Ids are assigned on-demand (not continuously) by the
 * "Table of contents" template command — see `tableOfContents.ts` — so a
 * `templateLink` node can scroll to this heading when clicked.
 */
export const HeadingWithId = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-heading-id'),
        renderHTML: (attributes: { id?: string | null }) => {
          if (!attributes.id) return {}
          return { 'data-heading-id': attributes.id }
        }
      }
    }
  }
})

export default HeadingWithId
