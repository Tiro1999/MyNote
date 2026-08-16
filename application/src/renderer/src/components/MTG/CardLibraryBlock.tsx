import { useEffect, useMemo, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useMtgStore } from '../../mtg/store'
import { useNotebookStore } from '../../store/notebookStore'
import {
  enrich,
  filterCards,
  computeStats,
  facets,
  unitPriceCents,
  EMPTY_FILTER,
  isFilterActive,
  type CardFilter,
  type EnrichedCard
} from '../../mtg/filter'
import {
  CONDITION_LABELS,
  DECK_FORMATS,
  DECK_FORMAT_LABELS,
  FINISH_LABELS,
  FINISHES,
  formatCents,
  entryKey,
  type Finish
} from '../../mtg/model'
import { decodeLegality } from '../../../../shared/scryfall-model'
import ManaboxImportDialog from './ManaboxImportDialog'

const PAGE_SIZE = 50

const COLORS: Array<{ letter: string; label: string; className: string }> = [
  { letter: 'w', label: 'W', className: 'bg-amber-100 text-amber-900' },
  { letter: 'u', label: 'U', className: 'bg-blue-100 text-blue-900' },
  { letter: 'b', label: 'B', className: 'bg-gray-300 text-gray-900' },
  { letter: 'r', label: 'R', className: 'bg-red-100 text-red-900' },
  { letter: 'g', label: 'G', className: 'bg-green-100 text-green-900' },
  { letter: 'c', label: 'C', className: 'bg-slate-100 text-slate-900' }
]

const RARITIES = ['common', 'uncommon', 'rare', 'mythic', 'special', 'bonus']
const RARITY_LABELS: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  mythic: 'Mythic',
  special: 'Special',
  bonus: 'Bonus'
}

/**
 * The `/mtg-cardlibrary` block: filter-driven search over the collection,
 * enriched with Scryfall data, with live aggregates.
 *
 * Paginates above PAGE_SIZE rows for the same reason the finance ledger does —
 * the filtering itself is a few milliseconds even at 50k stacks (measured), but
 * rendering that many rows is not.
 */
