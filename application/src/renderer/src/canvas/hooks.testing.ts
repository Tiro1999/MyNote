let slots: unknown[] = []
let index = 0

function slot<T>(init: () => T): T {
  const at = index++
  if (!(at in slots)) slots[at] = init()
  return slots[at] as T
}

// A stand-in for React's hooks: a test calls a component function itself and its state survives between calls
export const hooks = {
  useRef<T>(value: T): { current: T } {
    return slot(() => ({ current: value }))
  },
  useState<T>(value: T): [T, (next: T) => void] {
    const cell = slot(() => {
      const state: [T, (next: T) => void] = [value, (next) => void (state[0] = next)]
      return state
    })
    return [cell[0], cell[1]]
  },
  render<P, R>(component: (props: P) => R, props: P): R {
    index = 0
    return component(props)
  },
  reset(): void {
    slots = []
    index = 0
  }
}
