import { nanoid } from 'nanoid'

// An id becomes a folder or file name, so it must match this pattern
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

export function newId(): string {
  return nanoid()
}
