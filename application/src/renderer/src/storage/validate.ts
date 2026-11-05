const DESCRIBED_LENGTH = 40

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// A parsed JSON value for an error message, shortened so a huge value cannot flood it
export function describeValue(value: unknown): string {
  const json = JSON.stringify(value) ?? String(value)
  return json.length > DESCRIBED_LENGTH ? `${json.slice(0, DESCRIBED_LENGTH)}…` : json
}

// The record behind a parsed value; where names it in the error
export function fieldsOf(value: unknown, where: string): Record<string, unknown> {
  if (isRecord(value)) return value
  throw new Error(`${where} must be an object, got ${describeValue(value)}`)
}

export function textOf(fields: Record<string, unknown>, key: string, where: string): string {
  const value = fields[key]
  if (typeof value === 'string') return value
  throw new Error(`${where}: ${key} must be a string, got ${describeValue(value)}`)
}
