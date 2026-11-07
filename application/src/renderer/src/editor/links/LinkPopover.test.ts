import type { Editor } from '@tiptap/core'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import LinkPopover from './LinkPopover'

function render(linkAttributes: { href?: string }): string {
  const editor = {
    getAttributes: (name: string) => (name === 'link' ? linkAttributes : {})
  } as unknown as Editor
  return renderToString(createElement(LinkPopover, { editor, onClose: vi.fn() }))
}

describe('LinkPopover', () => {
  it('starts with the URL of the link under the caret', () => {
    expect(render({ href: 'https://example.com/a' })).toContain('value="https://example.com/a"')
  })

  it('starts empty when the caret is not in a link', () => {
    expect(render({})).toContain('value=""')
  })

  it('offers a URL field and no file option, and shows no error at first', () => {
    const html = render({})
    expect(html).toContain('aria-label="Link URL"')
    expect(html).not.toContain('File')
    expect(html).not.toContain('role="alert"')
  })
})
