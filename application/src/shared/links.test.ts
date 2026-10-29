import { describe, expect, it } from 'vitest'
import { isAllowedExternalUrl, normalizeLinkInput } from './links'

describe('isAllowedExternalUrl', () => {
  it('allows http, https and mailto', () => {
    expect(isAllowedExternalUrl('https://a.de')).toBe(true)
    expect(isAllowedExternalUrl('http://a.de')).toBe(true)
    expect(isAllowedExternalUrl('mailto:someone@example.com')).toBe(true)
  })

  it('blocks other schemes and text that is not a URL', () => {
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedExternalUrl('not a url')).toBe(false)
  })
})

describe('normalizeLinkInput', () => {
  it('trims and prefixes https:// when no scheme is present', () => {
    expect(normalizeLinkInput(' example.com/x ')).toBe('https://example.com/x')
  })

  it('keeps an allowed protocol in any case, even when a digit follows it', () => {
    expect(normalizeLinkInput('mailto:123@example.com')).toBe('mailto:123@example.com')
    expect(normalizeLinkInput('MAILTO:a@example.com')).toBe('MAILTO:a@example.com')
  })

  it('treats host:port as missing a scheme', () => {
    expect(normalizeLinkInput('localhost:3000/x')).toBe('https://localhost:3000/x')
  })

  it('keeps an existing scheme', () => {
    expect(normalizeLinkInput('http://a.de')).toBe('http://a.de')
    expect(normalizeLinkInput('mailto:someone@example.com')).toBe('mailto:someone@example.com')
    expect(normalizeLinkInput('javascript:alert(1)')).toBe('javascript:alert(1)')
  })
})
