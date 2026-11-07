import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import Minimap from './Minimap'

vi.mock('@renderer/ui', () => ({ usePointerDrag: () => () => {} }))

const view = { x: 0, y: 0, width: 240, height: 120 }

function render(boxes: { id: string; x: number; y: number; width: number; height: number }[]): string {
  return renderToString(createElement(Minimap, { boxes, view, onNavigate: vi.fn() }))
}

describe('Minimap', () => {
  it('draws every box and the view, fitted into the 180 x 120 map', () => {
    const html = render([{ id: 'a', x: 0, y: 0, width: 100, height: 40 }])
    expect(html).toContain('width:180px;height:120px')
    expect(html).toContain('left:30px;top:30px;width:50px;height:20px')
    expect(html).toContain('left:30px;top:30px;width:120px;height:60px')
  })

  it('draws one mark per box plus the view', () => {
    const html = render([
      { id: 'a', x: 0, y: 0, width: 100, height: 40 },
      { id: 'b', x: 100, y: 50, width: 80, height: 40 }
    ])
    expect(html.match(/bg-blue-400\/70/g)).toHaveLength(2)
    expect(html.match(/border-red-500/g)).toHaveLength(1)
  })

  it('never draws a mark smaller than 2 px', () => {
    const html = render([{ id: 'tiny', x: 0, y: 0, width: 1, height: 1 }])
    expect(html).toContain('width:2px;height:2px')
  })

  it('explains itself in English', () => {
    expect(render([])).toContain('title="Overview')
  })
})
