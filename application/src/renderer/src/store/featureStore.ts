import { create } from 'zustand'

/**
 * Optional feature modules, mirrored from the main process's settings file.
 *
 * Read synchronously by `templates/commands.ts` when building the slash-command
 * menu, so it is loaded once at startup rather than awaited per keystroke.
 */
interface FeatureState {
  mtgEnabled: boolean
  loaded: boolean
  load: () => Promise<void>
  setMtgEnabled: (enabled: boolean) => Promise<void>
}

export const useFeatureStore = create<FeatureState>((set) => ({
  mtgEnabled: false,
  loaded: false,

  load: async () => {
    try {
      const settings = await window.api.settings.get()
      set({ mtgEnabled: settings.mtgEnabled ?? false, loaded: true })
    } catch {
      // A missing/unreadable settings file must not break the editor; the
      // defaults simply keep optional modules off.
      set({ loaded: true })
    }
  },

  setMtgEnabled: async (enabled) => {
    const settings = await window.api.settings.setMtgEnabled(enabled)
    set({ mtgEnabled: settings.mtgEnabled })
  }
}))
