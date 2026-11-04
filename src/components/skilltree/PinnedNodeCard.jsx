import { useRef, useState } from "react";
import { useTree, poolForNode } from "@/lib/treeStore";
import { pointTypesFor, poolLabel } from "@/lib/pointTypes";
import { isAvailable } from "@/lib/geometry";
import { hiddenNodeIds } from "@/lib/nodeVisibility";
import { ChevronDown, ChevronRight, GripHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const CARD_W = 288;
const REST_LABEL = { none: "", short: "short rest", long: "long rest" };

// Player-facing detail body for one node: description, actions, resources,
// prerequisites and the nodes it unlocks. While Blind Run hides locked nodes,
// locked children are left out of the card too. Shared by the floating pinned
// cards and the Values-mode collection at the bottom of the canvas.
export function NodeDetailBody({ node, nodesById, blind = false }) {
  const { settings } = useTree();
  const types = pointTypesFor(settings);
  const typeLabel =
    (settings?.library?.nodeTypes || []).find(
      (t) => t.value === (node.nodeType || "skill")
    )?.label || "Skill";
  const pool = poolForNode(node, types);
  const children = Object.values(nodesById || {}).filter((n) =>
    (n.dependencies || []).includes(node.id)
  );
  const shownChildren = children.filter(
    (c) => !blind || (c.currentPoints || 0) > 0 || isAvailable(c, nodesById)
  );
  const hiddenChildren = children.length - shownChildren.length;
  const prereqNames = (node.dependencies || [])
    .map((id) => nodesById[id]?.name)
    .filter(Boolean);
  const reqRaw = Number(node.requiredPoints);

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {typeLabel}
        {node.maxPoints > 1 ? ` · ${node.currentPoints || 0}/${node.maxPoints}` : ""}
        {" · "}
        {poolLabel(types, pool)} pool
        {Number(node.cost ?? 1) === 0 ? " · free" : ` · ${node.cost ?? 1} pt/point`}
      </div>

      {node.description && (
        <p className="mt-2 whitespace-pre-wrap text-xs leading-snug">{node.description}</p>
      )}
      {node.flavor && <p className="mt-1 text-xs italic text-muted-foreground">{node.flavor}</p>}
      {(node.description || node.flavor) && (
        <p className="mt-1 text-[10px] italic text-muted-foreground">
          Flavor is free — reword or replace it; the rules above still apply.
        </p>
      )}

      {(node.actions || []).length > 0 && (
        <div className="mt-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Actions</div>
          {(node.actions || []).map((a, i) => (
            <div key={i} className="mt-1 rounded bg-muted/50 px-2 py-1">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs font-medium">{a.name}</span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {a.usesMode === "atwill"
                    ? "At will"
                    : a.usesMode === "shared"
                    ? `via ${a.sharedResource || "pool"}`
                    : a.ownUses != null && a.ownUses !== ""
                    ? a.ownUses
                    : ""}
                </span>
              </div>
              {a.description && (
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{a.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {(node.resources || []).length > 0 && (
        <div className="mt-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Resources</div>
          <ul className="mt-0.5 ml-4 list-disc text-xs">
            {(node.resources || []).map((r, i) => (
              <li key={i}>
                {r.name || "—"}
                {r.value != null && r.value !== "" ? `: ${r.value}` : ""}
                {REST_LABEL[r.recovery] ? ` · ${REST_LABEL[r.recovery]}${r.recoveryAmount ? ` +${r.recoveryAmount}` : ""}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {prereqNames.length > 0 && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Requires:</span>{" "}
          {prereqNames.join(", ")}
          {reqRaw === 0 ? " (auto)" : reqRaw > 1 ? ` (${reqRaw} pts each)` : ""}
        </div>
      )}

      {(shownChildren.length > 0 || hiddenChildren > 0) && (
        <div className="mt-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Unlocks</div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {shownChildren.map((c) => (
              <span key={c.id} className="rounded-full border px-2 py-0.5 text-[10px]">
                {c.name || "Unnamed"}
              </span>
            ))}
            {hiddenChildren > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                +{hiddenChildren} hidden (not yet visible)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// One pinned card: draggable by its header, collapsible, closable. Position
// is stored per pin; unset pins cascade down the canvas's right edge.
function PinnedCard({ node, nodesById, blind, index, pos, onMove, onClose }) {
  const [collapsed, setCollapsed] = useState(false);
  const ref = useRef(null);
  const dragRef = useRef(null);

  const startDrag = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const cont = ref.current.offsetParent?.getBoundingClientRect();
    const start = pos || {
      x: rect.left - (cont?.left || 0),
      y: rect.top - (cont?.top || 0),
    };
    dragRef.current = { sx: e.clientX, sy: e.clientY, x: start.x, y: start.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDrag = (e) => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    onMove({
      x: Math.max(0, d.x + (e.clientX - d.sx)),
      y: Math.max(0, d.y + (e.clientY - d.sy)),
    });
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  const style = pos
    ? { left: pos.x, top: pos.y, width: CARD_W }
    : { right: 12, top: 12 + index * 40, width: CARD_W };

  return (
    <div
      ref={ref}
      className="absolute z-20 max-h-[75%] overflow-hidden rounded-lg border bg-card text-sm shadow-xl"
      style={style}
    >
      <div
        className="flex touch-none cursor-grab items-center gap-1 border-b bg-muted/50 px-2 py-1.5"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 truncate text-xs font-semibold">
          {node.name || "Unnamed node"}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 shrink-0 p-0"
          title={collapsed ? "Expand" : "Collapse"}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 shrink-0 p-0"
          title="Unpin"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {!collapsed && (
        <div className="max-h-[60vh] overflow-y-auto p-3">
          <NodeDetailBody node={node} nodesById={nodesById} blind={blind} />
        </div>
      )}
    </div>
  );
}

// Any number of pinned nodes, each rendered as its own adjustable card.
export function PinnedNodeCard() {
  const { tree, ui, setUi, character } = useTree();
  const nodes = tree?.nodes || [];
  const nodesById = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const dmHidden = character.devMode ? new Set() : hiddenNodeIds(nodes);
  const pins = (ui.pinnedNodeIds || [])
    .map((id) => nodesById[id])
    .filter((node) => node && !dmHidden.has(node.id));
  if (pins.length === 0) return null;

  const onMove = (id, p) =>
    setUi((u) => ({ ...u, pinPositions: { ...(u.pinPositions || {}), [id]: p } }));
  const onClose = (id) =>
    setUi((u) => {
      const { [id]: _drop, ...rest } = u.pinPositions || {};
      return {
        ...u,
        pinnedNodeIds: (u.pinnedNodeIds || []).filter((p) => p !== id),
        pinPositions: rest,
      };
    });

  return (
    <>
      {pins.map((node, i) => (
        <PinnedCard
          key={node.id}
          node={node}
          index={i}
          pos={(ui.pinPositions || {})[node.id]}
          nodesById={nodesById}
          blind={!!character.hideLockedNodes}
          onMove={(p) => onMove(node.id, p)}
          onClose={() => onClose(node.id)}
        />
      ))}
    </>
  );
}