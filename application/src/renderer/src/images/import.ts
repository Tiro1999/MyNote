import { nanoid } from 'nanoid'
import { useNotebookStore } from '../store/notebookStore'
import {
  IMAGE_EXTENSIONS,
  RENDER_PROFILE,
  assetUrl,
  extensionOf,
  fitWithin,
  isReencodable
} from './source'

/** Filter passed to the native file picker. */
export const IMAGE_FILE_FILTERS = [{ name: 'Bilder', extensions: [...IMAGE_EXTENSIONS] }]

/** The node attributes a successful import produces. */
export interface ImportedImage {
  mode: 'copy' | 'link'
  src: string
  alt: string
  width: null
  naturalWidth: number
  naturalHeight: number
}

export interface ImportDeps {
  pickFile(): Promise<string | null>
  stat(path: string): Promise<{ size: number; mtimeMs: number } | null>
  copyFile(source: string, destination: string): Promise<void>
  writeBinary(path: string, bytes: Uint8Array): Promise<void>
  /** Intrinsic pixel size of the image behind `url`. */
  probe(url: string): Promise<{ width: number; height: number }>
  /** Downscaled WebP bytes, or null when the encoder is unavailable. */
  encode(url: string, target: { width: number; height: number }): Promise<Uint8Array | null>
  /** Absolute assets/ folder of the open page, created if missing. */
  assetDir(): Promise<string>
  newId(): string
}

/**
 * Picks a file and copies it into the page's assets/ folder, re-encoded to the render
 * profile. Falls back to a verbatim copy for GIF/SVG, when the re-encode would be
 * larger than the original, or when the encoder is unavailable.
 */
export async function importImageAsCopy(deps: ImportDeps): Promise<ImportedImage | null> {
  const sourcePath = await deps.pickFile()
  if (!sourcePath) return null

  const extension = extensionOf(sourcePath)
  const intrinsic = await deps.probe(assetUrl(sourcePath))
  const assetDirectory = await deps.assetDir()
  const id = deps.newId()

  const copyVerbatim = async (): Promise<ImportedImage> => {
    await deps.copyFile(sourcePath, `${assetDirectory}/${id}.${extension}`)
    return {
      mode: 'copy',
      src: `assets/${id}.${extension}`,
      alt: '',
      width: null,
      naturalWidth: intrinsic.width,
      naturalHeight: intrinsic.height
    }
  }

  if (!isReencodable(extension)) return copyVerbatim()

  const target = fitWithin(intrinsic.width, intrinsic.height, RENDER_PROFILE.maxEdge)
  const encoded = await deps.encode(assetUrl(sourcePath), target)
  if (!encoded) return copyVerbatim()

  const originalSize = (await deps.stat(sourcePath))?.size ?? Number.POSITIVE_INFINITY
  if (encoded.byteLength >= originalSize) return copyVerbatim()

  await deps.writeBinary(`${assetDirectory}/${id}.${RENDER_PROFILE.extension}`, encoded)
  return {
    mode: 'copy',
    src: `assets/${id}.${RENDER_PROFILE.extension}`,
    alt: '',
    width: null,
    naturalWidth: target.width,
    naturalHeight: target.height
  }
}

/** Picks a file and references it where it lies — nothing is copied or re-encoded. */
export async function importImageAsLink(deps: ImportDeps): Promise<ImportedImage | null> {
  const sourcePath = await deps.pickFile()
  if (!sourcePath) return null
  const intrinsic = await deps.probe(assetUrl(sourcePath))
  return {
    mode: 'link',
    src: sourcePath,
    alt: '',
    width: null,
    naturalWidth: intrinsic.width,
    naturalHeight: intrinsic.height
  }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = url
  await image.decode()
  return image
}

/** Wires ImportDeps to the real preload bridge, the notebook store and the DOM canvas. */
export function browserImportDeps(): ImportDeps {
  return {
    pickFile: () => window.api.dialog.openFile(IMAGE_FILE_FILTERS),
    stat: (path) => window.api.fs.statFile(path),
    copyFile: (source, destination) => window.api.fs.copyFile(source, destination),
    writeBinary: (path, bytes) => window.api.fs.writeBinary(path, bytes),
    probe: async (url) => {
      const image = await loadImage(url)
      return { width: image.naturalWidth, height: image.naturalHeight }
    },
    encode: async (url, target) => {
      const image = await loadImage(url)
      const canvas = document.createElement('canvas')
      canvas.width = target.width
      canvas.height = target.height
      const context = canvas.getContext('2d')
      if (!context) return null
      context.drawImage(image, 0, 0, target.width, target.height)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, RENDER_PROFILE.mimeType, RENDER_PROFILE.quality)
      )
      return blob ? new Uint8Array(await blob.arrayBuffer()) : null
    },
    assetDir: async () => {
      const directory = await useNotebookStore.getState().ensureAssetDir()
      if (!directory) throw new Error('Keine Seite geöffnet')
      return directory
    },
    newId: () => nanoid()
  }
}
