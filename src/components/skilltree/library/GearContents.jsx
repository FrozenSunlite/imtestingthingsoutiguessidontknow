import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { InfoTip } from "@/components/skilltree/InfoTip";

// Contents editor for a kit or container (e.g. a backpack or a dungeoneer's
// pack): rows of bundled items with quantity, cost and weight each. The
// packed weight totals quantity × per-item weight.
export function GearContents({ contents, onChange }) {
  const set = (j, patch) => onChange(contents.map((r, k) => (k === j ? { ...r, ...patch } : r)));
  const add = () => onChange([...contents, { name: "", qty: 1, cost: "", weight: 0 }]);
  const remove = (j) => onChange(contents.filter((_, k) => k !== j));
  const totalWeight = contents.reduce(
    (s, r) => s + (Number(r.weight) || 0) * (Number(r.qty) || 1),
    0
  );
  return (
    <div className="space-y-1.5 rounded-md border bg-muted/30 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Contents
        </span>
        <span className="text-[10px] text-muted-foreground">
          {contents.length} item{contents.length === 1 ? "" : "s"} · {totalWeight} lb packed
        </span>
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add item
        </Button>
      </div>
      {contents.map((row, j) => (
        <div key={j} className="flex items-center gap-1">
          <InfoTip label="Name of the item bundled inside.">
            <Input
              className="h-7 flex-1 text-xs"
              placeholder="Contained item"
              value={row.name || ""}
              onChange={(e) => set(j, { name: e.target.value })}
            />
          </InfoTip>
          <InfoTip label="How many of this item the kit holds, e.g. 10 torches.">
            <Input
              className="h-7 w-14 text-xs"
              type="number"
              min={1}
              title="Qty"
              value={row.qty ?? 1}
              onChange={(e) => set(j, { qty: Math.max(1, Number(e.target.value) || 1) })}
            />
          </InfoTip>
          <InfoTip label="Cost and currency of one piece, e.g. 1 gp.">
            <Input
              className="h-7 w-20 text-xs"
              placeholder="Cost"
              value={row.cost || ""}
              onChange={(e) => set(j, { cost: e.target.value })}
            />
          </InfoTip>
          <InfoTip label="Weight of one piece in pounds.">
            <Input
              className="h-7 w-16 text-xs"
              type="number"
              min={0}
              title="Weight (lb)"
              value={row.weight ?? 0}
              onChange={(e) => set(j, { weight: Number(e.target.value) || 0 })}
            />
          </InfoTip>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => remove(j)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {contents.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          Empty — add the items this kit or container holds.
        </p>
      )}
    </div>
  );
}