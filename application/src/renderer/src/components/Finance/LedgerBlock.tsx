import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

export default function LedgerBlock({ node }: NodeViewProps): JSX.Element {
  const ledgerId = node.attrs.ledgerId as string
  return (
    <NodeViewWrapper className="finance-ledger" contentEditable={false}>
      <div className="rounded-lg border border-gray-300 p-3 text-sm dark:border-gray-700">
        Finanz-Ledger #{ledgerId}
      </div>
    </NodeViewWrapper>
  )
}
