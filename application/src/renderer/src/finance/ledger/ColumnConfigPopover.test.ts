import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ColumnConfig } from './columns'

interface ModalProps {
  title: string
  size?: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}

const modal = vi.hoisted(() => ({ props: null as ModalProps | null }))

vi.mock('@renderer/ui', async () => {
  const { createElement: h } = await import('react')
  return {
    buttonClass: { primary: 'primary', secondary: 'secondary', ghost: 'ghost' },
    Modal: (props: ModalProps) => {
      modal.props = props
      return h('section', { 'data-title': props.title }, props.children, props.footer)
    }
  }
})

import ColumnConfigPopover from './ColumnConfigPopover'

const numberFormat = { decimals: 2, thousands: true, currencySymbol: '€', symbolPosition: 'after' } as const

function render(value: ColumnConfig, over: Partial<Parameters<typeof ColumnConfigPopover>[0]> = {}): string {
  return renderToString(
    createElement(ColumnConfigPopover, {
      title: 'Amount',
      value,
      onChange: vi.fn(),
      onResetWidth: vi.fn(),
      onClose: vi.fn(),
      ...over
    })
  )
}

function footerButtons(): ReactElement<{ onClick?: () => void; disabled?: boolean; children: ReactNode }>[] {
  const footer = modal.props?.footer
  if (!isValidElement(footer)) throw new Error('the popover has no footer')
  return Children.toArray((footer as ReactElement<{ children: ReactNode }>).props.children) as never
}

beforeEach(() => {
  modal.props = null
})

describe('ColumnConfigPopover', () => {
  it('is a small modal titled with the column name', () => {
    render({})
    expect(modal.props?.title).toBe('Column: Amount')
    expect(modal.props?.size).toBe('sm')
  })

  it('shows the alignment choices and highlights the stored one', () => {
    const html = render({ align: 'right' })
    expect(html).toContain('Alignment')
    expect(html.match(/border-blue-500/g)).toHaveLength(1)
  })

  it('shows no number section for a column without a number format', () => {
    const html = render({ align: 'left' })
    for (const label of ['Decimals', 'Thousands separator', 'Currency symbol', 'Symbol position']) {
      expect(html).not.toContain(label)
    }
  })

  it('shows the number section, in English, when the column has a number format', () => {
    const html = render({ number: numberFormat })
    for (const label of ['Decimals', 'Thousands separator', 'Currency symbol', 'Symbol position']) {
      expect(html).toContain(label)
    }
    expect(html).toContain('>before<')
    expect(html).toContain('>after<')
    expect(html).toContain('value="2"')
    expect(html).toContain('value="€"')
  })

  it('hosts the number inputs in a div, because their error message is a div and must not sit in a span', () => {
    expect(render({ number: numberFormat })).not.toMatch(/<span[^>]*><input/)
  })

  it('has Auto width and Done in the footer, and Auto width only active while a width is set', () => {
    render({ width: 120 })
    const [auto, done] = footerButtons()
    expect(auto.props.children).toBe('Auto width')
    expect(done.props.children).toBe('Done')
    expect(auto.props.disabled).toBe(false)
    render({})
    expect(footerButtons()[0].props.disabled).toBe(true)
  })

  it('resets the width and closes through its buttons', () => {
    const onResetWidth = vi.fn()
    const onClose = vi.fn()
    render({ width: 120 }, { onResetWidth, onClose })
    const [auto, done] = footerButtons()
    auto.props.onClick?.()
    done.props.onClick?.()
    expect(onResetWidth).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('names no German word', () => {
    expect(render({ number: numberFormat })).not.toMatch(/Spalte|Ausrichtung|Nachkomma|Tausender|Währung|Fertig|davor|danach/)
  })
})
