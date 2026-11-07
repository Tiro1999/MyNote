import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LinkConfirmDialog from './LinkConfirmDialog'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}

const { state, modal } = vi.hoisted(() => ({
  state: { pendingUrl: null as string | null, confirmOpen: vi.fn(), cancel: vi.fn() },
  modal: { props: null as ModalProps | null }
}))

vi.mock('./linkStore', () => ({
  useLinkStore: (selector: (value: typeof state) => unknown) => selector(state)
}))

vi.mock('@renderer/ui', async () => {
  const { createElement: h } = await import('react')
  return {
    buttonClass: { primary: 'primary', secondary: 'secondary' },
    Modal: (props: ModalProps) => {
      modal.props = props
      return h('section', { 'data-title': props.title }, props.children, props.footer)
    }
  }
})

function footerButtons(): { onClick: () => void }[] {
  const footer = modal.props?.footer
  if (!isValidElement(footer)) throw new Error('the dialog has no footer')
  const children = (footer as ReactElement<{ children: ReactNode }>).props.children
  return Children.toArray(children).map((child) => (child as ReactElement<{ onClick: () => void }>).props)
}

beforeEach(() => {
  state.pendingUrl = null
  state.confirmOpen.mockClear()
  state.cancel.mockClear()
  modal.props = null
})

describe('LinkConfirmDialog', () => {
  it('renders nothing while no link waits for confirmation', () => {
    expect(renderToString(createElement(LinkConfirmDialog))).toBe('')
    expect(modal.props).toBeNull()
  })

  it('shows the pending URL in a modal titled Open External Link', () => {
    state.pendingUrl = 'https://example.com/a?b=1'
    const html = renderToString(createElement(LinkConfirmDialog))
    expect(modal.props?.title).toBe('Open External Link')
    expect(html).toContain('https://example.com/a?b=1')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('remember my choice')
  })

  it('keys the dialog by its URL, so every new link starts with an unchecked box', () => {
    state.pendingUrl = 'https://example.com/a'
    const first = LinkConfirmDialog() as ReactElement
    state.pendingUrl = 'https://example.com/b'
    const second = LinkConfirmDialog() as ReactElement
    expect([first.key, second.key]).toEqual(['https://example.com/a', 'https://example.com/b'])
  })

  it('cancels when the modal closes through Escape or the backdrop', () => {
    state.pendingUrl = 'https://example.com'
    renderToString(createElement(LinkConfirmDialog))
    modal.props?.onClose()
    expect(state.cancel).toHaveBeenCalledOnce()
    expect(state.confirmOpen).not.toHaveBeenCalled()
  })

  it('has a Cancel button that cancels and an Open Link button that confirms without remembering', () => {
    state.pendingUrl = 'https://example.com'
    const html = renderToString(createElement(LinkConfirmDialog))
    expect(html).toContain('Cancel')
    expect(html).toContain('Open Link')
    const [cancelButton, openButton] = footerButtons()
    cancelButton.onClick()
    expect(state.cancel).toHaveBeenCalledOnce()
    openButton.onClick()
    expect(state.confirmOpen).toHaveBeenCalledExactlyOnceWith(false)
  })
})
