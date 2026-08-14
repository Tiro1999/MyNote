import { useEffect, useState } from 'react'
import { useFeatureStore } from '../../store/featureStore'

interface Props {
  open: boolean
  onClose: () => void
}

export default function SettingsDialog({ open, onClose }: Props): JSX.Element | null {
  const mtgEnabled = useFeatureStore((state) => state.mtgEnabled)
  const setMtgEnabled = useFeatureStore((state) => state.setMtgEnabled)
  const [autoUpdate, setAutoUpdate] = useState(true)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [checkMessage, setCheckMessage] = useState<string | null>(null)

  // Load the current preference from the main process each time the dialog opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setCheckMessage(null)
    window.api.settings
      .get()
      .then((settings) => {
        if (!cancelled) setAutoUpdate(settings.autoUpdateEnabled)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  const handleToggleAutoUpdate = async (): Promise<void> => {
    const next = !autoUpdate
    setAutoUpdate(next) // optimistic — persistence is fast and can't meaningfully fail
    await window.api.settings.setAutoUpdate(next)
  }

  const handleToggleMtg = async (): Promise<void> => {
    await setMtgEnabled(!mtgEnabled)
  }

  const handleCheckForUpdates = async (): Promise<void> => {
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
        case 'error':
          setCheckMessage(`Couldn't check for updates: ${result.error}`)
          break
      }
    } catch (error) {
      setCheckMessage(`Couldn't check for updates: ${(error as Error).message}`)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h2>

        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Updates
          </h3>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Automatic updates
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                Check GitHub for new versions on startup and install them automatically. When
                off, MyNote never contacts GitHub — update manually from the Releases page.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoUpdate}
              aria-label="Automatic updates"
              disabled={loading}
              onClick={handleToggleAutoUpdate}
              className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                autoUpdate ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              } ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  autoUpdate ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={checking}
              onClick={handleCheckForUpdates}
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

        <section className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Modules
          </h3>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Magic: the Gathering
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                Adds the <code>/mtg-cardlibrary</code> command for managing a card collection,
                with ManaBox import and Scryfall data. When off, the commands are hidden and no
                card data is downloaded — existing blocks keep working.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={mtgEnabled}
              aria-label="Magic: the Gathering module"
              disabled={loading}
              onClick={handleToggleMtg}
              className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                mtgEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              } ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  mtgEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </section>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
