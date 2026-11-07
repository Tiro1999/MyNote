import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderLinkList, renderLinkListBlock, type LinkListItem } from './linkList'

type Listener = (event: { preventDefault(): void; stopPropagation(): void }) => void

class FakeElement {
  className = ''
  textContent = ''
  style: Record<string, string> = {}
  children: FakeElement[] = []
  listeners: Record<string, Listener> = {}

  constructor(readonly tag: string) {}

  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes)
  }

  replaceChildren(...nodes: FakeElement[]): void {
    this.children = nodes
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners[type] = listener
  }
}

const asElement = (element: FakeElement): HTMLElement => element as unknown as HTMLElement

function entries(container: FakeElement): FakeElement[] {
  return container.children[0].children
}

describe('link list', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: (tag: string) => new FakeElement(tag) })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders one entry per item, indented by its depth', () => {
    const container = new FakeElement('div')
    const items: LinkListItem[] = [
      { label: 'One', depth: 0, onClick: vi.fn() },
      { label: 'Two', depth: 2, onClick: vi.fn() }
    ]
    renderLinkList(asElement(container), items)
    expect(container.children[0].tag).toBe('ul')
    expect(container.children[0].className).toBe('link-list')
    expect(entries(container).map((entry) => entry.style.marginLeft)).toEqual(['0rem', '2rem'])
    expect(entries(container).map((entry) => entry.children[0].textContent)).toEqual(['One', 'Two'])
    expect(entries(container)[0].children[0].className).toBe('jump-link')
  })

  it('labels an empty title Untitled', () => {
    const container = new FakeElement('div')
    renderLinkList(asElement(container), [{ label: '', depth: 0, onClick: vi.fn() }])
    expect(entries(container)[0].children[0].textContent).toBe('Untitled')
  })

  it('calls onClick once and stops the click from reaching the editor', () => {
    const container = new FakeElement('div')
    const onClick = vi.fn()
    renderLinkList(asElement(container), [{ label: 'One', depth: 0, onClick }])
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() }
    entries(container)[0].children[0].listeners.click(event)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalled()
  })

  it('replaces the previous list on a second render', () => {
    const container = new FakeElement('div')
    renderLinkList(asElement(container), [{ label: 'Old', depth: 0, onClick: vi.fn() }])
    renderLinkList(asElement(container), [{ label: 'New', depth: 0, onClick: vi.fn() }])
    expect(container.children).toHaveLength(1)
    expect(entries(container).map((entry) => entry.children[0].textContent)).toEqual(['New'])
  })

  it('shows the title and the list in a block', () => {
    const dom = new FakeElement('div')
    renderLinkListBlock(asElement(dom), {
      title: 'Contents',
      emptyText: 'Nothing',
      items: [{ label: 'One', depth: 0, onClick: vi.fn() }]
    })
    const [title, body] = dom.children
    expect(title.className).toBe('link-list-title')
    expect(title.textContent).toBe('Contents')
    expect(body.children[0].className).toBe('link-list')
  })

  it('shows the empty text instead of a list when there are no items', () => {
    const dom = new FakeElement('div')
    renderLinkListBlock(asElement(dom), { title: 'Contents', emptyText: 'Nothing', items: [] })
    const [, body] = dom.children
    expect(body.className).toBe('link-list-empty')
    expect(body.textContent).toBe('Nothing')
    expect(body.children).toHaveLength(0)
  })
})
