import { app, Notification } from 'electron'
import { autoUpdater, type UpdateCheckResult } from 'electron-updater'
import { messageOf } from '@shared/errors'
import { IPC, type UpdateCheckStatus } from '@shared/ipc'
import { createLogger } from '@shared/log'
import { handle } from '../ipc'
import { readSettings } from '../settings/settings'

const log = createLogger('updates')

// The macOS build has no update feed, see documentation/software/main/updates.md
function isSupportedPlatform(): boolean {
  return process.platform !== 'darwin'
}

// The auto-download must never reject unhandled
function watchDownload(
  result: UpdateCheckResult | null,
  onReady?: (version: string) => void
): void {
  if (!result?.downloadPromise) return
  const { version } = result.updateInfo
  result.downloadPromise
    .then(() => onReady?.(version))
    .catch((error) => log.warn('Update download failed:', error))
}

function showUpdateReady(version: string): void {
  new Notification({
    title: 'Update ready',
    body: `MyNote ${version} will be installed when you quit.`
  }).show()
}

export function checkForUpdatesIfEnabled(): void {
  if (!app.isPackaged || !isSupportedPlatform()) return
  if (!readSettings().autoUpdateEnabled) {
    log.info('Automatic updates are off, skipping the update check')
    return
  }
  autoUpdater
    .checkForUpdates()
    .then((result) => watchDownload(result, showUpdateReady))
    .catch((error) => log.error('Update check failed:', error))
}

async function checkOnRequest(): Promise<UpdateCheckStatus> {
  if (!app.isPackaged) return { status: 'dev' }
  if (!isSupportedPlatform()) return { status: 'unsupported' }
  try {
    const result = await autoUpdater.checkForUpdates()
    watchDownload(result)
    return result?.isUpdateAvailable
      ? { status: 'available', version: result.updateInfo.version }
      : { status: 'not-available', version: app.getVersion() }
  } catch (error) {
    return { status: 'error', error: messageOf(error) }
  }
}

export function registerUpdatesIpc(): void {
  // install() reports a failure on quit as an 'error' event
  autoUpdater.on('error', (error) => log.warn('Updater error:', error))
  handle(IPC.updates.check, checkOnRequest)
}
