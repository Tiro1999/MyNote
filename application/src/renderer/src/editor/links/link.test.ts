import type { EditorView } from '@tiptap/pm/view'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { linkGuard, linkGuardPlugin } from './link'

const { requestOpen } = vi.hoisted(() => ({ requestOpen: vi.fn() }))
vi.mock('./linkStore', () => ({ useLinkStore: { getState: () => ({ requestOpen }) } }))

interface FakeAnchor {
  getAttribute(name: string): string | null
}

class FakeElement {
  constructor(private readonly anchor: FakeAnchor | null) {}

  closest(selector: string): FakeAnchor | null {
    return selector === 'a[href]' ? this.anchor : null
  }
}

const anchorWith = (href: string | null): FakeAnchor => ({ getAttribute: () => href })

function fakeEvent(target: unknown, button = 0): PointerEvent {
  return { target, button, preventDefault: vi.fn() } as unknown as PointerEvent
}

const plugin = linkGuardPlugin()
const handlers = plugin.props.handleDOMEvents
if (!handlers?.click || !handlers.auxclick) throw new Error('linkGuardPlugin has no click handlers')
const click = handlers.click.bind(plugin)
const auxclick = handlers.auxclick.bind(plugin)

const readOnlyView = { editable: false } as unknown as EditorView

beforeAll(() => {
  vi.stubGlobal('Element', FakeElement)
})

afterEach(() => {
  requestOpen.mockClear()
})

describe('link guard click', () => {
  it('stops the navigation and sends the href attribute as written', () => {
    const event = fakeEvent(new FakeElement(anchorWith('example.com/x')))
    expect(click(readOnlyView, event)).toBe(true)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(requestOpen).toHaveBeenCalledExactlyOnceWith('example.com/x')
  })

  it('also intercepts when the text box is editable', () => {
    const event = fakeEvent(new FakeElement(anchorWith('https://example.com')))
    expect(click({ editable: true } as unknown as EditorView, event)).toBe(true)
    expect(requestOpen).toHaveBeenCalledExactlyOnceWith('https://example.com')
  })

  it('hands over a link without a value as empty text', () => {
    click(readOnlyView, fakeEvent(new FakeElement(anchorWith(null))))
    expect(requestOpen).toHaveBeenCalledExactlyOnceWith('')
  })

  it('leaves a click outside a link alone', () => {
    const event = fakeEvent(new FakeElement(null))
    expect(click(readOnlyView, event)).toBe(false)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(requestOpen).not.toHaveBeenCalled()
  })

  it('leaves a click whose target is not an element alone', () => {
    const event = fakeEvent({})
    expect(click(readOnlyView, event)).toBe(false)
    expect(requestOpen).not.toHaveBeenCalled()
  })
})

describe('link guard auxclick', () => {
  it('intercepts a middle click on a link', () => {
    const event = fakeEvent(new FakeElement(anchorWith('https://example.com')), 1)
    expect(auxclick(readOnlyView, event)).toBe(true)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(requestOpen).toHaveBeenCalledExactlyOnceWith('https://example.com')
  })

  it('leaves a right click to the context menu', () => {
    const event = fakeEvent(new FakeElement(anchorWith('https://example.com')), 2)
    expect(auxclick(readOnlyView, event)).toBe(false)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(requestOpen).not.toHaveBeenCalled()
  })
})

describe('linkGuard', () => {
  it('is the extension named linkGuard', () => {
    expect(linkGuard.name).toBe('linkGuard')
  })
})
