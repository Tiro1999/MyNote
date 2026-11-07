import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

describe('ErrorBoundary', () => {
  it('renders its children while nothing failed', () => {
    const boundary = new ErrorBoundary({ children: 'content' })
    expect(boundary.render()).toBe('content')
  })

  it('shows the heading, the error message and a Reload button after a render error', () => {
    const boundary = new ErrorBoundary({ children: 'content' })
    boundary.state = ErrorBoundary.getDerivedStateFromError(new Error('page.json: bad element'))

    const html = renderToStaticMarkup(boundary.render() as ReactElement)
    expect(html).toContain('Something went wrong')
    expect(html).toContain('page.json: bad element')
    expect(html).toContain('Reload')
    expect(html).not.toContain('content')
  })

  it('shows the text of a thrown value that is not an Error', () => {
    const boundary = new ErrorBoundary({ children: null })
    boundary.state = ErrorBoundary.getDerivedStateFromError('plain text')

    expect(renderToStaticMarkup(boundary.render() as ReactElement)).toContain('plain text')
  })

  it('has no fallback before an error, so the children stay mounted', () => {
    const html = renderToStaticMarkup(
      createElement(ErrorBoundary, null, createElement('p', null, 'inside'))
    )
    expect(html).toBe('<p>inside</p>')
  })
})
