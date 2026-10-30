import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clampToViewport,
  closeContextMenu,
  openContextMenu,
  useContextMenuStore,
  type ContextMenuItem
} from './ContextMenu'

describe('clampToViewport', () => {
  it('keeps the menu inside the viewport, 8 px from each edge', () => {
    expect(clampToViewport(790, 590, 100, 50, 800, 600)).toEqual({ x: 692, y: 542 })
    expect(clampToViewport(-5, -5, 100, 50, 800, 600)).toEqual({ x: 8, y: 8 })
    expect(clampToViewport(10, 10, 900, 700, 800, 600)).toEqual({ x: 8, y: 8 })
  })

  it('leaves a menu that fits where it is', () => {
    expect(clampToViewport(100, 200, 100, 50, 800, 600)).toEqual({ x: 100, y: 200 })
  })

  it('uses the given margin', () => {
    expect(clampToViewport(790, 590, 100, 50, 800, 600, 0)).toEqual({ x: 700, y: 550 })
  })
})

describe('context menu', () => {
  const rename: ContextMenuItem = { label: 'Rename', onSelect: vi.fn() }
  const remove: ContextMenuItem = { label: 'Delete', onSelect: vi.fn(), danger: true }

  beforeEach(() => closeContextMenu())

  it('opens at the given point with the given items', () => {
    openContextMenu(10, 20, [rename, remove])
    expect(useContextMenuStore.getState().menu).toEqual({ x: 10, y: 20, items: [rename, remove] })
  })

  it('keeps one menu at a time, so a new menu replaces the open one', () => {
    openContextMenu(10, 20, [rename])
    openContextMenu(30, 40, [remove])
    expect(useContextMenuStore.getState().menu).toEqual({ x: 30, y: 40, items: [remove] })
  })

  it('closes', () => {
    openContextMenu(10, 20, [rename])
    closeContextMenu()
    expect(useContextMenuStore.getState().menu).toBeNull()
  })
})
