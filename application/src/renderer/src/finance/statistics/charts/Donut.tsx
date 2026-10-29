import { formatCents } from '../../model'

export default function Donut({
  income,
  expense,
  symbol
}: {
  income: number
  expense: number
  symbol: string
}): JSX.Element {
  const total = income + expense || 1
  const incomeFrac = income / total
  const c = 2 * Math.PI * 40
  return (
    <svg viewBox="0 0 100 100" className="h-32 w-32" role="img" aria-label="Einnahmen vs Ausgaben">
      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-red-500" strokeWidth="16" />
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="currentColor"
        className="text-green-500"
        strokeWidth="16"
        strokeDasharray={`${c * incomeFrac} ${c}`}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="54" textAnchor="middle" className="fill-current text-[8px]">
        {formatCents(income - expense, symbol)}
      </text>
    </svg>
  )
}
