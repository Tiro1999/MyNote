// One entry per open modal, in the order they opened
const stack: object[] = []

// Escape reaches only the handler pushed last, wherever the focus is; a repeat (held key) is ignored; returns the pop function
export function pushEscapeHandler(target: EventTarget, onEscape: () => void): () => void {
  const entry = {}
  stack.push(entry)
  const onKeyDown = (e: Event): void => {
    const { key, repeat } = e as KeyboardEvent
    if (key === 'Escape' && !repeat && stack.at(-1) === entry) onEscape()
  }
  target.addEventListener('keydown', onKeyDown, true)
  return () => {
    target.removeEventListener('keydown', onKeyDown, true)
    const index = stack.indexOf(entry)
    if (index >= 0) stack.splice(index, 1)
  }
}
