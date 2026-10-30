import { afterEach, describe, expect, it, vi } from 'vitest'
import { THEME_STORAGE_KEY, applyThemeBeforeFirstPaint, readStoredTheme, useThemeStore } from './theme'

function storageWith(value: string | null): Pick<Storage, 'getItem'> {
  return { getItem: (key) => (key === THEME_STORAGE_KEY ? value : null) }
}

function stubBrowser(stored: string | null): { items: Map<string, string>; classes: Set<string> } {
  const items = new Map<string, string>()
  if (stored !== null) items.set(THEME_STORAGE_KEY, stored)
  const classes = new Set<string>()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value)
    }
  })
  vi.stubGlobal('document', {
    documentElement: {
      classList: {
        toggle: (name: string, force: boolean) => {
          if (force) classes.add(name)
          else classes.delete(name)
          return force
        }
      }
    }
  })
  return { items, classes }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readStoredTheme', () => {
  it('reads the persisted key mynote-theme', () => {
    const storage = { getItem: (key: string) => (key === 'mynote-theme' ? 'light' : null) }
    expect(readStoredTheme(storage)).toBe('light')
  })

  it('is dark when nothing is stored', () => {
    expect(readStoredTheme(storageWith(null))).toBe('dark')
  })

  it('reads dark', () => {
    expect(readStoredTheme(storageWith('dark'))).toBe('dark')
  })

  it('reads light', () => {
    expect(readStoredTheme(storageWith('light'))).toBe('light')
  })

  it('reads any other value as light, as before', () => {
    expect(readStoredTheme(storageWith('x'))).toBe('light')
  })
})

describe('applyThemeBeforeFirstPaint', () => {
  it('shows the stored light theme and syncs the store', () => {
    const { classes } = stubBrowser('light')
    classes.add('dark')
    useThemeStore.setState({ isDark: true })

    applyThemeBeforeFirstPaint()

    expect(classes.has('dark')).toBe(false)
    expect(useThemeStore.getState().isDark).toBe(false)
  })

  it('shows dark when nothing is stored', () => {
    const { classes } = stubBrowser(null)
    useThemeStore.setState({ isDark: false })

    applyThemeBeforeFirstPaint()

    expect(classes.has('dark')).toBe(true)
    expect(useThemeStore.getState().isDark).toBe(true)
  })
})

describe('useThemeStore.toggle', () => {
  it('stores the new theme and switches the dark class', () => {
    const { items, classes } = stubBrowser(null)
    applyThemeBeforeFirstPaint()

    useThemeStore.getState().toggle()
    expect(items.get(THEME_STORAGE_KEY)).toBe('light')
    expect(classes.has('dark')).toBe(false)
    expect(useThemeStore.getState().isDark).toBe(false)

    useThemeStore.getState().toggle()
    expect(items.get(THEME_STORAGE_KEY)).toBe('dark')
    expect(classes.has('dark')).toBe(true)
    expect(useThemeStore.getState().isDark).toBe(true)
  })
})
