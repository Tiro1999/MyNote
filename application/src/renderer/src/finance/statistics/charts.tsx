import { formatCents } from '../model'

export interface ChartDatum {
  label: string
  value: number
  color?: string
}

const COLORS = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#14b8a6',
  '#ec4899',
  '#64748b',
  '#84cc16',
  '#06b6d4'
]

// The pie is drawn in a 100 x 100 box around its center
const CENTER = 50
const PIE_RADIUS = 40
const DONUT_RADIUS = 48
// From this angle on a slice is drawn as a whole circle, because its arc would start and end on the same point
const FULL_CIRCLE = 359.9
const LINE_HEIGHT = 40

export function EmptyChart(): React.JSX.Element {
  return <div className="text-xs text-gray-400">No data</div>
}

export function Bars({ data, symbol }: { data: ChartDatum[]; symbol: string }): React.JSX.Element {
  if (data.length === 0) return <EmptyChart />
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex flex-col gap-1">
      {data.map((d, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <span className="w-40 truncate" title={d.label}>
            {d.label}
          </span>
          <div className="h-3 flex-1 rounded-sm bg-gray-100 dark:bg-gray-800">
            <div
              className="h-3 rounded-sm bg-blue-500"
              style={{ width: `${(Math.max(0, d.value) / max) * 100}%` }}
            />
          </div>
          <span className="w-24 text-right tabular-nums">{formatCents(d.value, symbol)}</span>
        </div>
      ))}
    </div>
  )
}

export interface PieSlice {
  label: string
  value: number
  color: string
  // Degrees clockwise from the top
  start: number
  angle: number
}

// Zero and negative values have no slice; the angles of the rest add up to 360
export function pieSlices(data: ChartDatum[]): PieSlice[] {
  const positive = data.filter((d) => Number.isFinite(d.value) && d.value > 0)
  const total = positive.reduce((sum, d) => sum + d.value, 0)
  let running = 0
  return positive.map((d, index) => {
    const start = (running / total) * 360
    running += d.value
    const color = d.color ?? COLORS[index % COLORS.length]
    return { label: d.label, value: d.value, color, start, angle: (running / total) * 360 - start }
  })
}

function arcPath(radius: number, start: number, angle: number): string {
  const point = (degrees: number): string => {
    const radians = ((degrees - 90) * Math.PI) / 180
    return `${(CENTER + radius * Math.cos(radians)).toFixed(2)} ${(CENTER + radius * Math.sin(radians)).toFixed(2)}`
  }
  return `M ${point(start)} A ${radius} ${radius} 0 ${angle > 180 ? 1 : 0} 1 ${point(start + angle)}`
}

interface PieProps {
  data: ChartDatum[]
  symbol: string
  // 0 draws a pie; a larger radius leaves a hole, which makes it a donut
  innerRadius?: number
  centerLabel?: string
  legend?: boolean
  ariaLabel?: string
}

// A slice is a stroked arc at the middle of its ring, as wide as the ring
export function Pie({
  data,
  symbol,
  innerRadius = 0,
  centerLabel,
  legend = true,
  ariaLabel = 'Pie chart'
}: PieProps): React.JSX.Element {
  const slices = pieSlices(data)
  if (slices.length === 0) return <EmptyChart />
  const outerRadius = innerRadius > 0 ? DONUT_RADIUS : PIE_RADIUS
  const radius = (outerRadius + innerRadius) / 2
  const width = outerRadius - innerRadius

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0" role="img" aria-label={ariaLabel}>
        {slices.map((slice, index) =>
          slice.angle >= FULL_CIRCLE ? (
            <circle key={index} cx={CENTER} cy={CENTER} r={radius} fill="none" stroke={slice.color} strokeWidth={width} />
          ) : (
            <path
              key={index}
              d={arcPath(radius, slice.start, slice.angle)}
              fill="none"
              stroke={slice.color}
              strokeWidth={width}
            />
          )
        )}
        {centerLabel && (
          <text x={CENTER} y="54" textAnchor="middle" className="fill-current text-[8px]">
            {centerLabel}
          </text>
        )}
      </svg>
      {legend && (
        <ul className="flex flex-col gap-0.5 text-xs">
          {slices.map((slice, index) => (
            <li key={index} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
                style={{ backgroundColor: slice.color }}
              />
              <span className="max-w-56 truncate" title={slice.label}>
                {slice.label}
              </span>
              <span className="tabular-nums text-gray-500">{formatCents(slice.value, symbol)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Maps [-maxAbs, maxAbs] onto [height, 0], so deficits sit below the middle; without a range every value is in the middle
export function lineY(value: number, maxAbs: number, height: number): number {
  if (!(maxAbs > 0)) return height / 2
  return height / 2 - (value / maxAbs) * (height / 2)
}

export function Line({ points }: { points: ChartDatum[] }): React.JSX.Element {
  if (points.length === 0) return <EmptyChart />
  const maxAbs = Math.max(...points.map((p) => Math.abs(p.value)))
  // One point is drawn as a flat segment across the box
  const drawn = points.length === 1 ? [points[0], points[0]] : points
  const step = 100 / (drawn.length - 1)
  const path = drawn
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${lineY(p.value, maxAbs, LINE_HEIGHT)}`)
    .join(' ')
  const middle = LINE_HEIGHT / 2
  return (
    <svg viewBox="0 -2 100 44" className="h-24 w-full" role="img" aria-label="Trend" preserveAspectRatio="none">
      <line
        x1="0"
        y1={middle}
        x2="100"
        y2={middle}
        stroke="currentColor"
        className="text-gray-300 dark:text-gray-600"
        strokeWidth="0.5"
      />
      <path d={path} fill="none" stroke="currentColor" className="text-blue-500" strokeWidth="1.5" />
    </svg>
  )
}
