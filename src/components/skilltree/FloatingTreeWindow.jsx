import { useRef, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { X } from "lucide-react";
import { SideTreePanel } from "@/components/skilltree/SideTreePanel";

// A node subtree picked from the View screen opens in a draggable floating
// window over the character sheet (instead of a flanking side panel). The
// window hosts the same play panel — investing, pools and tooltips all work;
// double-click a node to apply it to the character.
export function FloatingTreeWindow({ slot }) {
  const { sideTrees, setSideTree } = useTree();
  const st = (sideTrees || {})[slot];
  const [pos, setPos] = useState({ x: slot === "right" ? 260 : 60, y: 40 });
  const drag = useRef(null);
  const startDrag = (e) => {
    if (e.button !== 0) return;
    drag.current = { sx: e.clientX, sy: e.clientY, x: pos.x, y: pos.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onDragMove = (e) => {
    const d = drag.current;
    if (!d) return;
    setPos({
      x: Math.max(0, d.x + e.clientX - d.sx),
      y: Math.max(0, d.y + e.clientY - d.sy),
    });
  };
  const endDrag = () => {
    drag.current = null;
  };
  if (!st || st.closed) return null;
  return (
    <div
      className="absolute z-40 flex flex-col overflow-hidden rounded-xl border bg-card shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: 520, height: "min(560px, calc(100% - 80px))" }}
    >
      <div
        className="flex shrink-0 cursor-grab items-center justify-between gap-2 border-b bg-muted/60 px-3 py-1.5 active:cursor-grabbing"
        onPointerDown={startDrag}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="min-w-0 flex-1 truncate text-xs font-semibold" title={st.name}>
          {st.name || "Subtree"}
        </span>
        <button
          className="rounded p-0.5 hover:bg-accent"
          title="Close this window — its tree and invested points are kept"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setSideTree(slot, { ...st, closed: true })}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <SideTreePanel slot={slot} floating />
      </div>
    </div>
  );
}