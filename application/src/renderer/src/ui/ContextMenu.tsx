import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'

export interface ContextMenuItem {
  label: string
  onSelect(): void
  danger?: boolean
  disabled?: boolean
}

interface OpenMenu {
  x: number
  y: number
  items: ContextMenuItem[]
}

export const useContextMenuStore = create<{ menu: OpenMenu | null }>(() => ({ menu: null }))

export function openContextMenu(x: number, y: number, items: ContextMenuItem[]): void {
  useContextMenuStore.setState({ menu: { x, y, items } })
}

export function closeContextMenu(): void {
  useContextMenuStore.setState({ menu: null })
}

export function clampToViewport(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = 8
): { x: number; y: number } {
  return {
    x: Math.max(margin, Math.min(x, viewportWidth - width - margin)),
    y: Math.max(margin, Math.min(y, viewportHeight - height - margin))
  }
}

export function ContextMenuHost(): React.JSX.Element | null {
  const menu = useContextMenuStore((state) => state.menu)
  return menu ? <Menu menu={menu} /> : null
}

function Menu({ menu }: { menu: OpenMenu }): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: menu.x, y: menu.y })

  useLayoutEffect(() => {
    const rect = menuRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition(
      clampToViewport(menu.x, menu.y, rect.width, rect.height, window.innerWidth, window.innerHeight)
    )
  }, [menu])

  useEffect(() => {
    const closeOnOutsidePointer = (e: PointerEvent): void => {
      if (!menuRef.current?.contains(e.target as Node)) closeContextMenu()
    }
    const closeOnEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeContextMenu()
    }
    // Capture phase, so a handler that stops the event cannot keep the menu open
    window.addEventListener('pointerdown', closeOnOutsidePointer, true)
    window.addEventListener('keydown', closeOnEscape, true)
    window.addEventListener('scroll', closeContextMenu, true)
    window.addEventListener('blur', closeContextMenu)
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      window.removeEventListener('keydown', closeOnEscape, true)
      window.removeEventListener('scroll', closeContextMenu, true)
      window.removeEventListener('blur', closeContextMenu)
    }
  }, [])

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-36 whitespace-nowrap rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-900"
      style={{ left: position.x, top: position.y }}
      // Keeps the focus where it was, e.g. in an editor whose commands act on its selection
      onMouseDown={(e) => e.preventDefault()}
    >
      {menu.items.map((item, index) => (
        <button
          key={index}
          type="button"
          disabled={item.disabled}
          className={`block w-full px-3 py-1.5 text-left text-sm enabled:hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:enabled:hover:bg-gray-800 ${
            item.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'
          }`}
          onClick={() => {
            closeContextMenu()
            item.onSelect()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  )
}
