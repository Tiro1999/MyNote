import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ContentArea, contentKey } from './ContentArea'

describe('contentKey', () => {
  it('differs between contents, also between a chapter note and a page with the same id', () => {
    const keys = [
      contentKey({ kind: 'page', id: 'a' }),
      contentKey({ kind: 'page', id: 'b' }),
      contentKey({ kind: 'section', id: 'a' })
    ]
    expect(new Set(keys).size).toBe(3)
  })

  it('stays equal for the same content', () => {
    expect(contentKey({ kind: 'page', id: 'a' })).toBe(contentKey({ kind: 'page', id: 'a' }))
  })
})

describe('ContentArea', () => {
  it('shows the placeholder while nothing is selected', () => {
    expect(renderToStaticMarkup(createElement(ContentArea))).toContain(
      'Select or create a page to start'
    )
  })
})
