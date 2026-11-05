import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Bars, EmptyChart, Line, Pie, lineY, pieSlices, type ChartDatum } from './charts'

const textOf = (html: string): string =>
  html
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const datum = (label: string, value: number, color?: string): ChartDatum => ({ label, value, color })

describe('lineY', () => {
  it('maps the value range onto the height, the highest value on top', () => {
    expect(lineY(0, 10, 40)).toBe(20)
    expect(lineY(10, 10, 40)).toBe(0)
    expect(lineY(-10, 10, 40)).toBe(40)
    expect(lineY(5, 10, 40)).toBe(10)
    expect(lineY(-5, 10, 40)).toBe(30)
  })

  it('puts every value in the middle when there is no range', () => {
    expect(lineY(0, 0, 40)).toBe(20)
    expect(lineY(7, 0, 40)).toBe(20)
    expect(lineY(7, -1, 40)).toBe(20)
    expect(lineY(7, Number.NaN, 40)).toBe(20)
  })
})

describe('pieSlices', () => {
  it('drops zero and negative values', () => {
    const slices = pieSlices([datum('a', 0), datum('b', 3), datum('c', -2), datum('d', 1)])
    expect(slices.map((slice) => slice.label)).toEqual(['b', 'd'])
  })

  it('gives every slice the share of its value, and the angles add up to 360', () => {
    const slices = pieSlices([datum('a', 1), datum('b', 1), datum('c', 2)])
    expect(slices.map((slice) => slice.angle)).toEqual([90, 90, 180])
    expect(slices.reduce((sum, slice) => sum + slice.angle, 0)).toBeCloseTo(360, 9)
  })

  it('starts each slice where the previous one ended', () => {
    const slices = pieSlices([datum('a', 1), datum('b', 1), datum('c', 2)])
    expect(slices.map((slice) => slice.start)).toEqual([0, 90, 180])
  })

  it('adds up to 360 for values that do not divide evenly', () => {
    const slices = pieSlices([datum('a', 1), datum('b', 1), datum('c', 1), datum('d', 0.1)])
    expect(slices.reduce((sum, slice) => sum + slice.angle, 0)).toBeCloseTo(360, 9)
  })

  it('makes a single slice a full circle', () => {
    const [slice, ...rest] = pieSlices([datum('only', 12345)])
    expect(rest).toEqual([])
    expect(slice).toMatchObject({ label: 'only', start: 0, angle: 360 })
  })

  it('gives nothing when no value is positive', () => {
    expect(pieSlices([])).toEqual([])
    expect(pieSlices([datum('a', 0), datum('b', -1)])).toEqual([])
  })

  it('uses the color of a datum and otherwise a palette color by the position among the slices', () => {
    const slices = pieSlices([datum('skipped', 0), datum('a', 1), datum('b', 1, '#123456'), datum('c', 1)])
    expect(slices[1].color).toBe('#123456')
    expect(slices[0].color).not.toBe(slices[2].color)
    expect(slices[0].color).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('reuses the palette for more slices than colors', () => {
    const slices = pieSlices(Array.from({ length: 25 }, (_, index) => datum(`s${index}`, 1)))
    expect(slices).toHaveLength(25)
    expect(slices.every((slice) => /^#[0-9a-f]{6}$/.test(slice.color))).toBe(true)
  })
})

describe('EmptyChart', () => {
  it('says there is no data', () => {
    expect(textOf(renderToString(createElement(EmptyChart)))).toBe('No data')
  })
})

describe('Bars', () => {
  it('shows No data for an empty list', () => {
    expect(textOf(renderToString(createElement(Bars, { data: [], symbol: '€' })))).toBe('No data')
  })

  it('shows a label, a bar and the amount for each datum, the largest at full width', () => {
    const html = renderToString(
      createElement(Bars, { data: [datum('Food', 5000), datum('Rent', 10000)], symbol: '€' })
    )
    expect(textOf(html)).toContain('Food')
    expect(textOf(html)).toContain('50,00 €')
    expect(textOf(html)).toContain('100,00 €')
    expect(html).toContain('width:50%')
    expect(html).toContain('width:100%')
  })

  it('draws no bar below zero', () => {
    const html = renderToString(createElement(Bars, { data: [datum('Refund', -300), datum('Food', 100)], symbol: '€' }))
    expect(html).not.toContain('width:-')
  })
})

describe('Pie', () => {
  it('shows No data when no value is positive', () => {
    expect(textOf(renderToString(createElement(Pie, { data: [datum('a', 0)], symbol: '€' })))).toBe('No data')
    expect(textOf(renderToString(createElement(Pie, { data: [], symbol: '€' })))).toBe('No data')
  })

  it('draws a legend with the label and the amount of each slice', () => {
    const html = renderToString(
      createElement(Pie, { data: [datum('Food', 300), datum('Rent', 700)], symbol: '€' })
    )
    expect(html).toContain('aria-label="Pie chart"')
    expect(textOf(html)).toContain('Food')
    expect(textOf(html)).toContain('3,00 €')
    expect(textOf(html)).toContain('7,00 €')
  })

  it('draws a single slice as a circle', () => {
    const html = renderToString(createElement(Pie, { data: [datum('only', 5)], symbol: '€' }))
    expect(html).toContain('<circle')
    expect(html).not.toContain('<path')
  })

  it('draws a full circle for a pair so lopsided that the arc would have no length', () => {
    const html = renderToString(
      createElement(Pie, {
        data: [datum('Income', 100000, '#22c55e'), datum('Expenses', 1, '#ef4444')],
        symbol: '€',
        innerRadius: 32,
        legend: false
      })
    )
    expect(html).toContain('<circle')
    expect(html).toMatch(/<circle[^>]*stroke="#22c55e"/)
  })

  it('draws the plain pie with the radius 40 and the donut with the ring from 32 to 48', () => {
    const pie = renderToString(createElement(Pie, { data: [datum('only', 5)], symbol: '€' }))
    expect(pie).toMatch(/<circle[^>]* r="20"/)
    expect(pie).toContain('stroke-width="40"')
    const slices = renderToString(createElement(Pie, { data: [datum('a', 1), datum('b', 1)], symbol: '€' }))
    expect(slices).toContain('A 20 20 0')
    expect(slices).toContain('stroke-width="40"')
    const donut = renderToString(createElement(Pie, { data: [datum('only', 5)], symbol: '€', innerRadius: 32 }))
    expect(donut).toMatch(/<circle[^>]* r="40"/)
    expect(donut).toContain('stroke-width="16"')
  })

  it('draws a path per slice when there are several', () => {
    const html = renderToString(createElement(Pie, { data: [datum('a', 1), datum('b', 1)], symbol: '€' }))
    expect(html.match(/<path/g)).toHaveLength(2)
  })

  it('becomes a donut with the net amount in the middle', () => {
    const html = renderToString(
      createElement(Pie, {
        data: [datum('Income', 1000, '#22c55e'), datum('Expenses', 400, '#ef4444')],
        symbol: '€',
        innerRadius: 32,
        centerLabel: '6,00 €',
        legend: false,
        ariaLabel: 'Income versus expenses'
      })
    )
    expect(html).toContain('aria-label="Income versus expenses"')
    expect(html).toContain('stroke="#22c55e"')
    expect(html).toContain('stroke="#ef4444"')
    expect(html).toContain('stroke-width="16"')
    expect(textOf(html)).toBe('6,00 €')
  })

  it('draws a full-circle donut for one slice', () => {
    const html = renderToString(
      createElement(Pie, { data: [datum('Income', 1000, '#22c55e')], symbol: '€', innerRadius: 32, legend: false })
    )
    expect(html).toContain('<circle')
    expect(html).toContain('stroke-width="16"')
    expect(html).not.toContain('<path')
  })

  it('keeps every coordinate finite', () => {
    const html = renderToString(
      createElement(Pie, { data: [datum('a', 1), datum('b', 2), datum('c', 0.5)], symbol: '€', innerRadius: 20 })
    )
    expect(html).not.toMatch(/NaN|Infinity/)
  })
})

describe('Line', () => {
  const yValues = (html: string): number[] => {
    const path = /<path d="([^"]+)"/.exec(html)?.[1] ?? ''
    return [...path.matchAll(/[ML] [\d.-]+ ([\d.-]+)/g)].map((match) => Number(match[1]))
  }

  it('shows No data for an empty list', () => {
    expect(textOf(renderToString(createElement(Line, { points: [] })))).toBe('No data')
  })

  it('keeps deficit months inside the 0 to 40 band', () => {
    const html = renderToString(
      createElement(Line, { points: [datum('2026-01', -900), datum('2026-02', 300), datum('2026-03', -100)] })
    )
    const ys = yValues(html)
    expect(ys).toHaveLength(3)
    expect(ys[0]).toBe(40)
    expect(ys[1]).toBeCloseTo(13.3333, 3)
    expect(ys[2]).toBeCloseTo(22.2222, 3)
    expect(ys.every((y) => y >= 0 && y <= 40)).toBe(true)
  })

  it('draws a zero line in the middle and keeps the stretched aspect ratio', () => {
    const html = renderToString(createElement(Line, { points: [datum('a', 5), datum('b', -5)] }))
    expect(html).toContain('<line')
    expect(html).toMatch(/y1="20"/)
    expect(html).toMatch(/y2="20"/)
    expect(html).toContain('preserveAspectRatio="none"')
    expect(html).toContain('aria-label="Trend"')
  })

  it('draws a flat line on the zero line when every value is zero', () => {
    expect(yValues(renderToString(createElement(Line, { points: [datum('a', 0), datum('b', 0)] })))).toEqual([20, 20])
  })

  it('writes no NaN for a single point', () => {
    expect(renderToString(createElement(Line, { points: [datum('a', 250)] }))).not.toMatch(/NaN|Infinity/)
  })

  it('draws a flat segment across the box for a single point', () => {
    for (const value of [250, -250, 0]) {
      const html = renderToString(createElement(Line, { points: [datum('a', value)] }))
      const path = /<path d="([^"]+)"/.exec(html)?.[1] ?? ''
      expect(path).toMatch(/^M 0 [\d.-]+ L 100 [\d.-]+$/)
      const [first, second] = yValues(html)
      expect(second).toBe(first)
    }
  })

  it('puts the flat segment of a single deficit month below the zero line', () => {
    const [y] = yValues(renderToString(createElement(Line, { points: [datum('a', -250)] })))
    expect(y).toBe(40)
  })
})
