import { NodeHoverCard } from "@/components/skilltree/NodeHoverCard";
import { SubtreePreview } from "@/components/skilltree/SubtreePreview";

export function NodeTooltip({ hover, nodesById, subtreePreview = false }) {
  if (!hover) return null;
  const { node } = hover;
  const preview =
    subtreePreview && (node.subtrees?.[0]?.nodes || []).length > 0 ? (
      <div className="mt-2 rounded-md border bg-background p-1">
        <SubtreePreview subtree={node.subtrees[0]} width={232} />
        <p className="px-1 pt-0.5 text-[10px] text-muted-foreground">
          {node.subtrees[0].nodes.length} subnode
          {node.subtrees[0].nodes.length > 1 ? "s" : ""}
          {node.subtrees.length > 1 ? ` · first of ${node.subtrees.length} subtrees` : ""} — Alt
          preview
        </p>
      </div>
    ) : null;
  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{ left: hover.x, top: hover.y }}
    >
      <NodeHoverCard node={node} nodesById={nodesById} extra={preview} />
    </div>
  );
}