export default function CardLibraryBlock({ node, updateAttributes }: NodeViewProps): JSX.Element {
  const dataRoot = useNotebookStore((state) => state.dataRoot)
  const {
    collection,
    printingById,
    oracleById,
    oracleByName,
    collectionLoaded,
    indexLoaded,
    busy,
    loadCollection,
    loadScryfallCache,
    syncPrintings,
    setBusy
  } = useMtgStore()

  // The filter is persisted in the node, so a page can hold a saved view
  // ("meine Commander-Karten") that survives reopening the notebook.
  const [filter, setFilterState] = useState<CardFilter>(() => {
    try {
      const stored = node.attrs.filter as string
      return stored ? { ...EMPTY_FILTER, ...JSON.parse(stored) } : EMPTY_FILTER
    } catch {
      return EMPTY_FILTER
    }
  })
  const [page, setPage] = useState(0)

  const setFilter = (next: CardFilter | ((current: CardFilter) => CardFilter)): void => {
    setFilterState((current) => {
      const resolved = typeof next === 'function' ? next(current) : next
      updateAttributes({ filter: isFilterActive(resolved) ? JSON.stringify(resolved) : '' })
      return resolved
    })
  }
  const [importOpen, setImportOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [indexState, setIndexState] = useState<{ count: number; builtAt: string } | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!dataRoot) return
    if (!collectionLoaded) void loadCollection()
    if (!indexLoaded) void loadScryfallCache()
  }, [dataRoot, collectionLoaded, indexLoaded, loadCollection, loadScryfallCache])

  useEffect(() => {
    void window.api.scryfall.cacheMeta().then((meta) => {
      if (meta) setIndexState({ count: meta.oracleCount, builtAt: meta.builtAt })
    })
  }, [])

  // Progress from the main process during long Scryfall operations.
  useEffect(() => {
    return window.api.scryfall.onProgress((progress) => {
      if (progress.phase === 'done') {
        setBusy(null)
        return
      }
      const total = progress.total ? ` / ${progress.total}` : ''
      setBusy(`${progress.phase}: ${progress.count}${total}`)
    })
  }, [setBusy])

  const cards = useMemo(
    () => enrich(collection, printingById, oracleById, oracleByName),
    [collection, printingById, oracleById, oracleByName]
  )
  const filtered = useMemo(() => filterCards(cards, filter), [cards, filter])
  const stats = useMemo(() => computeStats(filtered), [filtered])
  const available = useMemo(() => facets(cards), [cards])

  // Any filter change invalidates the current page.
  useEffect(() => setPage(0), [filter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const patch = (updates: Partial<CardFilter>): void =>
    setFilter((current) => ({ ...current, ...updates }))

  const toggleIn = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

  const buildIndex = async (): Promise<void> => {
    setMessage(null)
    setBusy('Lade Kartendaten von Scryfall…')
    try {
      const meta = await window.api.scryfall.buildIndex('oracle_cards')
      setIndexState({ count: meta.oracleCount, builtAt: meta.builtAt })
      useMtgStore.setState({ indexLoaded: false })
      await loadScryfallCache()
      setMessage(`${meta.oracleCount.toLocaleString('de-DE')} Karten geladen.`)
    } catch (error) {
      setMessage(`Fehler: ${(error as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  const refreshPrintings = async (): Promise<void> => {
    setMessage(null)
    try {
      const result = await syncPrintings()
      setMessage(
        result.fetched === 0
          ? 'Alle Karten sind bereits mit Scryfall-Daten versehen.'
          : `${result.fetched} Karten nachgeladen${result.notFound > 0 ? `, ${result.notFound} nicht gefunden` : ''}.`
      )
    } catch (error) {
      setMessage(`Fehler: ${(error as Error).message}`)
    }
  }

  if (!dataRoot) {
    return (
      <NodeViewWrapper className="my-2">
        <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Bitte zuerst einen Notizbuch-Ordner öffnen.
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="my-2" data-drag-handle>
      <div className="rounded-lg border border-gray-200 bg-white text-sm dark:border-gray-700 dark:bg-gray-900">
        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-2 dark:border-gray-700">
          <span className="font-medium text-gray-900 dark:text-gray-100">🃏 Kartenbibliothek</span>

          <input
            className="min-w-[14rem] flex-1 rounded border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-700"
            placeholder="Suche — z.B. t:creature cmc<=3 c:g -t:legendary"
            title={
              'Suchoperatoren (mit - negierbar, Werte in "…" für Leerzeichen):\n' +
              'n: Name   t: Typ   o: Regeltext   kw: Schlüsselwort\n' +
              'c: Farbe   ci: Farbidentität (höchstens)   cmc:/mv: Manawert\n' +
              'r: Seltenheit (auch r>=rare)   s:/e: Set   qty: Anzahl\n' +
              'lang: Sprache   cond: Zustand   finish: Ausführung\n' +
              'loc: Lagerort   note: Notiz\n' +
              'f: legal im Format   banned: gebannt   restricted: max. 1 Kopie\n' +
              'is:foil is:etched is:altered is:misprint is:reserved is:unknown'
            }
            value={filter.text}
            onChange={(e) => patch({ text: e.target.value })}
          />

          <button
            className={`rounded border px-2 py-1 text-xs ${
              showFilters
                ? 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-700'
            }`}
            onClick={() => setShowFilters((v) => !v)}
          >
            Filter{isFilterActive(filter) ? ' •' : ''}
          </button>

          {isFilterActive(filter) && (
            <button
              className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700"
              onClick={() => setFilter(EMPTY_FILTER)}
            >
              Zurücksetzen
            </button>
          )}

          <button
            className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
            onClick={() => setImportOpen(true)}
          >
            ManaBox importieren
          </button>
        </div>

        {/* ── Scryfall data state ── */}
        {!indexState && (
          <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <span>
              Noch keine Scryfall-Kartendaten geladen. Ohne sie fehlen Typen, Farben, Manakosten,
              Preise und die Legalitätsprüfung.
            </span>
            <button
              className="rounded bg-amber-600 px-2 py-1 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              disabled={busy !== null}
              onClick={buildIndex}
            >
              Jetzt laden (~24 MB)
            </button>
          </div>
        )}

        {busy && (
          <div className="border-b border-gray-200 bg-gray-50 p-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {busy}
          </div>
        )}

        {message && (
          <div className="border-b border-gray-200 bg-gray-50 p-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {message}
            <button className="ml-2 underline" onClick={() => setMessage(null)}>
              ok
            </button>
          </div>
        )}

        {/* ── Filters ── */}
        {showFilters && (
          <div className="space-y-3 border-b border-gray-200 p-3 text-xs dark:border-gray-700">
            <Row label="Farbidentität">
              <div className="flex flex-wrap items-center gap-1">
                {COLORS.map((color) => (
                  <button
                    key={color.letter}
                    className={`h-6 w-6 rounded-full text-xs font-bold ${color.className} ${
                      filter.colors.includes(color.letter)
                        ? 'ring-2 ring-blue-500'
                        : 'opacity-50 hover:opacity-100'
                    }`}
                    onClick={() => patch({ colors: toggleIn(filter.colors, color.letter) })}
                  >
                    {color.label}
                  </button>
                ))}
                <select
                  className="ml-2 rounded border border-gray-300 bg-transparent px-1 py-0.5 dark:border-gray-700"
                  value={filter.colorMode}
                  onChange={(e) => patch({ colorMode: e.target.value as CardFilter['colorMode'] })}
                >
                  <option value="includes">enthält</option>
                  <option value="exact">genau</option>
                  <option value="atMost">höchstens (deckbar)</option>
                </select>
              </div>
            </Row>

            <Row label="Seltenheit">
              <Chips
                options={RARITIES.map((r) => ({ value: r, label: RARITY_LABELS[r] }))}
                selected={filter.rarities}
                onToggle={(value) => patch({ rarities: toggleIn(filter.rarities, value) })}
              />
            </Row>

            <Row label="Ausführung">
              <Chips
                options={FINISHES.map((f) => ({ value: f, label: FINISH_LABELS[f] }))}
                selected={filter.finishes}
                onToggle={(value) =>
                  patch({ finishes: toggleIn(filter.finishes, value as Finish) })
                }
              />
            </Row>

            <Row label="Manawert">
              <div className="flex items-center gap-1">
                <NumberInput
                  value={filter.cmcMin}
                  placeholder="von"
                  onChange={(value) => patch({ cmcMin: value })}
                />
                <span className="text-gray-400">–</span>
                <NumberInput
                  value={filter.cmcMax}
                  placeholder="bis"
                  onChange={(value) => patch({ cmcMax: value })}
                />
              </div>
            </Row>

            <Row label="Legal in">
              <select
                className="rounded border border-gray-300 bg-transparent px-1 py-0.5 dark:border-gray-700"
                value={filter.legalIn ?? ''}
                onChange={(e) =>
                  patch({ legalIn: (e.target.value || null) as CardFilter['legalIn'] })
                }
              >
                <option value="">— egal —</option>
                {DECK_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {DECK_FORMAT_LABELS[format]}
                  </option>
                ))}
              </select>
            </Row>

            {available.locations.length > 0 && (
              <Row label="Lagerort">
                <Chips
                  options={available.locations.map((l) => ({ value: l, label: l }))}
                  selected={filter.storageLocations}
                  onToggle={(value) =>
                    patch({ storageLocations: toggleIn(filter.storageLocations, value) })
                  }
                />
              </Row>
            )}

            {available.sets.length > 0 && (
              <Row label="Set">
                <select
                  className="max-w-full rounded border border-gray-300 bg-transparent px-1 py-0.5 dark:border-gray-700"
                  value={filter.sets[0] ?? ''}
                  onChange={(e) => patch({ sets: e.target.value ? [e.target.value] : [] })}
                >
                  <option value="">— alle —</option>
                  {available.sets.map((set) => (
                    <option key={set.code} value={set.code}>
                      {set.name} ({set.count})
                    </option>
                  ))}
                </select>
              </Row>
            )}
          </div>
        )}

        {/* ── Stats ── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800">
          <Metric label="Karten" value={stats.cards.toLocaleString('de-DE')} />
          <Metric label="Stapel" value={stats.stacks.toLocaleString('de-DE')} />
          <Metric label="verschiedene" value={stats.distinctCards.toLocaleString('de-DE')} />
          <Metric label="Marktwert" value={formatCents(stats.valueCents)} />
          {stats.purchaseCents > 0 && (
            <Metric label="gezahlt" value={formatCents(stats.purchaseCents)} />
          )}
          {stats.unresolved > 0 && (
            <button
              className="text-amber-600 underline dark:text-amber-400"
              onClick={refreshPrintings}
              title="Diese Karten haben noch keine Scryfall-Daten"
            >
              {stats.unresolved} ohne Kartendaten — nachladen
            </button>
          )}
        </div>

        {/* ── Mana curve ── */}
        {stats.cards > 0 && stats.manaCurve.some((bucket) => bucket.count > 0) && (
          <div className="flex items-end gap-1 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
            {stats.manaCurve.map((bucket) => {
              const max = Math.max(...stats.manaCurve.map((b) => b.count), 1)
              return (
                <div key={bucket.cmc} className="flex flex-1 flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-t bg-blue-500/70"
                    style={{ height: `${Math.max(2, (bucket.count / max) * 40)}px` }}
                    title={`${bucket.count} Karten`}
                  />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">{bucket.cmc}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Table ── */}
        {collection.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Noch keine Karten im Bestand. Importiere deinen ManaBox-Export, um loszulegen.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Keine Karte passt zu diesem Filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-2 py-1">#</th>
                  <th className="px-2 py-1">Karte</th>
                  <th className="px-2 py-1">Typ</th>
                  <th className="px-2 py-1">MW</th>
                  <th className="px-2 py-1">Set</th>
                  <th className="px-2 py-1">Ausf.</th>
                  <th className="px-2 py-1">Zust.</th>
                  <th className="px-2 py-1">Spr.</th>
                  <th className="px-2 py-1">Lagerort</th>
                  <th className="px-2 py-1 text-right">Wert</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((card) => (
                  <CardRow key={entryKey(card.entry)} card={card} legalIn={filter.legalIn} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-gray-200 px-3 py-2 text-xs dark:border-gray-700">
            <span className="text-gray-500 dark:text-gray-400">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} von{' '}
              {filtered.length.toLocaleString('de-DE')}
            </span>
            <div className="flex gap-1">
              <button
                className="rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40 dark:border-gray-700"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹
              </button>
              <span className="px-1 py-0.5 text-gray-500 dark:text-gray-400">
                {page + 1} / {pageCount}
              </span>
              <button
                className="rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40 dark:border-gray-700"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      <ManaboxImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </NodeViewWrapper>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function CardRow({
  card,
  legalIn
}: {
  card: EnrichedCard
  legalIn: CardFilter['legalIn']
}): JSX.Element {
  const { entry, printing, oracle } = card
  const value = unitPriceCents(card) * entry.quantity

  // Surface a ban directly in the row — the user asked to see legality at a glance.
  const legality = legalIn && oracle ? decodeLegality(oracle.legalities, legalIn) : null

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50">
      <td className="px-2 py-1 tabular-nums text-gray-500 dark:text-gray-400">{entry.quantity}×</td>
      <td className="px-2 py-1">
        <span className="font-medium text-gray-900 dark:text-gray-100">{entry.name}</span>
        {oracle?.manaCost && (
          <span className="ml-1 text-gray-400 dark:text-gray-500">{oracle.manaCost}</span>
        )}
        {legality && legality !== 'legal' && (
          <span className="ml-1 rounded bg-red-100 px-1 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300">
            {legality === 'banned' ? 'gebannt' : legality === 'restricted' ? 'limitiert' : 'illegal'}
          </span>
        )}
        {!oracle && (
          <span
            className="ml-1 text-[10px] text-amber-600 dark:text-amber-400"
            title="Noch keine Scryfall-Daten"
          >
            ?
          </span>
        )}
      </td>
      <td className="px-2 py-1 text-gray-600 dark:text-gray-300">{oracle?.typeLine ?? '—'}</td>
      <td className="px-2 py-1 tabular-nums text-gray-600 dark:text-gray-300">
        {oracle ? oracle.cmc : '—'}
      </td>
      <td className="px-2 py-1 uppercase text-gray-500 dark:text-gray-400" title={printing?.setName}>
        {entry.setCode}
      </td>
      <td className="px-2 py-1 text-gray-500 dark:text-gray-400">
        {entry.finish === 'normal' ? '' : FINISH_LABELS[entry.finish]}
      </td>
      <td className="px-2 py-1 text-gray-500 dark:text-gray-400">
        {CONDITION_LABELS[entry.condition]}
      </td>
      <td className="px-2 py-1 text-gray-500 dark:text-gray-400">{entry.language}</td>
      <td className="px-2 py-1 text-gray-500 dark:text-gray-400">{entry.storageLocation}</td>
      <td className="px-2 py-1 text-right tabular-nums text-gray-600 dark:text-gray-300">
        {value > 0 ? formatCents(value) : '—'}
      </td>
    </tr>
  )
}

// ─── Small building blocks ────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </div>
  )
}

function Chips({
  options,
  selected,
  onToggle
}: {
  options: Array<{ value: string; label: string }>
  selected: string[]
  onToggle: (value: string) => void
}): JSX.Element {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          className={`rounded-full border px-2 py-0.5 ${
            selected.includes(option.value)
              ? 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              : 'border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300'
          }`}
          onClick={() => onToggle(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function NumberInput({
  value,
  placeholder,
  onChange
}: {
  value: number | null
  placeholder: string
  onChange: (value: number | null) => void
}): JSX.Element {
  return (
    <input
      type="number"
      className="w-16 rounded border border-gray-300 bg-transparent px-1 py-0.5 dark:border-gray-700"
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  )
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <span className="text-gray-600 dark:text-gray-300">
      <span className="font-semibold text-gray-900 dark:text-gray-100">{value}</span> {label}
    </span>
  )
}
