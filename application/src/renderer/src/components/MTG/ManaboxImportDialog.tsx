import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMtgStore } from '../../mtg/store'
import {
  parseManaboxCsv,
  planImport,
  applyImport,
  DEFAULT_APPLY_OPTIONS,
  type ImportPlan,
  type ManaboxParseResult
} from '../../mtg/manabox'
import type { ApplyOptions } from '../../mtg/manabox'
import type { CollectionEntry } from '../../mtg/model'

interface Props {
  open: boolean
  onClose: () => void
}

interface Staged {
  parsed: ManaboxParseResult
  plan: ImportPlan
  fileName: string
}

/**
 * Two-step ManaBox import: parse and show what would change, then apply.
 *
 * The preview is not decoration. A single-binder export and "I sold most of my
 * collection" produce byte-identically shaped files, and only the user can tell
 * them apart — so nothing is written until they have seen the numbers.
 */
export default function ManaboxImportDialog({ open, onClose }: Props): JSX.Element | null {
  const { collection, wishlist, saveCollection, saveWishlist, backup, syncPrintings } = useMtgStore()
  const [staged, setStaged] = useState<Staged | null>(null)
  const [options, setOptions] = useState<ApplyOptions>(DEFAULT_APPLY_OPTIONS)
  const [importWishlist, setImportWishlist] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const reset = (): void => {
    setStaged(null)
    setResult(null)
    setError(null)
    setOptions(DEFAULT_APPLY_OPTIONS)
  }

  const chooseFile = async (): Promise<void> => {
    setError(null)
    setResult(null)
    try {
      const path = await window.api.dialog.openFile([
        { name: 'ManaBox Export', extensions: ['csv'] }
      ])
      if (!path) return
      setBusy(true)
      const text = await window.api.fs.readFile(path)
      const parsed = parseManaboxCsv(text, new Date().toISOString().slice(0, 10))
      if (parsed.owned.length === 0 && parsed.wishlist.length === 0) {
        setError(
          'Keine Karten in der Datei gefunden. Ist es ein ManaBox-CSV-Export? ' +
            (parsed.skipped.length > 0 ? `${parsed.skipped.length} Zeilen übersprungen.` : '')
        )
        return
      }
      setStaged({
        parsed,
        plan: planImport(collection, parsed.owned),
        fileName: path.split('/').pop() ?? path
      })
    } catch (e) {
      setError(`Datei konnte nicht gelesen werden: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const apply = async (): Promise<void> => {
    if (!staged) return
    setBusy(true)
    setError(null)
    try {
      // Snapshot first — an import is the one destructive operation here.
      const stamp = await backup()

      const merged: CollectionEntry[] = applyImport(collection, staged.parsed.owned, options)
      await saveCollection(merged)

      if (importWishlist && staged.parsed.wishlist.length > 0) {
        const known = new Set(wishlist.map((w) => w.scryfallId || w.name.toLowerCase()))
        const added = staged.parsed.wishlist.filter(
          (w) => !known.has(w.scryfallId || w.name.toLowerCase())
        )
        if (added.length > 0) await saveWishlist([...wishlist, ...added])
      }

      const sync = await syncPrintings()
      setResult(
        `Import abgeschlossen · ${merged.length} Stapel im Bestand · ` +
          `Sicherung: ${stamp} · ${sync.fetched} Karten von Scryfall nachgeladen` +
          (sync.notFound > 0 ? ` · ${sync.notFound} nicht gefunden` : '')
      )
      setStaged(null)
    } catch (e) {
      setError(`Import fehlgeschlagen: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const plan = staged?.plan

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          ManaBox-Import
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Exportiere in ManaBox deine Sammlung als CSV. Es wird nur die Differenz übernommen —
          Notizen und Lagerorte bleiben erhalten.
        </p>

        {error && (
          <div className="mt-3 rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-3 rounded bg-green-50 p-2 text-xs text-green-800 dark:bg-green-950 dark:text-green-300">
            {result}
          </div>
        )}

        {!staged && !result && (
          <button
            disabled={busy}
            className="mt-4 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={chooseFile}
          >
            {busy ? 'Lese Datei…' : 'ManaBox-CSV wählen'}
          </button>
        )}

        {staged && plan && (
          <>
            <div className="mt-4 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {staged.fileName}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Stat label="Neu" value={plan.added.length} tone="green" />
                <Stat label="Mehr geworden" value={plan.increased.length} tone="green" />
                <Stat label="Weniger geworden" value={plan.decreased.length} tone="amber" />
                <Stat label="Nicht im Export" value={plan.missing.length} tone="amber" />
              </div>
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                {plan.unchanged} unverändert · Bestandsänderung{' '}
                <span className={plan.netCardDelta >= 0 ? 'text-green-600' : 'text-amber-600'}>
                  {plan.netCardDelta >= 0 ? '+' : ''}
                  {plan.netCardDelta} Karten
                </span>
                {staged.parsed.duplicateRowsMerged > 0 && (
                  <> · {staged.parsed.duplicateRowsMerged} doppelte Zeilen zusammengefasst</>
                )}
              </div>
            </div>

            {staged.parsed.warnings.length > 0 && (
              <ul className="mt-3 list-inside list-disc rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {staged.parsed.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}

            {staged.parsed.skipped.length > 0 && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {staged.parsed.skipped.length} Zeilen übersprungen (z.B. Zeile{' '}
                {staged.parsed.skipped[0].line}: {staged.parsed.skipped[0].reason})
              </div>
            )}

            {plan.missing.length > 0 && (
              <div className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {plan.missing.length} Stapel im Bestand fehlen in diesem Export. Wenn du nur einen
                einzelnen Binder exportiert hast, ist das normal — dann diese Karten behalten.
              </div>
            )}

            <div className="mt-3 space-y-1.5 text-sm text-gray-700 dark:text-gray-200">
              <Toggle
                checked={options.applyDecreases}
                onChange={(v) => setOptions((o) => ({ ...o, applyDecreases: v }))}
                label="Geringere Mengen übernehmen"
                hint="Aus für einen Teil-Export"
              />
              <Toggle
                checked={options.removeMissing}
                onChange={(v) => setOptions((o) => ({ ...o, removeMissing: v }))}
                label="Fehlende Karten aus dem Bestand entfernen"
                hint="Nur bei einem vollständigen Sammlungs-Export"
              />
              <Toggle
                checked={options.refreshPayload}
                onChange={(v) => setOptions((o) => ({ ...o, refreshPayload: v }))}
                label="Kartennamen und Set-Angaben auffrischen"
              />
              {staged.parsed.wishlist.length > 0 && (
                <Toggle
                  checked={importWishlist}
                  onChange={setImportWishlist}
                  label={`${staged.parsed.wishlist.length} Karten aus ManaBox-Listen als Wunschliste übernehmen`}
                />
              )}
            </div>
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
            onClick={staged ? reset : onClose}
          >
            {staged ? 'Zurück' : 'Schließen'}
          </button>
          {staged && (
            <button
              disabled={busy}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={apply}
            >
              {busy ? 'Importiere…' : 'Import ausführen'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function Stat({
  label,
  value,
  tone
}: {
  label: string
  value: number
  tone: 'green' | 'amber'
}): JSX.Element {
  const color =
    value === 0
      ? 'text-gray-400 dark:text-gray-500'
      : tone === 'green'
        ? 'text-green-600 dark:text-green-400'
        : 'text-amber-600 dark:text-amber-400'
  return (
    <div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  hint
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
}): JSX.Element {
  return (
    <label className="flex items-start gap-2">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {label}
        {hint && <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({hint})</span>}
      </span>
    </label>
  )
}
