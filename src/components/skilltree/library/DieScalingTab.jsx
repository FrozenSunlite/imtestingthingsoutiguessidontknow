import { useTree } from "@/lib/treeStore";
import { useLibList } from "./shared";
import { DEFAULT_DIE_SCALING, dieStats } from "@/lib/dieScaling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { Plus, RotateCcw, X } from "lucide-react";

const average = (value) => {
  const stats = dieStats(value);
  if (!stats) return "—";
  if (stats.count === 0) return `${stats.min}`;
  return `${Math.round(stats.avg * 10) / 10}`;
};

// Reference Library tab for the die-scaling ladder. Resources can start a die
// at any of these steps and nodes can move a die up/down by a number of
// steps; the same ladder describes unarmed die sizes and similar homebrew.
export function DieScalingTab() {
  const { setSettings } = useTree();
  const { items, add, patch, remove, query, setQuery, shown } = useLibList("dieScaling");

  const reset = () =>
    setSettings((s) => ({
      ...s,
      library: {
        ...s.library,
        dieScaling: DEFAULT_DIE_SCALING.map((name) => ({ name })),
      },
    }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="outline" onClick={() => add({ name: "" })}>
          <Plus className="mr-1 h-4 w-4" /> Add step
        </Button>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={reset} title="Restore the standard 1, 1d4, 1d6… ladder">
            <RotateCcw className="mr-1 h-4 w-4" /> Reset ladder
          </Button>
          <InfoTip label="Filter the ladder by die expression.">
            <Input
              className="h-8 w-40"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InfoTip>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        The order dice grow in. Resources can start at a step and nodes can raise or lower a die by
        steps. The default follows 1 → 1d4 → 1d6 → 1d8 → 1d10 → 1d12 → 2d6 → 2d8 → 2d10 → 2d12 →
        3d6… Edit or reorder the list to use your own ladder.
      </p>
      {shown.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {(items || []).length === 0 ? "No ladder steps yet." : "No matches."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {shown.map(({ e, i }) => {
            const stats = dieStats(e.name);
            return (
              <div key={i} className="flex items-center gap-1 rounded-md border p-1">
                <span className="w-6 shrink-0 text-center text-[10px] font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <Input
                  className="h-7 min-w-0 flex-1 font-mono text-xs"
                  placeholder="e.g. 2d6"
                  value={e.name || ""}
                  onChange={(ev) => patch(i, { name: ev.target.value })}
                />
                <span
                  className="w-24 shrink-0 text-right text-[10px] text-muted-foreground"
                  title="Average roll (and range when it is a die)"
                >
                  {stats && stats.count > 0
                    ? `avg ${average(e.name)} · ${stats.min}–${stats.max}`
                    : average(e.name)}
                </span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => remove(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
