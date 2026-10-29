import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import type { TemplateCommand } from '../feature'

interface Props {
  items: TemplateCommand[]
  command: (item: TemplateCommand) => void
}

export interface SlashCommandMenuHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

/**
 * Floating `/`-command menu, rendered via a TipTap `ReactRenderer` and
 * positioned manually by `SlashCommandExtension` (no tippy.js — consistent
 * with the rest of the app's custom popovers, e.g. `Toolbar.tsx`'s link
 * picker). Keyboard navigation is delegated from `Suggestion`'s
 * `onKeyDown` via the imperative handle below.
 */
const SlashCommandMenu = forwardRef<SlashCommandMenuHandle, Props>(function SlashCommandMenu(
  { items, command },
  ref
) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => setSelectedIndex(0), [items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % items.length)
        return true
      }
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i - 1 + items.length) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        const item = items[selectedIndex]
        if (item) command(item)
        return true
      }
      return false
    }
  }))

  return (
    <div className="max-h-72 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-900">
      {items.length === 0 ? (
        <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Keine Treffer</div>
      ) : (
        items.map((item, index) => (
          <button
            key={item.id}
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
            onMouseEnter={() => setSelectedIndex(index)}
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

export default SlashCommandMenu
