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

  it('resolves inside a Windows notebook folder', () => {
    expect(resolveInRoot('D:\\Sync\\OneDrive\\Notizen äöü', 'nb/page.json', path.win32)).toBe(
      'D:\\Sync\\OneDrive\\Notizen äöü\\nb\\page.json'
    )
  })
})
