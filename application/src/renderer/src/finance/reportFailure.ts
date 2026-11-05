import { messageOf } from '@shared/errors'
import { notify } from '@renderer/ui'

// NAMING-CHECK: notebook/store.ts has a different helper of this name; here a rejected store action ends as a toast
export function reportFailure(task: Promise<unknown>): void {
  task.catch((error: unknown) => notify(messageOf(error), 'error'))
}
