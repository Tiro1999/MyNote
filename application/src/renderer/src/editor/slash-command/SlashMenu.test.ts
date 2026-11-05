import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { SlashItem } from '../feature'
import { SlashMenu, stepIndex } from './SlashMenu'

const item = (id: string, title: string): SlashItem => ({
  id,
  title,
  description: `${title} description`,
  icon: '*',
  keywords: [],
  run: () => undefined
})

const render = (items: SlashItem[]): string =>
  renderToStaticMarkup(createElement(SlashMenu, { items, command: vi.fn() }))

describe('SlashMenu', () => {
  it('lists the title and the description of every item', () => {
    const html = render([item('a', 'Alpha'), item('b', 'Beta')])
    expect(html).toContain('Alpha')
    expect(html).toContain('Alpha description')
    expect(html).toContain('Beta description')
  })

  it('highlights the first item', () => {
    const html = render([item('a', 'Alpha'), item('b', 'Beta')])
    expect(html.match(/bg-blue-100/g)).toHaveLength(1)
    expect(html.indexOf('bg-blue-100')).toBeLessThan(html.indexOf('Beta'))
  })

  it('says No results when nothing matches', () => {
    expect(render([])).toContain('No results')
  })
})

describe('stepIndex', () => {
  it('moves down and up by one', () => {
    expect(stepIndex(0, 1, 3)).toBe(1)
    expect(stepIndex(2, -1, 3)).toBe(1)
  })

  it('wraps around at both ends', () => {
    expect(stepIndex(2, 1, 3)).toBe(0)
    expect(stepIndex(0, -1, 3)).toBe(2)
  })

  it('stays on the only item', () => {
    expect(stepIndex(0, 1, 1)).toBe(0)
    expect(stepIndex(0, -1, 1)).toBe(0)
  })

  it('keeps counting when two keys arrive before the next render', () => {
    let index = 0
    index = stepIndex(index, 1, 4)
    index = stepIndex(index, 1, 4)
    expect(index).toBe(2)
  })
})
