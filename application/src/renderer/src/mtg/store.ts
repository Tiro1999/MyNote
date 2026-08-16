/**
 * MTG collection store.
 *
 * Layout under the notebook data root — plain files, no database, so a backup is
 * "copy the folder" and the whole thing can be pushed to a private git repo:
 *
 *   {dataRoot}/mtg/
 *     collection.csv          all owned stacks, sorted canonically
 *     wishlist.csv            wanted cards
 *     legality-snapshot.csv   what Scryfall last said about the tracked cards
 *     decks/{deckId}.json     one file per deck
 *     backups/{timestamp}/    snapshots taken before destructive operations
 *
 * The Scryfall cache deliberately lives elsewhere (userData) — it is derived,
 * large, and has no business in a backup or a git diff.
 */
import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { useNotebookStore } from '../store/notebookStore'
import {
  parseCollectionCsv,
  serializeCollectionCsv,
  parseWishlistCsv,
  serializeWishlistCsv,
  parseLegalitySnapshotCsv,
  serializeLegalitySnapshotCsv
} from './csv'
import {
  buildSnapshot,
  diffSnapshots,
  relevantOracleIds,
  scopeChanges,
  type LegalityEvent
} from './legality'
import {
  entryKey,
  sortDeckCards,
  type CollectionEntry,
  type Deck,
  type WishlistEntry
} from './model'
import type { OracleCard, PrintingCard } from '../../../shared/scryfall-model'

const MTG_DIR = 'mtg'

function root(): string {
  const dataRoot = useNotebookStore.getState().dataRoot
  if (!dataRoot) throw new Error('Kein Notizbuch-Ordner geöffnet')
  return dataRoot
}
const join = (...parts: string[]): string => parts.join('/')
const mtgPath = (...parts: string[]): string => join(root(), MTG_DIR, ...parts)

async function readText(path: string): Promise<string> {
  if (!(await window.api.fs.exists(path))) return ''
  try {
    return await window.api.fs.readFile(path)
  } catch {
    return ''
  }
}

interface MtgState {
  collection: CollectionEntry[]
  wishlist: WishlistEntry[]
  decks: Deck[]
  /** Oracle-level data for every card in Magic, keyed by oracle id. */
  oracleById: Map<string, OracleCard>
  /** Oracle-level data keyed by lowercased name, for name lookups. */
  oracleByName: Map<string, OracleCard>
  /** Printing-level data for cards the user owns, keyed by Scryfall id. */
  printingById: Map<string, PrintingCard>

  collectionLoaded: boolean
  indexLoaded: boolean
  /** Progress text for long-running Scryfall work, or null when idle. */
  busy: string | null
  /** Legality changes since the last check that touch this collection. */
  legalityEvents: LegalityEvent[]
  /** True once a baseline snapshot exists, so "no events" means "nothing changed". */
  legalityBaseline: boolean

  loadCollection: () => Promise<void>
  saveCollection: (entries: CollectionEntry[]) => Promise<void>
  saveWishlist: (entries: WishlistEntry[]) => Promise<void>
  loadScryfallCache: () => Promise<void>
  /** Fetch printing details for owned cards missing from the cache. */
  syncPrintings: () => Promise<{ fetched: number; notFound: number }>
  updateEntry: (key: string, updates: Partial<CollectionEntry>) => Promise<void>
  loadDecks: () => Promise<void>
  saveDeck: (deck: Deck) => Promise<void>
  createDeck: (name: string, format: Deck['format']) => Promise<string>
  deleteDeck: (deckId: string) => Promise<void>
  /**
   * Diff Scryfall's current legality answer against the stored snapshot and
   * raise events for anything that touches the collection, wishlist or decks.
   */
  checkLegalityChanges: () => Promise<LegalityEvent[]>
  dismissLegalityEvents: () => void
  /** Snapshot the whole mtg folder; returns the backup folder name. */
  backup: () => Promise<string>
  listBackups: () => Promise<string[]>
  setBusy: (message: string | null) => void
}

