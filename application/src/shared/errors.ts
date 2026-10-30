// The text to show for a caught value; anything thrown that is not an Error becomes its string form
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
