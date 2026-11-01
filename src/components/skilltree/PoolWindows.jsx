import { useTree, poolUsage, effectivePools } from "@/lib/treeStore";
import { pointTypesFor, poolLabel } from "@/lib/pointTypes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";

const POOL_COLORS = {
  talent: "bg-sky-500",
  heritage: "bg-amber-500",
  attribute: "bg-violet-500",
};

function PoolWindow({ win, patch, remove, usage, eff, types }) {
  const pool = win.pool;
  const used = usage[pool] || 0;
  const total = eff[pool]?.total ?? 0;
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;

  const onHeaderPointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const sx = e.clientX - win.x;
    const sy = e.clientY - win.y;
    const move = (ev) =>
      patch(win.id, { x: Math.max(0, ev.clientX - sx), y: Math.max(0, ev.clientY - sy) });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className="absolute z-30 w-60 rounded-lg border bg-card shadow-xl"
      style={{ left: win.x, top: win.y }}
    >
      <div
        className="flex cursor-grab items-center gap-1 border-b px-2 py-1.5"
        onPointerDown={onHeaderPointerDown}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="flex-1 truncate text-xs font-medium">
          {poolLabel(types, pool)} Points
        </span>
        <button
          className="rounded p-0.5 hover:bg-accent"
          title={win.collapsed ? "Expand" : "Collapse"}
          onClick={() => patch(win.id, { collapsed: !win.collapsed })}
        >
          {win.collapsed ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          className="rounded p-0.5 hover:bg-accent"
          title="Close window"
          onClick={() => remove(win.id)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {!win.collapsed && (
        <div className="space-y-2 p-2">
          <Select value={pool} onValueChange={(v) => patch(win.id, { pool: v })}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {types.map((pt) => (
                <SelectItem key={pt.id} value={pt.id}>
                  {pt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Spent <span className="font-medium text-foreground">{used}</span> / {total} ·{" "}
            {Math.max(0, total - used)} left
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${POOL_COLORS[pool] || "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Floating, draggable, collapsable point-pool trackers spawned from the
// toolbar. Any number can be open at once, each watching its own currency.
export function PoolWindows({ wins, setWins }) {
  const { pools, character, mergedTree: tree, settings } = useTree();
  const usage = poolUsage(tree, settings?.library?.pointTypes);
  const eff = effectivePools(pools, character, tree, settings?.library?.levels, settings);

  const patch = (id, p) =>
    setWins((ws) => ws.map((w) => (w.id === id ? { ...w, ...p } : w)));
  const remove = (id) => setWins((ws) => ws.filter((w) => w.id !== id));

  if (!wins.length) return null;
  const types = pointTypesFor(settings);
  return (
    <>
      {wins.map((w) => (
        <PoolWindow
          key={w.id}
          win={w}
          patch={patch}
          remove={remove}
          usage={usage}
          eff={eff}
          types={types}
        />
      ))}
    </>
  );
}