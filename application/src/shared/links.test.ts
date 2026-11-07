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

  it('blocks a URL with whitespace or a control character anywhere, which the parser would silently drop', () => {
    for (const url of [
      'https://good.com\t@example.net',
      'https://good.com\n@example.net',
      'https://good.com\r@example.net',
      'https://good.com\u0001@example.net',
      'https://good.com\u007f@example.net',
      'https://good.com/a b',
      ' https://a.de',
      'https://a.de\n',
      'mailto:a@example.com\tb@example.com'
    ]) {
      expect(isAllowedExternalUrl(url), JSON.stringify(url)).toBe(false)
    }
  })

  it('blocks a backslash anywhere, because the parser reads it as a slash in an http(s) URL', () => {
    for (const url of [
      'https://evil.com\\.good.com',
      'https://good.com\\@example.net',
      'http:\\\\evil.com',
      'https://a.de/x\\y',
      'https://a.de/?q=\\'
    ]) {
      expect(isAllowedExternalUrl(url), url).toBe(false)
    }
  })

  it('still allows an encoded space and the usual URL characters', () => {
    expect(isAllowedExternalUrl('https://a.de/a%20b?c=d&e=f#g')).toBe(true)
    expect(isAllowedExternalUrl('https://user@example.com:8080/x')).toBe(true)
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

  it('leaves a path-like input as it is, so the allowlist rejects it', () => {
    for (const input of ['/x', '//evil.com', '\\\\evil.com\\x', '\\x']) {
      expect(normalizeLinkInput(input)).toBe(input)
      expect(isAllowedExternalUrl(normalizeLinkInput(input)), input).toBe(false)
    }
    expect(normalizeLinkInput('  //evil.com  ')).toBe('//evil.com')
  })

  it('does not turn an input with a hidden tab or newline into an allowed URL', () => {
    for (const input of ['good.com\t@example.net', 'https://good.com\n@example.net', 'good.com\u0001@example.net']) {
      expect(isAllowedExternalUrl(normalizeLinkInput(input)), JSON.stringify(input)).toBe(false)
    }
  })

  it('keeps an existing scheme', () => {
    expect(normalizeLinkInput('http://a.de')).toBe('http://a.de')
    expect(normalizeLinkInput('mailto:someone@example.com')).toBe('mailto:someone@example.com')
    expect(normalizeLinkInput('javascript:alert(1)')).toBe('javascript:alert(1)')
  })
})
