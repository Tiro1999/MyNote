import { coreBlocks, type EditorFeature } from '@renderer/editor'
import { financeFeature, financePlaceholderFeature } from '@renderer/finance'
import { FEATURE_FINANCE } from '@shared/features'

export const editorFeatures: EditorFeature[] = [
  coreBlocks,
  FEATURE_FINANCE ? financeFeature : financePlaceholderFeature
]
