import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ErrorBox from './ErrorBox'

describe('ErrorBox', () => {
  it('shows its text as a red alert', () => {
    const html = renderToString(createElement(ErrorBox, null, 'Not saved: EBUSY'))
    expect(html).toContain('role="alert"')
    expect(html).toContain('Not saved: EBUSY')
    expect(html).toContain('text-red-700')
  })
})
