import { useEffect, useState } from 'react'
import { messageOf } from '@shared/errors'
import { Modal, buttonClass } from '@renderer/ui'

interface SettingsDialogProps {
  onClose: () => void
}

export function SettingsDialog({ onClose }: SettingsDialogProps): React.JSX.Element {
  const [autoUpdate, setAutoUpdate] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkMessage, setCheckMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.settings
      .get()
      .then((settings) => {
        if (cancelled) return
        setAutoUpdate(settings.autoUpdateEnabled)
        setLoaded(true)
      })
      .catch((error: unknown) => {
        if (!cancelled) setSettingsError(`Couldn't load the settings: ${messageOf(error)}`)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const toggleAutoUpdate = async (): Promise<void> => {
    setSaving(true)
    setSettingsError(null)
    try {
      const settings = await window.api.settings.setAutoUpdate(!autoUpdate)
      setAutoUpdate(settings.autoUpdateEnabled)
    } catch (error) {
      setSettingsError(`Couldn't save the settings: ${messageOf(error)}`)
    } finally {
      setSaving(false)
    }
  }

  const checkForUpdates = async (): Promise<void> => {
    setChecking(true)
    setCheckMessage('Checking for updates…')
    try {
      const result = await window.api.updates.check()
      switch (result.status) {
        case 'available':
          setCheckMessage(
            `Update to v${result.version} found — it will install when you restart MyNote.`
          )
          break
        case 'not-available':
          setCheckMessage(`You're on the latest version (v${result.version}).`)
          break
        case 'dev':
          setCheckMessage('Updates are only available in the installed app.')
          break
        case 'unsupported':
          setCheckMessage(
            'Updates are not available on macOS yet. Download new versions from GitHub Releases.'
          )
          break
        case 'error':
          setCheckMessage(`Couldn't check for updates: ${result.error}`)
          break
      }
    } catch (error) {
      setCheckMessage(`Couldn't check for updates: ${messageOf(error)}`)
    } finally {
      setChecking(false)
    }
  }

  return (
    <Modal
      title="Settings"
      size="md"
      onClose={onClose}
      footer={
        <button type="button" className={buttonClass.primary} onClick={onClose}>
          Done
        </button>
      }
    >
      <section className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Updates
        </h3>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Automatic updates</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              Check GitHub for new versions on startup and install them automatically. When off,
              MyNote never contacts GitHub — update manually from the Releases page.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoUpdate}
            aria-label="Automatic updates"
            disabled={!loaded || saving}
            onClick={toggleAutoUpdate}
            className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              autoUpdate ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            } ${loaded ? '' : 'cursor-not-allowed opacity-50'}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                autoUpdate ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        {settingsError && (
          <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
            {settingsError}
          </p>
        )}

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={checking}
            onClick={checkForUpdates}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            {checking ? 'Checking…' : 'Check for updates'}
          </button>
          {checkMessage && (
            <span className="text-xs text-gray-500 dark:text-gray-400" role="status">
              {checkMessage}
            </span>
          )}
        </div>
      </section>
    </Modal>
  )
}
