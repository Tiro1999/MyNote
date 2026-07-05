export default function Line({ points }: { points: { label: string; value: number }[] }): JSX.Element {
  if (points.length === 0) return <div className="text-xs text-gray-400">Keine Daten</div>
  const max = Math.max(1, ...points.map((p) => Math.abs(p.value)))
  const step = points.length > 1 ? 100 / (points.length - 1) : 0
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${40 - (p.value / max) * 40}`)
    .join(' ')
  return (
    <svg viewBox="0 0 100 44" className="h-24 w-full" role="img" aria-label="Verlauf" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="currentColor" className="text-blue-500" strokeWidth="1.5" />
    </svg>
  )
}
