import path from 'path'
import { describe, expect, it } from 'vitest'
import { resolveInRoot } from './scope'

describe('resolveInRoot', () => {
  it('joins a folder-relative path onto the root', () => {
    expect(resolveInRoot('/data', 'notebooks.json')).toBe('/data/notebooks.json')
    expect(resolveInRoot('/data', 'nb1/s1/p1/page.json')).toBe('/data/nb1/s1/p1/page.json')
  })

  it.each([
    '',
    '.',
    '..',
    '../x',
    'a/../../x',
    '/etc/passwd',
    'a//b',
    'a\\..\\b',
    'C:/x',
    'a/./b',
    'a\u0000b',
    'a/'
  ])('rejects %j', (bad) => {
    expect(() => resolveInRoot('/data', bad)).toThrow('Path outside the notebook folder')
  })

  it.each(['a/.. ', 'a/x.', 'a/x ', 'a/...', 'x.', ' ', 'a/ '])(
    'rejects %j, because Windows strips a trailing space or dot',
    (bad) => {
      expect(() => resolveInRoot('/data', bad)).toThrow('Path outside the notebook folder: ' + bad)
    }
  )

  it.each([
    'page.json',
    'notebooks.json',
    'nb1/s1/p1/page.json',
    'nb1/s1/page.json',
    'finance/ledgers/l_1.meta.json',
    'finance/ledgers/a-b_1.csv',
    '.hidden',
    'a/ x'
  ])('accepts %j', (good) => {
    expect(resolveInRoot('/data', good)).toBe('/data/' + good)
  })

  it('leaves spaces and dots in the root path itself alone', () => {
    expect(resolveInRoot('/data/My Notes ', 'page.json')).toBe('/data/My Notes /page.json')
    expect(resolveInRoot('/data/Notes.', 'page.json')).toBe('/data/Notes./page.json')
  })

  it('resolves inside a Windows notebook folder', () => {
    expect(resolveInRoot('D:\\Sync\\OneDrive\\Notizen äöü', 'nb/page.json', path.win32)).toBe(
      'D:\\Sync\\OneDrive\\Notizen äöü\\nb\\page.json'
    )
  })
})
