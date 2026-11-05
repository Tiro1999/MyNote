export const EXTERNAL_PROTOCOLS = ['http:', 'https:', 'mailto:'] as const

// A colon followed by a digit is a port, not a scheme
const SCHEME = /^[a-z][a-z\d+.-]*:(?!\d)/i

// A path is no address: it stays as typed and the allowlist rejects it
const PATH_LIKE = /^[/\\]/

// The URL parser drops tabs and newlines and reads a backslash as a slash, so the opened address would differ from the shown one
function hasMisreadChar(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (code <= 0x20 || code === 0x7f || code === 0x5c) return true
  }
  return false
}

export function isAllowedExternalUrl(url: string): boolean {
  if (hasMisreadChar(url)) return false
  try {
    const { protocol } = new URL(url)
    return EXTERNAL_PROTOCOLS.some((allowed) => allowed === protocol)
  } catch {
    return false
  }
}

export function normalizeLinkInput(input: string): string {
  const trimmed = input.trim()
  if (PATH_LIKE.test(trimmed)) return trimmed
  const lower = trimmed.toLowerCase()
  if (EXTERNAL_PROTOCOLS.some((protocol) => lower.startsWith(protocol))) return trimmed
  return SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`
}
