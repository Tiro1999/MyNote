import { formatCents } from '../../../finance/model'

export default function Bars({
  data,
  symbol
}: {
  data: { label: string; value: number }[]
  symbol: string
}): JSX.Element {
  const max = Math.max(1, ...data.map((d) => d.value))
  if (data.length === 0) return <div className="text-xs text-gray-400">Keine Daten</div>
  return (
    <div className="flex flex-col gap-1">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-40 truncate" title={d.label}>
            {d.label}
          </span>
          <div className="h-3 flex-1 rounded bg-gray-100 dark:bg-gray-800">
            <div className="h-3 rounded bg-blue-500" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-24 text-right tabular-nums">{formatCents(d.value, symbol)}</span>
        </div>
      ))}
    </div>
  )
}
