import { describe, it, expect } from 'vitest'
import { filterTemplateCommands, getTemplateCommands } from './commands'

describe('image slash commands', () => {
  it('offers the copy command first when typing /bild', () => {
    const ids = filterTemplateCommands('bild').map((command) => command.id)
    expect(ids).toEqual(['image-copy', 'image-link', 'image-url'])
  })

  it('finds the link command by its German and English keywords', () => {
    for (const query of ['verknüpfung', 'referenz', 'image link']) {
      expect(filterTemplateCommands(query).map((command) => command.id)).toContain('image-link')
    }
  })

  it('finds the copy command by photo-ish keywords', () => {
    for (const query of ['foto', 'image', 'grafik']) {
      expect(filterTemplateCommands(query).map((command) => command.id)).toContain('image-copy')
    }
  })

  it('finds the URL command by web keywords', () => {
    for (const query of ['url', 'www', 'web']) {
      expect(filterTemplateCommands(query).map((command) => command.id)).toContain('image-url')
    }
  })

  it('keeps every command id unique', () => {
    const ids = getTemplateCommands().map((command) => command.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
