import { encumbranceInfo } from "@/lib/resources";

// Carrying-capacity bar for the inventory: fills with carried weight and
// changes color per encumbrance section — white up to the light threshold,
// yellow to heavy, orange to max, red once over capacity. Dashed marks show
// the light and heavy thresholds.
export function CapacityBar({ character, tree, carried, capacity }) {
  const enc = encumbranceInfo(character, tree);
  const pct = capacity > 0 ? Math.min(100, (carried / capacity) * 100) : 0;
  const over = capacity > 0 && carried > capacity;
  const fill = over
    ? "bg-red-500"
    : carried > enc.heavy
    ? "bg-orange-500"
    : carried > enc.light
    ? "bg-yellow-400"
    : "bg-white";
  const mark = (w) => (capacity > 0 ? Math.min(100, (w / capacity) * 100) : 0);
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all duration-200 ${fill}`}
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute top-0 h-full border-l border-dashed border-foreground/40"
        style={{ left: `${mark(enc.light)}%` }}
      />
      <div
        className="absolute top-0 h-full border-l border-dashed border-foreground/40"
        style={{ left: `${mark(enc.heavy)}%` }}
      />
    </div>
  );
}