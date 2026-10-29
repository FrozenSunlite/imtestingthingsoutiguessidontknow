import { isExclusiveBlocked } from "@/lib/geometry";
import { POOL_LABELS, poolForNode } from "@/lib/treeStore";

const poolForNodeType = poolForNode;

// The contents of the node hover card, without the fixed positioning wrapper.
// Reused by the canvas tooltip and by the subtree previews in Edit Node.
export function NodeHoverCard({ node, nodesById, extra = null }) {
  if (!node) return null;
  const exclusiveNames = (node.exclusiveWith || [])
    .map((id) => nodesById?.[id]?.name)
    .filter(Boolean);
  return (
    <div className="w-64 rounded-md border bg-popover p-3 text-xs shadow-lg">
      <p className="text-sm font-semibold">{node.name}</p>
      <p className="mt-1 text-muted-foreground">
        {(node.currentPoints || 0)}/{node.maxPoints} points ·{" "}
        {node.nodeType === "attribute"
          ? `Attribute (${node.attributeStat || "?"})`
          : node.nodeType || node.pointType}
        {" · costs "}
        {POOL_LABELS[node.poolOverride || poolForNodeType(node)] || "Talent"}
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
      {extra}
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
