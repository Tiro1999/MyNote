import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BLOCKED_LINK_INPUTS } from './blockedUrls.testing'
import { useLinkStore } from './linkStore'

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }))
vi.mock('@renderer/ui', () => ({ notify }))

const TRUST_KEY = 'mynote-trust-external-links'
const BLOCKED = 'This link type cannot be opened.'

function stubWindow(options: { failWrite?: boolean } = {}): {
  open: ReturnType<typeof vi.fn>
  stored: Map<string, string>
} {
  const open = vi.fn()
  const stored = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (options.failWrite) throw new Error('quota exceeded')
      stored.set(key, value)
    }
  }
  vi.stubGlobal('window', { open, localStorage })
  return { open, stored }
}

beforeEach(() => {
  notify.mockClear()
  useLinkStore.setState({ pendingUrl: null, trustExternalLinks: false })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('requestOpen', () => {
  it('asks before it opens an allowed URL', () => {
    const { open } = stubWindow()
    useLinkStore.getState().requestOpen('https://example.com/a')
    expect(useLinkStore.getState().pendingUrl).toBe('https://example.com/a')
    expect(open).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('adds https:// to an address without a scheme and trims it', () => {
    stubWindow()
    useLinkStore.getState().requestOpen(' example.com/x ')
    expect(useLinkStore.getState().pendingUrl).toBe('https://example.com/x')
  })

  it('allows a mailto link', () => {
    stubWindow()
    useLinkStore.getState().requestOpen('mailto:someone@example.com')
    expect(useLinkStore.getState().pendingUrl).toBe('mailto:someone@example.com')
  })

  it('makes the last allowed URL pending when a second link is requested', () => {
    stubWindow()
    useLinkStore.getState().requestOpen('https://first.example')
    useLinkStore.getState().requestOpen('https://second.example')
    expect(useLinkStore.getState().pendingUrl).toBe('https://second.example')
  })

  it('keeps the pending URL when a second link is blocked', () => {
    stubWindow()
    useLinkStore.getState().requestOpen('https://first.example')
    useLinkStore.getState().requestOpen('javascript:alert(1)')
    expect(useLinkStore.getState().pendingUrl).toBe('https://first.example')
    expect(notify).toHaveBeenCalledExactlyOnceWith(BLOCKED, 'error')
  })

  it('opens a trusted URL at once in a new window', () => {
    const { open } = stubWindow()
    useLinkStore.setState({ trustExternalLinks: true })
    useLinkStore.getState().requestOpen('example.com')
    expect(open).toHaveBeenCalledExactlyOnceWith('https://example.com', '_blank')
    expect(useLinkStore.getState().pendingUrl).toBeNull()
  })

  it.each([...BLOCKED_LINK_INPUTS, ''])('blocks %j with an error toast, trusted or not', (input) => {
    const { open } = stubWindow()
    for (const trustExternalLinks of [false, true]) {
      useLinkStore.setState({ trustExternalLinks })
      useLinkStore.getState().requestOpen(input)
    }
    expect(open).not.toHaveBeenCalled()
    expect(useLinkStore.getState().pendingUrl).toBeNull()
    expect(notify).toHaveBeenCalledTimes(2)
    expect(notify).toHaveBeenCalledWith(BLOCKED, 'error')
  })
})

describe('confirmOpen', () => {
  it('opens the pending URL in a new window and clears it', () => {
    const { open, stored } = stubWindow()
    useLinkStore.setState({ pendingUrl: 'https://example.com' })
    useLinkStore.getState().confirmOpen(false)
    expect(open).toHaveBeenCalledExactlyOnceWith('https://example.com', '_blank')
    expect(useLinkStore.getState().pendingUrl).toBeNull()
    expect(useLinkStore.getState().trustExternalLinks).toBe(false)
    expect(stored.size).toBe(0)
  })

  it('remembers the choice under the unchanged storage key', () => {
    const { stored } = stubWindow()
    useLinkStore.setState({ pendingUrl: 'https://example.com' })
    useLinkStore.getState().confirmOpen(true)
    expect(useLinkStore.getState().trustExternalLinks).toBe(true)
    expect(stored.get(TRUST_KEY)).toBe('true')
  })

  it('still opens and trusts for this session when the choice cannot be stored', () => {
    const { open } = stubWindow({ failWrite: true })
    useLinkStore.setState({ pendingUrl: 'https://example.com' })
    useLinkStore.getState().confirmOpen(true)
    expect(open).toHaveBeenCalledOnce()
    expect(useLinkStore.getState().trustExternalLinks).toBe(true)
  })

  it('does nothing without a pending URL', () => {
    const { open, stored } = stubWindow()
    useLinkStore.getState().confirmOpen(true)
    expect(open).not.toHaveBeenCalled()
    expect(stored.size).toBe(0)
    expect(useLinkStore.getState().trustExternalLinks).toBe(false)
  })

  it('checks the allowlist again and neither opens nor trusts a blocked URL', () => {
    const { open, stored } = stubWindow()
    useLinkStore.setState({ pendingUrl: 'javascript:alert(1)' })
    useLinkStore.getState().confirmOpen(true)
    expect(open).not.toHaveBeenCalled()
    expect(stored.size).toBe(0)
    expect(useLinkStore.getState().pendingUrl).toBeNull()
    expect(useLinkStore.getState().trustExternalLinks).toBe(false)
    expect(notify).toHaveBeenCalledExactlyOnceWith(BLOCKED, 'error')
  })
})

describe('confirmOpen with a tampered pending URL', () => {
  it.each(BLOCKED_LINK_INPUTS)('does not open %j', (pendingUrl) => {
    const { open } = stubWindow()
    useLinkStore.setState({ pendingUrl })
    useLinkStore.getState().confirmOpen(true)
    expect(open).not.toHaveBeenCalled()
    expect(useLinkStore.getState().trustExternalLinks).toBe(false)
    expect(notify).toHaveBeenCalledExactlyOnceWith(BLOCKED, 'error')
  })

  it('does not open an address the dialog showed in another form', () => {
    const { open } = stubWindow()
    useLinkStore.setState({ pendingUrl: 'example.com' })
    useLinkStore.getState().confirmOpen(false)
    expect(open).not.toHaveBeenCalled()
  })
})

describe('cancel', () => {
  it('clears the pending URL without opening it', () => {
    const { open } = stubWindow()
    useLinkStore.setState({ pendingUrl: 'https://example.com' })
    useLinkStore.getState().cancel()
    expect(useLinkStore.getState().pendingUrl).toBeNull()
    expect(open).not.toHaveBeenCalled()
  })
})

describe('trust at start-up', () => {
  async function freshStore(): Promise<typeof useLinkStore> {
    return (await import('./linkStore')).useLinkStore
  }

  it('reads the stored choice', async () => {
    const { stored } = stubWindow()
    stored.set(TRUST_KEY, 'true')
    expect((await freshStore()).getState().trustExternalLinks).toBe(true)
  })

  it('does not trust when nothing or another value is stored', async () => {
    const { stored } = stubWindow()
    expect((await freshStore()).getState().trustExternalLinks).toBe(false)
    vi.resetModules()
    stored.set(TRUST_KEY, 'yes')
    expect((await freshStore()).getState().trustExternalLinks).toBe(false)
  })

  it('does not trust when the storage cannot be read', async () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('denied')
        }
      }
    })
    expect((await freshStore()).getState().trustExternalLinks).toBe(false)
  })

  it('does not trust without a window', async () => {
    expect((await freshStore()).getState().trustExternalLinks).toBe(false)
  })

  it('leaves the open-failed subscription to the app shell', async () => {
    const onOpenFailed = vi.fn()
    vi.stubGlobal('window', {
      open: vi.fn(),
      localStorage: { getItem: () => null, setItem: () => undefined },
      api: { links: { onOpenFailed } }
    })
    const store = await freshStore()
    store.getState().requestOpen('https://example.com')
    store.getState().confirmOpen(false)
    expect(onOpenFailed).not.toHaveBeenCalled()
  })
})
