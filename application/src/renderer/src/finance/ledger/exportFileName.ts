// Characters Windows forbids in file names, plus control characters
const UNSAFE_FILE_NAME_CHARS = /[\\/:*?"<>|\p{Cc}]/gu

export function exportFileName(ledgerName: string, ledgerId: string): string {
  const name = ledgerName.replace(UNSAFE_FILE_NAME_CHARS, '-').trim()
  return `${name || 'ledger'}-${ledgerId}.csv`
}
