import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import ZoomControls from './ZoomControls'

type ButtonProps = { onClick?: () => void; children?: ReactNode; 'aria-label'?: string }

function buttons(node: ReactNode): ReactElement<ButtonProps>[] {
  if (!isValidElement(node)) return []
  const element = node as ReactElement<ButtonProps>
  const own = element.type === 'button' ? [element] : []
  return [...own, ...Children.toArray(element.props.children).flatMap(buttons)]
}

describe('ZoomControls', () => {
  const onStep = vi.fn()
  const onReset = vi.fn()
  const controls = ZoomControls({ zoom: 1, onStep, onReset })

  it('shows the zoom as a rounded percentage', () => {
    expect(renderToString(createElement(ZoomControls, { zoom: 0.456, onStep, onReset }))).toContain('46%')
    expect(renderToString(createElement(ZoomControls, { zoom: 3, onStep, onReset }))).toContain('300%')
  })

  it('has zoom out, zoom in and reset buttons, in that order', () => {
    const labels = buttons(controls).map((button) => button.props['aria-label'] ?? button.props.children)
    expect(labels).toEqual(['Zoom out', 'Zoom in', 'Reset'])
  })

  it('steps the zoom down and up and resets the view', () => {
    const [out, zoomIn, reset] = buttons(controls)
    out.props.onClick?.()
    expect(onStep).toHaveBeenLastCalledWith(-1)
    zoomIn.props.onClick?.()
    expect(onStep).toHaveBeenLastCalledWith(1)
    reset.props.onClick?.()
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})
