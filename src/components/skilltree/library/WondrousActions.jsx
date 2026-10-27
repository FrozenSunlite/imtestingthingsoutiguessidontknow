import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { Plus, X } from "lucide-react";

// Editor for the actions a wondrous item can perform and each action's
// charge cost (blank = free). The item's total charges live in its existing
// "Uses / charges" field.
export function WondrousActions({ item, onPatch }) {
  const acts = item.itemActions || [];
  const setActs = (next) => onPatch({ itemActions: next });
  return (
    <div className="space-y-1 rounded-md bg-muted/50 p-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Item Actions
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setActs([...acts, { name: "", chargeCost: "" }])}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {acts.map((a, i) => (
        <div key={i} className="flex items-center gap-1">
          <InfoTip label="What using this action does, e.g. Cast Fireball.">
            <Input
              className="h-7 flex-1"
              placeholder="Action name (e.g. Cast Fireball)"
              value={a.name || ""}
              onChange={(e) => {
                const next = [...acts];
                next[i] = { ...a, name: e.target.value };
                setActs(next);
              }}
            />
          </InfoTip>
          <InfoTip label="Charges spent per use; blank = free.">
            <Input
              className="h-7 w-20"
              type="number"
              min={0}
              placeholder="Charges"
              value={a.chargeCost ?? ""}
              onChange={(e) => {
                const next = [...acts];
                next[i] = {
                  ...a,
                  chargeCost: e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0),
                };
                setActs(next);
              }}
            />
          </InfoTip>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setActs(acts.filter((_, j) => j !== i))}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {acts.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          No actions yet — charges spent come from "Uses / charges".
        </p>
      )}
    </div>
  );
}