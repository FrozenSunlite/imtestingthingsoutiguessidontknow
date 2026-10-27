import { useRef, useState } from "react";
import { SEARCH_FIELDS } from "@/lib/treeSearch";
import { Search, X } from "lucide-react";

const MIN_W = 260;
const MIN_H = 220;
const MAX_W = 800;
const MAX_H = 760;

// Floating search window: double-clicking the search bar opens it, a larger
// cousin of the floating pool window. Draggable by its header, resizable from
// the right/bottom edges and the corner, it shows every match (not just the
// first ten) plus the search-syntax reference. Fixed to the viewport so it
// always draws above the tree and panels.
export function SearchWindow({ query, setQuery, matches, onPick, onClose }) {
  const [box, setBox] = useState({ x: 260, y: 150, w: 340, h: 420 });
  const dragRef = useRef(null);
  const startMove = (e) => {
    // Buttons in the header (close) must not trigger the drag: pointer capture
    // on the header retargets the click and swallows the button's onClick.
    if (e.target.closest("button")) return;
    dragRef.current = { mode: "move", sx: e.clientX, sy: e.clientY, box };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const startResize = (e, mode) => {
    dragRef.current = { mode, sx: e.clientX, sy: e.clientY, box };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (d.mode === "move")
      setBox({ ...d.box, x: Math.max(0, d.box.x + dx), y: Math.max(0, d.box.y + dy) });
    else {
      const w = d.mode === "s" ? d.box.w : Math.min(MAX_W, Math.max(MIN_W, d.box.w + dx));
      const h = d.mode === "e" ? d.box.h : Math.min(MAX_H, Math.max(MIN_H, d.box.h + dy));
      setBox({ ...d.box, w, h });
    }
  };
  const endMove = () => {
    dragRef.current = null;
  };

  return (
    <div
      className="fixed z-50 flex flex-col overflow-hidden rounded-lg border bg-card shadow-xl"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
    >
      <div
        className="flex touch-none cursor-grab items-center gap-1.5 border-b bg-muted/50 px-2 py-1.5"
        onPointerDown={startMove}
        onPointerMove={onMove}
        onPointerUp={endMove}
        onPointerCancel={endMove}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-xs font-semibold">Search skills</span>
        <button className="rounded p-0.5 hover:bg-accent" title="Close" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="border-b px-2 py-1.5">
        <input
          className="h-8 w-full rounded-md border bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground"
          placeholder='Search skills… n:"Fire Bolt"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {matches.map((m, i) => (
          <button
            key={m.node.id + ":" + i}
            type="button"
            onClick={() => onPick(m.node, i)}
            className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent"
          >
            <span className="truncate">{m.node.name || m.node.id}</span>
            <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
              {m.matched}
            </span>
          </button>
        ))}
        {query.trim() && matches.length === 0 && (
          <p className="px-2 py-2 text-xs text-muted-foreground">No matches.</p>
        )}
      </div>

      <div className="max-h-32 shrink-0 overflow-y-auto border-t bg-muted/40 px-2 py-1.5">
        <p className="mb-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
          Search syntax
        </p>
        {SEARCH_FIELDS.map((f) => (
          <div key={f.key} className="flex items-baseline gap-2 py-0.5 text-[10px]">
            <code className="shrink-0 rounded bg-muted px-1 font-mono">{f.example}</code>
            <span className="text-muted-foreground">{f.desc}</span>
          </div>
        ))}
      </div>

      {/* Resize handles: right edge, bottom edge, corner */}
      <div
        className="absolute right-0 top-8 h-full w-1.5 cursor-ew-resize"
        onPointerDown={(e) => startResize(e, "e")}
        onPointerMove={onMove}
        onPointerUp={endMove}
        onPointerCancel={endMove}
      />
      <div
        className="absolute bottom-0 left-0 h-1.5 w-full cursor-ns-resize"
        onPointerDown={(e) => startResize(e, "s")}
        onPointerMove={onMove}
        onPointerUp={endMove}
        onPointerCancel={endMove}
      />
      <div
        className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize"
        onPointerDown={(e) => startResize(e, "se")}
        onPointerMove={onMove}
        onPointerUp={endMove}
        onPointerCancel={endMove}
      />
    </div>
  );
}