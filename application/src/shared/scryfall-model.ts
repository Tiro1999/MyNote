/**
 * Scryfall data shapes and the pure transformations over them.
 *
 * Deliberately free of any `electron`, `fs` or network import so that both the
 * main process (which fetches and reduces bulk data) and the renderer (which
 * checks deck legality and renders cards) can use it — and so it is testable in
 * a plain Node environment.
 */

// ─── Legality encoding ────────────────────────────────────────────────────────
// Scryfall returns a 23-key object of verbose strings per card. Stored verbatim
// for ~35k oracle cards that alone is ~20MB of JSON. Encoding it as one
// character per format against a fixed format order shrinks it to 23 bytes.

export const LEGALITY_FORMATS = [
  'standard',
  'future',
  'historic',
  'timeless',
  'gladiator',
  'pioneer',
  'modern',
  'legacy',
  'pauper',
  'vintage',
  'penny',
  'commander',
  'oathbreaker',
  'standardbrawl',
  'brawl',
  'competitivebrawl',
  'alchemy',
  'paupercommander',
  'duel',
  'oldschool',
  'premodern',
  'predh',
  'tlr'
] as const
// Order is append-only: an encoded string is positional, so inserting a format
// anywhere but the end would silently reinterpret every cached card.

export type LegalityFormat = (typeof LEGALITY_FORMATS)[number]
export type LegalityValue = 'legal' | 'not_legal' | 'banned' | 'restricted'

const LEGALITY_CODE: Record<string, string> = {
  legal: 'l',
  not_legal: 'n',
  banned: 'b',
  restricted: 'r'
}
const CODE_LEGALITY: Record<string, LegalityValue> = {
  l: 'legal',
  n: 'not_legal',
  b: 'banned',
  r: 'restricted'
}

/** Encode a Scryfall `legalities` object into one char per format. */
export function encodeLegalities(legalities: Record<string, string> | undefined): string {
  if (!legalities) return 'n'.repeat(LEGALITY_FORMATS.length)
  return LEGALITY_FORMATS.map((format) => LEGALITY_CODE[legalities[format]] ?? 'n').join('')
}

/** Read one format out of an encoded legality string. */
export function decodeLegality(encoded: string, format: LegalityFormat): LegalityValue {
  const index = LEGALITY_FORMATS.indexOf(format)
  if (index < 0 || index >= encoded.length) return 'not_legal'
  return CODE_LEGALITY[encoded[index]] ?? 'not_legal'
}

/** Expand an encoded legality string back into a full record. */
export function decodeAllLegalities(encoded: string): Record<LegalityFormat, LegalityValue> {
  const result = {} as Record<LegalityFormat, LegalityValue>
  for (const format of LEGALITY_FORMATS) result[format] = decodeLegality(encoded, format)
  return result
}

// ─── Reduced card shapes ──────────────────────────────────────────────────────

/**
 * One entry per Oracle ID — the gameplay-relevant facts, for every card in
 * existence. This is what powers legality checks, deck statistics and searching
 * for cards the user does not own (wishlist, deck ideas).
 */
export interface OracleCard {
  oracleId: string
  name: string
  manaCost: string
  cmc: number
  typeLine: string
  oracleText: string
  colors: string[]
  colorIdentity: string[]
  keywords: string[]
  layout: string
  /** Encoded via `encodeLegalities`. */
  legalities: string
  reserved: boolean
  edhrecRank: number | null
  /** Face names/costs for split, transform, adventure and MDFC cards. */
  faces: OracleFace[]
  /** A representative printing, so the UI can show an image without a lookup. */
  defaultPrintingId: string
}

export interface OracleFace {
  name: string
  manaCost: string
  typeLine: string
  oracleText: string
  colors: string[]
}

/**
 * One entry per printing the user actually owns — the set-specific facts.
 * Fetched on demand via /cards/collection rather than from a bulk file, which
 * keeps the cache proportional to the collection instead of to all of Magic.
 */
