import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { IPC, type AppSettings } from '@shared/ipc'
import { createLogger } from '@shared/log'
import { isRecord } from '@shared/records'
import { writeFileAtomic } from '../files/atomicWrite'
import { handle } from '../ipc'

const DEFAULT_SETTINGS: AppSettings = { autoUpdateEnabled: true }
const log = createLogger('settings')

// Electron's userData folder, not the notebook folder
function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function parseSettings(raw: unknown): AppSettings {
  const enabled = isRecord(raw) ? raw.autoUpdateEnabled : undefined
  return {
    autoUpdateEnabled: typeof enabled === 'boolean' ? enabled : DEFAULT_SETTINGS.autoUpdateEnabled
  }
}

export function readSettings(): AppSettings {
  const file = settingsPath()
  if (!existsSync(file)) return { ...DEFAULT_SETTINGS }
  try {
    return parseSettings(JSON.parse(readFileSync(file, 'utf-8')))
  } catch (error) {
    log.warn('Cannot read the settings, using the defaults:', error)
    return { ...DEFAULT_SETTINGS }
  }
}

export function writeSettings(settings: AppSettings): Promise<void> {
  return writeFileAtomic(settingsPath(), JSON.stringify(settings, null, 2))
}

export function registerSettingsIpc(onAutoUpdateEnabled: () => void): void {
  handle(IPC.settings.get, readSettings)
  handle(IPC.settings.setAutoUpdate, async (enabled: unknown) => {
    if (typeof enabled !== 'boolean') throw new Error('autoUpdateEnabled must be a boolean')
    const settings = { ...readSettings(), autoUpdateEnabled: enabled }
    await writeSettings(settings)
    if (enabled) onAutoUpdateEnabled()
    return settings
  })
}
