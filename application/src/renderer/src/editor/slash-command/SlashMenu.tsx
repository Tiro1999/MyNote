import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { SlashItem } from '../feature'

export interface SlashMenuProps {
  items: SlashItem[]
  command: (item: SlashItem) => void
}

export interface SlashMenuHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export function stepIndex(index: number, step: 1 | -1, count: number): number {
  return (index + step + count) % count
}

// Suggestion forwards the keys through the imperative handle
export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu(
  { items, command },
  ref
) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selected = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    selected.current = 0
    setSelectedIndex(0)
    if (listRef.current) listRef.current.scrollTop = 0
  }, [items])

  const select = (index: number): void => {
    selected.current = index
    setSelectedIndex(index)
  }

  const moveBy = (step: 1 | -1): void => {
    const index = stepIndex(selected.current, step, items.length)
    select(index)
    itemRefs.current[index]?.scrollIntoView({ block: 'nearest' })
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false
      if (event.key === 'ArrowDown') {
        moveBy(1)
        return true
      }
      if (event.key === 'ArrowUp') {
        moveBy(-1)
        return true
      }
      if (event.key === 'Enter') {
        const item = items[selected.current]
        if (item) command(item)
        return true
      }
      return false
    }
  }))

  return (
    <div
      ref={listRef}
      className="max-h-72 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-900"
    >
      {items.length === 0 ? (
        <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No results</div>
      ) : (
        items.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => {
              itemRefs.current[index] = element
            }}
            type="button"
            className={`flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
              index === selectedIndex
                ? 'bg-blue-100 dark:bg-blue-950'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            onMouseDown={(e) => {
              e.preventDefault()
              command(item)
            }}
            onMouseEnter={() => select(index)}
          >
            <span className="mt-0.5">{item.icon}</span>
            <span className="flex flex-col">
              <span className="font-medium text-gray-800 dark:text-gray-100">{item.title}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{item.description}</span>
            </span>
          </button>
        ))
      )}
    </div>
  )
})
