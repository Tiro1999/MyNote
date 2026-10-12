import { formatCents } from '../../../finance/model'

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

/** Multi-slice pie chart (with legend) for a category breakdown. */
export default function Pie({
  data,
  symbol
}: {
  data: { label: string; value: number }[]
  symbol: string
}): JSX.Element {
  const slices = data.filter((d) => d.value > 0)
  const total = slices.reduce((s, d) => s + d.value, 0)
  if (total <= 0) return <div className="text-xs text-gray-400">Keine Daten</div>

  const rad = (deg: number): number => (Math.PI / 180) * deg
  const point = (deg: number): [number, number] => [
    50 + 40 * Math.cos(rad(deg)),
    50 + 40 * Math.sin(rad(deg))
  ]

  let start = -90
  const paths = slices.map((d, i) => {
    const angle = (d.value / total) * 360
    const end = start + angle
    const color = COLORS[i % COLORS.length]
    let node: JSX.Element
    if (angle >= 359.999) {
      node = <circle key={d.label} cx="50" cy="50" r="40" fill={color} />
    } else {
      const [x0, y0] = point(start)
      const [x1, y1] = point(end)
      const large = angle > 180 ? 1 : 0
      node = (
        <path
          key={d.label}
          d={`M 50 50 L ${x0.toFixed(2)} ${y0.toFixed(2)} A 40 40 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`}
          fill={color}
        />
      )
    }
    start = end
    return node
  })

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0" role="img" aria-label="Kreisdiagramm">
        {paths}
      </svg>
      <ul className="flex flex-col gap-0.5 text-xs">
        {slices.map((d, i) => (
          <li key={d.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="max-w-56 truncate" title={d.label}>
              {d.label}
            </span>
            <span className="tabular-nums text-gray-500">{formatCents(d.value, symbol)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