export interface PrintingCard {
  id: string
  oracleId: string
  name: string
  set: string
  setName: string
  collectorNumber: string
  rarity: string
  releasedAt: string
  finishes: string[]
  lang: string
  /** Scryfall price strings; null where unpriced. */
  prices: {
    eur: string | null
    eurFoil: string | null
    usd: string | null
    usdFoil: string | null
  }
  imageNormal: string
  imageSmall: string
  scryfallUri: string
}

export interface RawFace {
  name?: string
  mana_cost?: string
  type_line?: string
  oracle_text?: string
  colors?: string[]
  image_uris?: Record<string, string>
}

export interface RawCard {
  id?: string
  oracle_id?: string
  name?: string
  mana_cost?: string
  cmc?: number
  type_line?: string
  oracle_text?: string
  colors?: string[]
  color_identity?: string[]
  keywords?: string[]
  layout?: string
  legalities?: Record<string, string>
  reserved?: boolean
  edhrec_rank?: number
  card_faces?: RawFace[]
  set?: string
  set_name?: string
  collector_number?: string
  rarity?: string
  released_at?: string
  finishes?: string[]
  lang?: string
  prices?: Record<string, string | null>
  image_uris?: Record<string, string>
  scryfall_uri?: string
}

/**
 * Reduce a raw Scryfall card to the oracle-level fields we keep.
 *
 * Multi-face layouts are the classic source of bugs here: on `transform` and
 * `modal_dfc` cards `mana_cost` and `colors` live on each face rather than on
 * the card, while `cmc`, `color_identity` and `legalities` stay on the card. We
 * therefore always keep the faces, and fall back to the first face's mana cost
 * when the card-level one is absent.
 */
export function toOracleCard(raw: RawCard): OracleCard | null {
  if (!raw.oracle_id || !raw.name) return null
  const faces: OracleFace[] = (raw.card_faces ?? []).map((face) => ({
    name: face.name ?? '',
    manaCost: face.mana_cost ?? '',
    typeLine: face.type_line ?? '',
    oracleText: face.oracle_text ?? '',
    colors: face.colors ?? []
  }))

  return {
    oracleId: raw.oracle_id,
    name: raw.name,
    manaCost: raw.mana_cost ?? faces[0]?.manaCost ?? '',
    cmc: raw.cmc ?? 0,
    typeLine: raw.type_line ?? faces.map((f) => f.typeLine).join(' // '),
    oracleText: raw.oracle_text ?? faces.map((f) => f.oracleText).join('\n//\n'),
    colors: raw.colors ?? [...new Set(faces.flatMap((f) => f.colors))],
    colorIdentity: raw.color_identity ?? [],
    keywords: raw.keywords ?? [],
    layout: raw.layout ?? 'normal',
    legalities: encodeLegalities(raw.legalities),
    reserved: raw.reserved ?? false,
    edhrecRank: raw.edhrec_rank ?? null,
    faces,
    defaultPrintingId: raw.id ?? ''
  }
}

/** Reduce a raw Scryfall card to the printing-level fields we keep. */
export function toPrintingCard(raw: RawCard): PrintingCard | null {
  if (!raw.id || !raw.oracle_id) return null
  // Double-faced cards carry images per face, not on the card.
  const images = raw.image_uris ?? raw.card_faces?.[0]?.image_uris ?? {}
  return {
    id: raw.id,
    oracleId: raw.oracle_id,
    name: raw.name ?? '',
    set: raw.set ?? '',
    setName: raw.set_name ?? '',
    collectorNumber: raw.collector_number ?? '',
    rarity: raw.rarity ?? '',
    releasedAt: raw.released_at ?? '',
    finishes: raw.finishes ?? [],
    lang: raw.lang ?? 'en',
    prices: {
      eur: raw.prices?.eur ?? null,
      eurFoil: raw.prices?.eur_foil ?? null,
      usd: raw.prices?.usd ?? null,
      usdFoil: raw.prices?.usd_foil ?? null
    },
    imageNormal: images.normal ?? images.large ?? '',
    imageSmall: images.small ?? images.normal ?? '',
    scryfallUri: raw.scryfall_uri ?? ''
  }
}
