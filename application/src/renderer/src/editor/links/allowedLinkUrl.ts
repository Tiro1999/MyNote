import { isAllowedExternalUrl, normalizeLinkInput } from '@shared/links'

// The URL a link input stands for, or null when the allowlist rejects it
export function allowedLinkUrl(input: string): string | null {
  const url = normalizeLinkInput(input)
  return isAllowedExternalUrl(url) ? url : null
}
