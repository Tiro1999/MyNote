import { notify } from '@renderer/ui'
import { create } from 'zustand'
import { allowedLinkUrl } from './allowedLinkUrl'

const TRUST_STORAGE_KEY = 'mynote-trust-external-links'
const BLOCKED_MESSAGE = 'This link type cannot be opened.'

function readTrust(): boolean {
  try {
    return window.localStorage.getItem(TRUST_STORAGE_KEY) === 'true'
  } catch {
    // Unreadable storage means: ask every time
    return false
  }
}

function storeTrust(): void {
  try {
    window.localStorage.setItem(TRUST_STORAGE_KEY, 'true')
  } catch {
    // The choice then holds for this session only
  }
}

function notifyBlocked(): void {
  notify(BLOCKED_MESSAGE, 'error')
}

interface LinkStore {
  pendingUrl: string | null
  trustExternalLinks: boolean
  requestOpen: (href: string) => void
  confirmOpen: (rememberChoice: boolean) => void
  cancel: () => void
}

// A plain store, not React state: the link guard calls it from a ProseMirror handler. See documentation/software/renderer/editor/links.drawio.svg
export const useLinkStore = create<LinkStore>((set, get) => ({
  pendingUrl: null,
  trustExternalLinks: readTrust(),

  requestOpen: (href) => {
    const url = allowedLinkUrl(href)
    if (!url) {
      notifyBlocked()
      return
    }
    if (get().trustExternalLinks) window.open(url, '_blank')
    else set({ pendingUrl: url })
  },

  confirmOpen: (rememberChoice) => {
    const { pendingUrl } = get()
    if (!pendingUrl) return
    set({ pendingUrl: null })
    // The dialog showed pendingUrl, so exactly that string must pass the allowlist and open
    if (allowedLinkUrl(pendingUrl) !== pendingUrl) {
      notifyBlocked()
      return
    }
    if (rememberChoice) {
      storeTrust()
      set({ trustExternalLinks: true })
    }
    window.open(pendingUrl, '_blank')
  },

  cancel: () => set({ pendingUrl: null })
}))
