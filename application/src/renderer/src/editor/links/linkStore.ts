import { create } from 'zustand'

const TRUST_STORAGE_KEY = 'mynote-trust-external-links'

function readInitialTrust(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(TRUST_STORAGE_KEY) === 'true'
}

interface ExternalLinkStore {
  /** URL awaiting user confirmation before being opened, or null if no dialog is open. */
  pendingUrl: string | null
  /** Persisted user choice: skip the confirmation dialog and always open links directly. */
  trustExternalLinks: boolean

  /** Called from the editor's link click handler. Opens directly if already trusted,
   * otherwise shows the confirmation dialog. */
  requestOpen: (url: string) => void
  /** Confirms opening the pending URL; optionally remembers the choice for next time. */
  confirmOpen: (rememberChoice: boolean) => void
  cancel: () => void
}

/**
 * Backs the "Open External Link" confirmation dialog. Kept as a standalone
 * store (rather than part of notebookStore) because it must be reachable
 * from TipTap's vanilla-JS ProseMirror click handler (ExternalLinkGuard.ts),
 * not just from React components.
 */
export const useExternalLinkStore = create<ExternalLinkStore>((set, get) => ({
  pendingUrl: null,
  trustExternalLinks: readInitialTrust(),

  requestOpen: (url) => {
    if (get().trustExternalLinks) {
      window.open(url, '_blank')
      return
    }
    set({ pendingUrl: url })
  },

  confirmOpen: (rememberChoice) => {
    const { pendingUrl } = get()
    if (!pendingUrl) return
    if (rememberChoice) {
      window.localStorage.setItem(TRUST_STORAGE_KEY, 'true')
      set({ trustExternalLinks: true })
    }
    window.open(pendingUrl, '_blank')
    set({ pendingUrl: null })
  },

  cancel: () => set({ pendingUrl: null })
}))
