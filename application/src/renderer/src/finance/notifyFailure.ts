import { messageOf } from '@shared/errors'
import { notify } from '@renderer/ui'

// A rejected store action ends as an error toast, so no rejection stays unhandled
export function notifyFailure(task: Promise<unknown>): void {
  task.catch((error: unknown) => notify(messageOf(error), 'error'))
}
