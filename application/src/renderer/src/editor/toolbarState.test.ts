import type { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { toolbarState } from './toolbarState'

// 'heading:2' stands for isActive('heading', { level: 2 })
function editorWith(...active: string[]): Pick<Editor, 'isActive'> {
  const isActive = (name: string, attributes?: { level?: number }): boolean =>
    active.includes(attributes?.level === undefined ? name : `${name}:${attributes.level}`)
  return { isActive } as Pick<Editor, 'isActive'>
}

describe('toolbarState', () => {
  it('has nothing active in plain text', () => {
    const states = Object.values(toolbarState(editorWith()))
    expect(states).toHaveLength(11)
    expect(states.every((active) => active === false)).toBe(true)
  })

  it('reports each mark, block and heading level on its own', () => {
    expect(toolbarState(editorWith('bold', 'underline', 'heading:2', 'orderedList'))).toEqual({
      bold: true,
      italic: false,
      underline: true,
      strike: false,
      heading1: false,
      heading2: true,
      heading3: false,
      bulletList: false,
      orderedList: true,
      codeBlock: false,
      link: false
    })
  })

  it('reports a link under the caret', () => {
    expect(toolbarState(editorWith('link')).link).toBe(true)
  })
})
