interface Props {
  zoom: number
  onStep(direction: 1 | -1): void
  onReset(): void
}

const HUD_BUTTON =
  'rounded-sm border border-gray-200 bg-white px-2 py-0.5 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'

export default function ZoomControls({ zoom, onStep, onReset }: Props): React.JSX.Element {
  return (
    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-300">
      <button className={HUD_BUTTON} aria-label="Zoom out" onClick={() => onStep(-1)}>
        −
      </button>
      <span className="w-12 text-center tabular-nums">{`${Math.round(zoom * 100)}%`}</span>
      <button className={HUD_BUTTON} aria-label="Zoom in" onClick={() => onStep(1)}>
        +
      </button>
      <button className={`ml-1 ${HUD_BUTTON}`} onClick={onReset}>
        Reset
      </button>
    </div>
  )
}
