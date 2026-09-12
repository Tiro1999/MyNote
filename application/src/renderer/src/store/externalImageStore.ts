import { create } from 'zustand'

const TRUST_STORAGE_KEY = 'mynote-trust-external-images'

function readInitialTrust(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(TRUST_STORAGE_KEY) === 'true'
}

interface ExternalImageStore {
  /** Persisted: load remote images without asking. Mirrors the hyperlink trust flag. */
  trustExternalImages: boolean
  /** True while ImageUrlDialog is open. */
  pendingPrompt: boolean
  trustAll: () => void
  /** Opens the URL prompt; resolves with the entered URL, or null if cancelled. */
  promptForUrl: () => Promise<string | null>
  submitPrompt: (url: string | null) => void
}

/**
 * Remote-image counterpart to externalLinkStore. Opening a note must not silently
 * contact foreign servers, so a remote image stays unrendered until the user allows
 * it once. Kept separate from the notebook store because the URL prompt is triggered
 * from TipTap's vanilla-JS command context, not from a React handler.
 */
export const useExternalImageStore = create<ExternalImageStore>((set, get) => {
  let resolvePrompt: ((url: string | null) => void) | null = null

  return {
    trustExternalImages: readInitialTrust(),
    pendingPrompt: false,

    trustAll: () => {
      window.localStorage.setItem(TRUST_STORAGE_KEY, 'true')
      set({ trustExternalImages: true })
    },

    promptForUrl: () => {
      if (get().pendingPrompt) return Promise.resolve(null)
      set({ pendingPrompt: true })
      return new Promise<string | null>((resolve) => {
        resolvePrompt = resolve
      })
    },

    submitPrompt: (url) => {
      set({ pendingPrompt: false })
      resolvePrompt?.(url)
      resolvePrompt = null
    }
  }
})
