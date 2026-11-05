import { messageOf } from '@shared/errors'

export interface LedgerChoice {
  id: string
  name: string
}

export interface LedgerChoices {
  choices: LedgerChoice[]
  error: string | null
}

// Never rejects: a failed listing becomes a message the block shows
export async function loadLedgerChoices(list: () => Promise<LedgerChoice[]>): Promise<LedgerChoices> {
  try {
    return { choices: await list(), error: null }
  } catch (error) {
    return { choices: [], error: messageOf(error) }
  }
}
