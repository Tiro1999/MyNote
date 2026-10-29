export const EXTERNAL_PROTOCOLS = ['http:', 'https:', 'mailto:'] as const

// A colon followed by a digit is a port, not a scheme
const SCHEME = /^[a-z][a-z\d+.-]*:(?!\d)/i

export function isAllowedExternalUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return EXTERNAL_PROTOCOLS.some((allowed) => allowed === protocol)
  } catch {
    return false
  }
}

export function normalizeLinkInput(input: string): string {
  const trimmed = input.trim()
  const lower = trimmed.toLowerCase()
  if (EXTERNAL_PROTOCOLS.some((protocol) => lower.startsWith(protocol))) return trimmed
  return SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`
}
