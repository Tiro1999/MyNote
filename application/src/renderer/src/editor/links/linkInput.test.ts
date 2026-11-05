import type { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { BLOCKED_LINK_INPUTS } from './blockedUrls.testing'
import { applyLinkInput } from './linkInput'

function fakeEditor(): { editor: Editor; calls: string[] } {
  const calls: string[] = []
  const chain = {
    focus: () => {
      calls.push('focus')
      return chain
    },
    extendMarkRange: (name: string) => {
      calls.push(`extendMarkRange ${name}`)
      return chain
    },
    setLink: (attributes: { href: string }) => {
      calls.push(`setLink ${attributes.href}`)
      return chain
    },
    unsetLink: () => {
      calls.push('unsetLink')
      return chain
    },
    run: () => {
      calls.push('run')
      return true
    }
  }
  return { editor: { chain: () => chain } as unknown as Editor, calls }
}

describe('applyLinkInput', () => {
  it('sets the trimmed URL, with https:// when the scheme is missing, on the whole link', () => {
    const { editor, calls } = fakeEditor()
    expect(applyLinkInput(editor, ' example.com/x ')).toBe(true)
    expect(calls).toEqual(['focus', 'extendMarkRange link', 'setLink https://example.com/x', 'run'])
  })

  it('keeps an http, https or mailto URL as typed', () => {
    for (const input of ['http://a.de', 'https://a.de/b?c=d', 'mailto:someone@example.com']) {
      const { editor, calls } = fakeEditor()
      expect(applyLinkInput(editor, input)).toBe(true)
      expect(calls).toContain(`setLink ${input}`)
    }
  })

  it('removes the link when the input is empty or blank', () => {
    for (const input of ['', '   ']) {
      const { editor, calls } = fakeEditor()
      expect(applyLinkInput(editor, input)).toBe(true)
      expect(calls).toEqual(['focus', 'unsetLink', 'run'])
    }
  })

  it.each(BLOCKED_LINK_INPUTS)('rejects %j and leaves the editor untouched', (input) => {
    const { editor, calls } = fakeEditor()
    expect(applyLinkInput(editor, input)).toBe(false)
    expect(calls).toEqual([])
  })
})
