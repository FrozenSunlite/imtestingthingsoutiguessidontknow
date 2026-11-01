import { useTree } from "@/lib/treeStore";
import { nodeTypesFor } from "@/lib/pointTypes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { Plus, X } from "lucide-react";

// Node Types are the entries in the node editor's Node Type menu. Their value
// is the stable key saved on nodes; the label is what the editor shows.
export function NodeTypesTab() {
  const { settings, setSettings, tree } = useTree();
  const nodeTypes = nodeTypesFor(settings);
  const pointTypes = settings?.library?.pointTypes || [];
  const setNodeTypes = (next) =>
    setSettings((s) => ({
      ...s,
      library: { ...s.library, nodeTypes: next },
    }));

  const usage = (value) => {
    let count = 0;
    const walk = (nodes) => {
      (nodes || []).forEach((n) => {
        if ((n.nodeType || "skill") === value) count += 1;
        (n.subtrees || []).forEach((st) => walk(st.nodes));
      });
    };
    walk(tree?.nodes);
    return count;
  };

  const patch = (index, update) =>
    setNodeTypes(nodeTypes.map((type, i) => (i === index ? { ...type, ...update } : type)));

  const add = () => {
    const used = new Set(nodeTypes.map((type) => type.value));
    let n = nodeTypes.length + 1;
    let value = `type-${n}`;
    while (used.has(value)) {
      n += 1;
      value = `type-${n}`;
    }
    setNodeTypes([
      ...nodeTypes,
      { value, label: `Node Type ${n}` },
    ]);
  };

  const remove = (index) => {
    if (nodeTypes.length <= 1) return;
    const type = nodeTypes[index];
    if (usage(type.value) > 0) return;
    if (pointTypes.some((pt) => pt.nodeType === type.value)) return;
    setNodeTypes(nodeTypes.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Node types appear in the node editor's Node Type menu. Give each one a
          point type in the Point Types tab; unassigned types use the first point
          type. The key stays fixed so existing nodes keep working.
        </p>
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1 h-4 w-4" /> Add node type
        </Button>
      </div>
      <div className="space-y-1.5">
        {nodeTypes.map((type, index) => {
          const count = usage(type.value);
          const claimed = pointTypes.some((pt) => pt.nodeType === type.value);
          return (
            <div
              key={type.value}
              className="flex items-center gap-2 rounded-md border p-2"
            >
              <Input
                className="h-8 flex-1"
                value={type.label}
                placeholder="Node type name"
                onChange={(e) => patch(index, { label: e.target.value })}
              />
              <InfoTip label="Stable key saved on nodes. Not editable so existing nodes keep their type.">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {type.value}
                </span>
              </InfoTip>
              <span className="w-24 shrink-0 text-[10px] text-muted-foreground">
                {count ? `${count} node${count === 1 ? "" : "s"}` : "unused"}
                {claimed ? " · mapped" : ""}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={
                  nodeTypes.length <= 1 || count > 0 || claimed
                }
                title={
                  nodeTypes.length <= 1
                    ? "Keep at least one node type"
                    : count > 0
                      ? "This node type is used by nodes"
                      : claimed
                        ? "A point type still maps this node type"
                        : "Delete this node type"
                }
                onClick={() => remove(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
      {nodeTypes.length < 1 && (
        <p className="text-xs text-muted-foreground">No node types defined.</p>
      )}
    </div>
  );
}