export const useMtgStore = create<MtgState>((set, get) => ({
  collection: [],
  wishlist: [],
  decks: [],
  oracleById: new Map(),
  oracleByName: new Map(),
  printingById: new Map(),
  collectionLoaded: false,
  indexLoaded: false,
  busy: null,
  legalityEvents: [],
  legalityBaseline: false,

  setBusy: (message) => set({ busy: message }),

  loadCollection: async () => {
    const [collectionCsv, wishlistCsv] = await Promise.all([
      readText(mtgPath('collection.csv')),
      readText(mtgPath('wishlist.csv'))
    ])
    set({
      collection: parseCollectionCsv(collectionCsv),
      wishlist: parseWishlistCsv(wishlistCsv),
      collectionLoaded: true
    })
  },

  saveCollection: async (entries) => {
    set({ collection: entries })
    await window.api.fs.mkdir(mtgPath())
    await window.api.fs.writeFile(mtgPath('collection.csv'), serializeCollectionCsv(entries))
  },

  saveWishlist: async (entries) => {
    set({ wishlist: entries })
    await window.api.fs.mkdir(mtgPath())
    await window.api.fs.writeFile(mtgPath('wishlist.csv'), serializeWishlistCsv(entries))
  },

  loadScryfallCache: async () => {
    if (get().indexLoaded) return
    const [oracle, printings] = await Promise.all([
      window.api.scryfall.readIndex(),
      window.api.scryfall.readPrintings()
    ])
    const oracleById = new Map<string, OracleCard>()
    const oracleByName = new Map<string, OracleCard>()
    for (const card of oracle) {
      oracleById.set(card.oracleId, card)
      oracleByName.set(card.name.toLowerCase(), card)
      // Front-face name too, so "Delver of Secrets" resolves without the // half.
      const front = card.name.split(' // ')[0].toLowerCase()
      if (front !== card.name.toLowerCase() && !oracleByName.has(front)) {
        oracleByName.set(front, card)
      }
    }
    set({
      oracleById,
      oracleByName,
      printingById: new Map(printings.map((printing) => [printing.id, printing])),
      indexLoaded: true
    })
  },

  syncPrintings: async () => {
    const { collection, printingById } = get()
    const missing = [
      ...new Set(
        collection
          .map((entry) => entry.scryfallId)
          .filter((id) => id.length > 0 && !printingById.has(id))
      )
    ]
    if (missing.length === 0) return { fetched: 0, notFound: 0 }

    set({ busy: `Lade Kartendaten (0/${missing.length})…` })
    try {
      const result = await window.api.scryfall.fetchPrintings(missing.map((id) => ({ id })))
      const next = new Map(get().printingById)
      for (const printing of result.found) next.set(printing.id, printing)
      set({ printingById: next })
      return { fetched: result.found.length, notFound: result.notFound.length }
    } finally {
      set({ busy: null })
    }
  },

  updateEntry: async (key, updates) => {
    const { collection } = get()
    const next = collection.map((entry) =>
      entryKey(entry) === key ? { ...entry, ...updates } : entry
    )
    await get().saveCollection(next)
  },

  loadDecks: async () => {
    const dir = mtgPath('decks')
    if (!(await window.api.fs.exists(dir))) {
      set({ decks: [] })
      return
    }
    const files = await window.api.fs.readDir(dir)
    const decks: Deck[] = []
    for (const file of files) {
      if (!file.name.endsWith('.json')) continue
      try {
        decks.push(JSON.parse(await window.api.fs.readFile(join(dir, file.name))) as Deck)
      } catch {
        // A corrupt deck file must not take the whole list down.
      }
    }
    set({ decks: decks.sort((a, b) => a.name.localeCompare(b.name)) })
  },

  saveDeck: async (deck) => {
    const normalized: Deck = {
      ...deck,
      cards: sortDeckCards(deck.cards),
      updatedAt: new Date().toISOString()
    }
    await window.api.fs.mkdir(mtgPath('decks'))
    await window.api.fs.writeFile(
      mtgPath('decks', `${deck.id}.json`),
      `${JSON.stringify(normalized, null, 2)}\n`
    )
    set((state) => ({
      decks: state.decks.some((d) => d.id === deck.id)
        ? state.decks.map((d) => (d.id === deck.id ? normalized : d))
        : [...state.decks, normalized].sort((a, b) => a.name.localeCompare(b.name))
    }))
  },

  createDeck: async (name, format) => {
    const now = new Date().toISOString()
    const deck: Deck = {
      id: nanoid(8),
      name,
      format,
      cards: [],
      note: '',
      createdAt: now,
      updatedAt: now
    }
    await get().saveDeck(deck)
    return deck.id
  },

  deleteDeck: async (deckId) => {
    await window.api.fs.remove(mtgPath('decks', `${deckId}.json`))
    set((state) => ({ decks: state.decks.filter((deck) => deck.id !== deckId) }))
  },

  checkLegalityChanges: async () => {
    const { collection, wishlist, decks, oracleById, printingById } = get()

    const tracked = relevantOracleIds({ collection, wishlist, decks, printingById })
    const current = buildSnapshot(tracked, oracleById)
    if (current.length === 0) return []

    const path = mtgPath('legality-snapshot.csv')
    const previousText = await readText(path)
    const hadBaseline = previousText.length > 0
    const previous = parseLegalitySnapshotCsv(previousText)

    // First run writes the baseline only. Without this every tracked card would
    // arrive as a change and the first notification would be thousands of rows.
    const events = hadBaseline
      ? scopeChanges(diffSnapshots(previous, current), {
          decks,
          collection,
          wishlist,
          printingById
        })
      : []

    await window.api.fs.mkdir(mtgPath())
    await window.api.fs.writeFile(path, serializeLegalitySnapshotCsv(current))
    set({ legalityEvents: events, legalityBaseline: true })
    return events
  },

  dismissLegalityEvents: () => set({ legalityEvents: [] }),

  backup: async () => {
    // Colons are illegal in Windows filenames, so the timestamp is flattened.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const target = mtgPath('backups', stamp)
    await window.api.fs.mkdir(target)

    const { collection, wishlist, decks } = get()
    await window.api.fs.writeFile(
      join(target, 'collection.csv'),
      serializeCollectionCsv(collection)
    )
    await window.api.fs.writeFile(join(target, 'wishlist.csv'), serializeWishlistCsv(wishlist))

    // Copied rather than rebuilt: restoring a backup without the snapshot would
    // make the next check treat every ban since then as brand new.
    const snapshot = await readText(mtgPath('legality-snapshot.csv'))
    if (snapshot) {
      await window.api.fs.writeFile(join(target, 'legality-snapshot.csv'), snapshot)
    }

    for (const deck of decks) {
      await window.api.fs.writeFile(
        join(target, 'decks', `${deck.id}.json`),
        `${JSON.stringify(deck, null, 2)}\n`
      )
    }
    return stamp
  },

  listBackups: async () => {
    const dir = mtgPath('backups')
    if (!(await window.api.fs.exists(dir))) return []
    const entries = await window.api.fs.readDir(dir)
    return entries
      .filter((entry) => entry.isDirectory)
      .map((entry) => entry.name)
      .sort()
      .reverse()
  }
}))
