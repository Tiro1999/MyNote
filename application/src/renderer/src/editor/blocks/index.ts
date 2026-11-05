import type { EditorFeature } from '../feature'
import { Callout, calloutSlashItems } from './callout'
import { PageHierarchyBlock, pageHierarchySlashItem } from './pageHierarchy'
import { TableWithControls, tableSlashItem } from './table/table'
import { TocBlock, tocSlashItem } from './toc'

export const coreBlocks: EditorFeature = {
  name: 'core',
  extensions: [Callout, TocBlock, PageHierarchyBlock, TableWithControls],
  slashItems: [...calloutSlashItems, tocSlashItem, pageHierarchySlashItem, tableSlashItem]
}
