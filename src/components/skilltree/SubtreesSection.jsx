import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { FieldGroup } from "@/components/skilltree/FieldGroup";
import { AbilityReqEditor } from "@/components/skilltree/AbilityReqEditor";
import { SubtreeNodeEditor } from "@/components/skilltree/SubtreeNodeEditor";
import { makeHostCopy, nextSubtreeId } from "@/lib/subtrees";
import { ChevronDown, ChevronRight, Plus, Network, Trash2 } from "lucide-react";

// A node's subtrees: its own skill trees, each with its own pool and edited
// in the full subtree editor. The section is a drop target: dropping carried
// canvas nodes on a subtree copies them into that tree (linked to the host's
// copy); dropping on the empty strip creates a new subtree seeded with a copy
// of this node. A node can never be dropped into its own subtree — the store
// rejects that drop. Each subtree also lists its nodes with miniature effect
// editors (cost, ability gates, proficiencies, bonus dice, actions,
// resources) for quick access without leaving this panel.
export function SubtreesSection({ node, set }) {
  const { enterSubtreeEditor, carry, dropCarriedOnSubtree, settings } = useTree();
  const [dropKey, setDropKey] = useState(null);
  const [expanded, setExpanded] = useState(null); // "subtreeIndex:nodeIndex"
  const subtrees = node.subtrees || [];

  const addSubtree = () =>
    set({
      subtrees: [
        ...subtrees,
        {
          id: nextSubtreeId(),
          name: `Subtree ${subtrees.length + 1}`,
          nodes: [makeHostCopy(node)],
          connections: [],
          grantedPoints: 3,
          poolName: "",
          exclusive: false,
          autoGrantFirst: true,
          abilityReqs: [],
        },
      ],
    });

  const patch = (i, up) =>
    set({ subtrees: subtrees.map((st, j) => (j === i ? { ...st, ...up } : st)) });

  const remove = (i) => set({ subtrees: subtrees.filter((_, j) => j !== i) });

  const enter = (key) => carry && setDropKey(key);
  const leave = (key) => setDropKey((k) => (k === key ? null : k));
  const drop = (key) => {
    setDropKey(null);
    if (carry)
      dropCarriedOnSubtree(node.id, key === "new" ? subtrees.length : key);
  };

  return (
    <FieldGroup label="Subtrees">
      <InfoTip label="This node can unlock several of its own skill trees. Drag nodes from the canvas onto a subtree to copy them into it; each tree keeps its own points and settings.">
        <Label>Node subtrees (own skill trees)</Label>
      </InfoTip>
      {subtrees.map((st, i) => (
        <div
          key={st.id || i}
          onPointerEnter={() => enter(i)}
          onPointerLeave={() => leave(i)}
          onPointerUp={() => drop(i)}
          className={`space-y-1.5 rounded-md border p-2 transition-colors ${
            dropKey === i ? "border-primary bg-primary/10" : ""
          }`}
        >
          <div className="flex items-center gap-1">
            <Input
              className="h-7 flex-1"
              value={st.name || ""}
              placeholder="Subtree name"
              onChange={(e) => patch(i, { name: e.target.value })}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-1.5"
              title="Edit this subtree"
              onClick={() => enterSubtreeEditor(node.id, i)}
            >
              <Network className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-1.5 text-destructive"
              title="Delete this subtree"
              onClick={() => remove(i)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Pool name</Label>
              <Input
                className="h-7"
                value={st.poolName || ""}
                placeholder="e.g. Maneuvers"
                onChange={(e) => patch(i, { poolName: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Points granted</Label>
              <Input
                className="h-7"
                type="number"
                min={0}
                value={st.grantedPoints ?? 3}
                onChange={(e) =>
                  patch(i, { grantedPoints: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-xs">
            <Switch
              checked={!!st.exclusive}
              onCheckedChange={(v) => patch(i, { exclusive: v })}
            />
            Mutually exclusive (only one root branch)
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <Switch
              checked={st.autoGrantFirst !== false}
              onCheckedChange={(v) => patch(i, { autoGrantFirst: v })}
            />
            Grant the first node free when this talent is bought
          </label>
          <AbilityReqEditor
            reqs={st.abilityReqs || []}
            onChange={(abilityReqs) => patch(i, { abilityReqs })}
            label="Ability score gate"
            info="Ability scores the character needs before spending this subtree's points."
            compact
          />
          <div className="space-y-1">
            <Label className="text-[10px]">Nodes ({st.nodes.length})</Label>
            {st.nodes.map((sn, k) => {
              const key = `${i}:${k}`;
              const setNode = (up) =>
                patch(i, {
                  nodes: st.nodes.map((m, j) => (j === k ? { ...m, ...up } : m)),
                });
              return (
                <div key={sn.id || k} className="rounded-md border p-1.5">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 shrink-0 px-0"
                      title="Edit effects"
                      onClick={() => setExpanded(expanded === key ? null : key)}
                    >
                      {expanded === key ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <Input
                      className="h-7 flex-1"
                      value={sn.name || ""}
                      placeholder="Node name"
                      onChange={(e) => setNode({ name: e.target.value })}
                    />
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {(sn.currentPoints || 0) > 0 ? `${sn.currentPoints}/${sn.maxPoints || 1}` : `cost ${sn.cost ?? 1}`}
                    </span>
                  </div>
                  {expanded === key && (
                    <SubtreeNodeEditor node={sn} set={setNode} settings={settings} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div
        onPointerEnter={() => enter("new")}
        onPointerLeave={() => leave("new")}
        onPointerUp={() => drop("new")}
        className={`flex items-center justify-center gap-1 rounded-md border border-dashed p-2 text-xs text-muted-foreground transition-colors ${
          dropKey === "new" ? "border-primary bg-primary/10 text-foreground" : ""
        }`}
      >
        <Plus className="h-3.5 w-3.5" />
        Drop nodes here for a new subtree
        {subtrees.length ? "" : " — creates this node's first subtree"}
      </div>
      {!carry && (
        <Button size="sm" variant="outline" className="w-full" onClick={addSubtree}>
          <Plus className="mr-1 h-4 w-4" /> Add subtree
        </Button>
      )}
    </FieldGroup>
  );
}