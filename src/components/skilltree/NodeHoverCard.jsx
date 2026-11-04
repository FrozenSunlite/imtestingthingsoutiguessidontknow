import { isExclusiveBlocked } from "@/lib/geometry";
import { poolForNode, useTree } from "@/lib/treeStore";
import { pointTypesFor, poolLabel } from "@/lib/pointTypes";

// The contents of the node hover card, without the fixed positioning wrapper.
// Reused by the canvas tooltip and by the subtree previews in Edit Node.
export function NodeHoverCard({ node, nodesById, extra = null }) {
  const { settings } = useTree();
  if (!node) return null;
  const types = pointTypesFor(settings);
  const typeLabel =
    (settings?.library?.nodeTypes || []).find(
      (t) => t.value === (node.nodeType || "skill")
    )?.label || node.nodeType || node.pointType;
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
          : typeLabel}
        {" · costs "}
        {poolLabel(types, node.poolOverride || poolForNode(node, types))}
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
      {(node.description || node.flavor) && (
        <p className="mt-1 text-[10px] italic text-muted-foreground">
          Flavor is free — reword or replace it; the rules above still apply.
        </p>
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
