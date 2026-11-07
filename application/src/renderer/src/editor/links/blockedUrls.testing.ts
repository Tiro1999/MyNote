// Inputs that must never open: another scheme, text that is no address, and URLs the parser would rewrite
export const BLOCKED_LINK_INPUTS = [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  'file:///etc/passwd',
  'data:text/html,x',
  'ftp://example.com',
  'D:\\notes\\a.txt',
  'not a url',
  '#top',
  'https://good.com\t@example.net',
  'https://good.com\n@example.net',
  'https://good.com\u0001@example.net',
  '//evil.com',
  '\\\\evil.com\\x',
  '/x',
  'https://evil.com\\.good.com',
  'https://good.com\\@example.net',
  'http:\\\\evil.com'
]
