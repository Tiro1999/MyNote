import { describe, it, expect } from 'vitest'
import { parseCsv, serializeCsv, detectDelimiter, stripBom } from './csv'

describe('parseCsv', () => {
  it('parses quoted fields containing the delimiter, quotes and newlines', () => {
    const text = 'a,b\r\n"x,1","he said ""hi"""\r\n"multi\nline",z'
    expect(parseCsv(text)).toEqual([
      ['a', 'b'],
      ['x,1', 'he said "hi"'],
      ['multi\nline', 'z']
    ])
  })

  it('honours a custom delimiter', () => {
    expect(parseCsv('a;b;c\r\n1;2;3', ';')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3']
    ])
  })

  it('does not emit a trailing empty row for a file ending in a newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2']
    ])
  })

  it('keeps empty fields rather than collapsing them', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']])
  })
})

describe('serializeCsv', () => {
  it('round-trips values that need quoting', () => {
    const rows = [
      ['name', 'note'],
      ['Ancestral Recall, 1993', 'says "no"'],
      ['line\nbreak', '']
    ]
    expect(parseCsv(serializeCsv(rows))).toEqual(rows)
  })

  it('quotes only the active delimiter — a comma is literal data when the delimiter is ;', () => {
    expect(serializeCsv([['a;b', 'c,d']], ';')).toBe('"a;b";c,d')
    expect(parseCsv('"a;b";c,d', ';')).toEqual([['a;b', 'c,d']])
  })
})

describe('detectDelimiter', () => {
  it('detects semicolon and tab separated headers', () => {
    expect(detectDelimiter('a;b;c\r\n1;2;3')).toBe(';')
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t')
  })

  it('defaults to comma', () => {
    expect(detectDelimiter('a,b,c')).toBe(',')
    expect(detectDelimiter('single')).toBe(',')
  })

  it('ignores delimiters inside quoted header names', () => {
    // Only one real separator; the semicolons live inside a quoted field.
    expect(detectDelimiter('"set;code;name",quantity')).toBe(',')
  })
})

describe('stripBom', () => {
  it('removes a leading UTF-8 BOM and leaves clean text untouched', () => {
    expect(stripBom('﻿Name,Quantity')).toBe('Name,Quantity')
    expect(stripBom('Name,Quantity')).toBe('Name,Quantity')
  })
})
