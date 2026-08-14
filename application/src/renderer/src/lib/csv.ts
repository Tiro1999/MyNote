/**
 * RFC-4180 CSV primitives, shared by every module that persists tabular data
 * (finance ledgers, MTG collection, …). Kept dependency-free and deliberately
 * tolerant on read — real-world exports from third-party apps are rarely
 * perfectly compliant — while staying strict on write so that files this app
 * produces stay stable and diff-friendly.
 */

/** Parse RFC-4180 CSV text into a matrix of string cells. */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  const pushField = (): void => {
    row.push(field)
    field = ''
  }
  const pushRow = (): void => {
    pushField()
    rows.push(row)
    row = []
  }

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === delimiter) {
      pushField()
      i++
      continue
    }
    if (ch === '\r') {
      i++
      continue
    }
    if (ch === '\n') {
      pushRow()
      i++
      continue
    }
    field += ch
    i++
  }
  // flush trailing field/row unless the text ended exactly on a newline
  if (field.length > 0 || row.length > 0) pushRow()
  return rows
}

function encodeField(value: string, delimiter: string): string {
  if (value.includes(delimiter) || /["\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function serializeCsv(rows: string[][], delimiter = ','): string {
  return rows.map((r) => r.map((f) => encodeField(f, delimiter)).join(delimiter)).join('\r\n')
}

/**
 * Guess the delimiter of a CSV by counting candidates in the header line,
 * outside of quotes. Third-party exports use `;` in locales where `,` is the
 * decimal separator, and `\t` when copied out of a spreadsheet.
 */
export function detectDelimiter(text: string): string {
  const header = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'))
  const candidates = [',', ';', '\t', '|']
  let best = ','
  let bestCount = 0
  for (const candidate of candidates) {
    let count = 0
    let inQuotes = false
    for (let i = 0; i < header.length; i++) {
      const ch = header[i]
      if (ch === '"') {
        inQuotes = !inQuotes
        continue
      }
      if (!inQuotes && ch === candidate) count++
    }
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return best
}

/**
 * Strip a UTF-8 BOM. Exports written by Windows tooling (and anything that went
 * through Excel) start with one, which would otherwise become part of the first
 * header name and break header matching.
 */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}
