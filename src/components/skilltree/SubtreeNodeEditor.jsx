import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AbilityReqEditor } from "@/components/skilltree/AbilityReqEditor";
import { ProficienciesEditor } from "@/components/skilltree/ProficienciesEditor";
import { BonusDiceEditor } from "@/components/skilltree/BonusDiceEditor";
import { NodeActionsSection } from "@/components/skilltree/NodeActionsSection";
import { NodeResourcesSection } from "@/components/skilltree/NodeResourcesSection";

// Compact editors for one node inside a subtree's node list: the effect
// fields a play session needs most, without opening the full subtree editor.
export function SubtreeNodeEditor({ node, set, settings }) {
  return (
    <div className="mt-1.5 space-y-2 rounded-md border bg-muted/40 p-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px]">Cost</Label>
          <Input
            className="h-7"
            type="number"
            min={0}
            value={node.cost ?? 1}
            onChange={(e) => set({ cost: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Max points</Label>
          <Input
            className="h-7"
            type="number"
            min={0}
            value={node.maxPoints}
            onChange={(e) => set({ maxPoints: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
      </div>
      <AbilityReqEditor
        reqs={node.abilityReqs || []}
        onChange={(abilityReqs) => set({ abilityReqs })}
        label="Ability requirement"
        compact
      />
      <ProficienciesEditor node={node} set={set} />
      <BonusDiceEditor node={node} set={set} settings={settings} />
      <NodeActionsSection node={node} set={set} />
      <NodeResourcesSection node={node} set={set} />
    </div>
  );
}