import { describe, it, expect } from 'vitest'
import { parseCsv, serializeCsv } from './csv'

describe('rfc-4180', () => {
  it('round-trips fields with commas, quotes and newlines', () => {
    const rows = [
      ['a', 'b,c', 'd"e'],
      ['line1\nline2', '', 'x']
    ]
    const text = serializeCsv(rows)
    expect(parseCsv(text)).toEqual(rows)
  })

  it('reads CRLF and LF line ends and ignores a final line end', () => {
    expect(parseCsv('a,b\r\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ])
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ])
  })

  it('joins rows with CRLF and no final line end', () => {
    expect(serializeCsv([['a'], ['b']])).toBe('a\r\nb')
  })
})
