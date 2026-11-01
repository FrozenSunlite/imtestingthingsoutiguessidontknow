import { useTree } from "@/lib/treeStore";
import { pointTypesFor, nodeTypesFor } from "@/lib/pointTypes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { Plus, X } from "lucide-react";

// Point Types: one row per currency, assigned to a node type. Every point type
// gets its own pool on the character sheet and its own field in Levels.
export function PointTypesTab() {
  const { settings, setSettings } = useTree();
  const pointTypes = pointTypesFor(settings);
  const nodeTypes = nodeTypesFor(settings);
  const setPointTypes = (next) =>
    setSettings((s) => ({
      ...s,
      library: { ...s.library, pointTypes: next },
    }));

  const patch = (index, update) =>
    setPointTypes(
      pointTypes.map((pt, i) => (i === index ? { ...pt, ...update } : pt))
    );

  const add = () => {
    const used = new Set(pointTypes.map((pt) => pt.id));
    let n = pointTypes.length + 1;
    let id = `type-${n}`;
    while (used.has(id)) {
      n += 1;
      id = `type-${n}`;
    }
    setPointTypes([
      ...pointTypes,
      {
        id,
        label: `Point Type ${n}`,
        nodeType: nodeTypes[0]?.value || "skill",
        currency: `Point Type ${n} Points`,
      },
    ]);
  };

  const remove = (index) => {
    if (pointTypes.length <= 1) return;
    setPointTypes(pointTypes.filter((_, i) => i !== index));
  };

  const usedNodeTypes = pointTypes.map((pt) => pt.nodeType);

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Each point type maps a node type to a currency. It adds a pool on the
          character sheet and a field in the Levels tab. Unmapped node types fall
          back to the first point type.
        </p>
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1 h-4 w-4" /> Add point type
        </Button>
      </div>
      <div className="space-y-1.5">
        {pointTypes.map((pt, index) => {
          const duplicate = usedNodeTypes.filter((t) => t === pt.nodeType).length > 1;
          const known = nodeTypes.some((t) => t.value === pt.nodeType);
          return (
            <div key={pt.id} className="rounded-md border p-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Point Type
                  </span>
                  <Input
                    className="h-8"
                    value={pt.label}
                    placeholder="e.g. Prestige"
                    onChange={(e) => patch(index, { label: e.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Point Currency
                  </span>
                  <Input
                    className="h-8"
                    value={pt.currency}
                    placeholder="e.g. Prestige Points"
                    onChange={(e) => patch(index, { currency: e.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Node Type
                  </span>
                  <Select
                    value={pt.nodeType}
                    onValueChange={(v) => patch(index, { nodeType: v })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {nodeTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                      {!known && (
                        <SelectItem value={pt.nodeType}>{pt.nodeType}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </label>
                <div className="flex items-end justify-between gap-2">
                  <InfoTip label="Internal pool key used by saved projects.">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {pt.id}
                    </span>
                  </InfoTip>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={pointTypes.length <= 1}
                    title={
                      pointTypes.length <= 1
                        ? "Keep at least one point type"
                        : "Delete this point type"
                    }
                    onClick={() => remove(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {duplicate && (
                <p className="mt-1 text-[10px] text-amber-600">
                  Another point type already claims this node type; the first match wins.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
