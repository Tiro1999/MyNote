import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CanvasView from './CanvasView'
import type { CanvasElement, PageContent } from './model'

const { store } = vi.hoisted(() => ({
  store: {
    content: null as PageContent | null,
    error: null as string | null,
    addElement: () => {},
    updateElement: () => {},
    commitElement: () => {},
    deleteElement: () => {}
  }
}))

vi.mock('./contentStore', () => ({
  useContentStore: (selector: (state: typeof store) => unknown) => selector(store)
}))

vi.mock('./TextBox', async () => {
  const { createElement: h } = await import('react')
  return { default: (props: { element: { id: string } }) => h('i', { 'data-box': props.element.id }) }
})

vi.mock('@renderer/ui', () => ({ usePointerDrag: () => () => {} }))

const HINT = 'Double-click anywhere to add a text box'

const box: CanvasElement = {
  id: 'b1',
  type: 'textbox',
  x: 0,
  y: 0,
  width: 320,
  height: 200,
  zIndex: 1,
  content: { type: 'doc', content: [] }
}

// Written by the image branch, which this version does not render
const image: CanvasElement = { id: 'i1', type: 'image', x: 400, y: 0, width: 120, height: 80, zIndex: 2 }

function render(): string {
  return renderToString(createElement(CanvasView, { features: [] }))
}

beforeEach(() => {
  store.content = null
  store.error = null
})

describe('CanvasView', () => {
  it('draws a text box and keeps the zoom controls', () => {
    store.content = { pageId: 'p1', elements: [box] }
    const html = render()
    expect(html).toContain('data-box="b1"')
    expect(html).toContain('100%')
  })

  it('does not draw an element of another type', () => {
    store.content = { pageId: 'p1', elements: [image, box] }
    const html = render()
    expect(html).toContain('data-box="b1"')
    expect(html).not.toContain('data-box="i1"')
  })

  it('shows the hint on an empty page only', () => {
    store.content = { pageId: 'p1', elements: [] }
    expect(render()).toContain(HINT)
    store.content = { pageId: 'p1', elements: [box] }
    expect(render()).not.toContain(HINT)
  })

  it('shows no hint while the content loads', () => {
    expect(render()).not.toContain(HINT)
  })

  it('shows no hint on a page that holds only elements this version does not draw', () => {
    store.content = { pageId: 'p1', elements: [image] }
    const html = render()
    expect(html).not.toContain(HINT)
    expect(html).not.toContain('data-box=')
  })

  it('shows the load error in red instead of the hint', () => {
    store.error = 'Unexpected token } in JSON'
    const html = render()
    expect(html).toContain('role="alert"')
    expect(html).toContain('text-red-600')
    expect(html).toContain('Couldn&#x27;t open this page: Unexpected token } in JSON')
    expect(html).not.toContain(HINT)
  })
})
