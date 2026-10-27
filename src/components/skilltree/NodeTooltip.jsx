import { isExclusiveBlocked } from "@/lib/geometry";
import { POOL_LABELS, poolForNode } from "@/lib/treeStore";
import { SubtreePreview } from "@/components/skilltree/SubtreePreview";

const poolForNodeType = poolForNode;

export function NodeTooltip({ hover, nodesById, subtreePreview = false }) {
  if (!hover) return null;
  const { node, x, y } = hover;
  const exclusiveNames = (node.exclusiveWith || [])
    .map((id) => nodesById?.[id]?.name)
    .filter(Boolean);
  return (
    <div
      className="pointer-events-none fixed z-50 w-64 rounded-md border bg-popover p-3 text-xs shadow-lg"
      style={{ left: x, top: y }}
    >
      <p className="text-sm font-semibold">{node.name}</p>
      <p className="mt-1 text-muted-foreground">
        {(node.currentPoints || 0)}/{node.maxPoints} points ·{" "}
        {node.nodeType === "attribute"
          ? `Attribute (${node.attributeStat || "?"})`
          : node.nodeType || node.pointType}
        · costs {POOL_LABELS[node.poolOverride || poolForNodeType(node)] || "Talent"}
      </p>
      {(node.requiredProficiencies || []).length > 0 && (
        <p className="mt-1 text-[10px] text-amber-500">
          Requires proficiency:{" "}
          {node.requiredProficiencies.map((r) => r.name).filter(Boolean).join(", ")}
        </p>
      )}
      {exclusiveNames.length > 0 && (
        <p className="mt-1 text-[10px] text-rose-500">
          {isExclusiveBlocked(node, nodesById)
            ? `Locked — mutually exclusive with ${exclusiveNames.join(", ")}`
            : `Cannot combine with: ${exclusiveNames.join(", ")}`}
        </p>
      )}
      {subtreePreview && (node.subtrees?.[0]?.nodes || []).length > 0 && (
        <div className="mt-2 rounded-md border bg-background p-1">
          <SubtreePreview subtree={node.subtrees[0]} width={232} />
          <p className="px-1 pt-0.5 text-[10px] text-muted-foreground">
            {node.subtrees[0].nodes.length} subnode{node.subtrees[0].nodes.length > 1 ? "s" : ""}
            {node.subtrees.length > 1 ? ` · first of ${node.subtrees.length} subtrees` : ""} — Alt
            preview
          </p>
        </div>
      )}
      {node.description && (
        <p className="mt-2 whitespace-pre-wrap text-foreground/90">{node.description}</p>
      )}
      {node.flavor && (
        <p className="mt-1 whitespace-pre-wrap italic text-muted-foreground">{node.flavor}</p>
      )}
      {node.resources?.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {node.resources.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: r.color }}
              />
              <span>
                {r.name}: {r.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}