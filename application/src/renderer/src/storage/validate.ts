const DESCRIBED_LENGTH = 40

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// A parsed JSON value for an error message, shortened so a huge value cannot flood it
export function describeValue(value: unknown): string {
  const json = JSON.stringify(value) ?? String(value)
  return json.length > DESCRIBED_LENGTH ? `${json.slice(0, DESCRIBED_LENGTH)}…` : json
}
