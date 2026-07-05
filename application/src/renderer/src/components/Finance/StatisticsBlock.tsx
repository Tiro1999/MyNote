import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

export default function StatisticsBlock({ node }: NodeViewProps): JSX.Element {
  return (
    <NodeViewWrapper className="finance-stats" contentEditable={false}>
      <div className="rounded-lg border border-gray-300 p-3 text-sm dark:border-gray-700">
        Finanz-Statistik (Quelle: #{(node.attrs.ledgerId as string) || '—'})
      </div>
    </NodeViewWrapper>
  )
}
