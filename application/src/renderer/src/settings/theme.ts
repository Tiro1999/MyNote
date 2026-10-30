import { create } from 'zustand'

export const THEME_STORAGE_KEY = 'mynote-theme'

export function readStoredTheme(storage: Pick<Storage, 'getItem'>): 'dark' | 'light' {
  const stored = storage.getItem(THEME_STORAGE_KEY)
  return stored === null || stored === 'dark' ? 'dark' : 'light'
}

function setDarkClass(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark)
}

interface ThemeStore {
  isDark: boolean
  toggle: () => void
}

// isDark holds the default until applyThemeBeforeFirstPaint reads the stored theme
export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDark: true,
  toggle: () => {
    const isDark = !get().isDark
    window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light')
    setDarkClass(isDark)
    set({ isDark })
  }
}))

// main.tsx calls this before createRoot, so the first frame already has the stored theme
export function applyThemeBeforeFirstPaint(): void {
  const isDark = readStoredTheme(window.localStorage) === 'dark'
  setDarkClass(isDark)
  useThemeStore.setState({ isDark })
}
