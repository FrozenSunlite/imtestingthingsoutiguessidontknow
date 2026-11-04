import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { Plus, X } from "lucide-react";

// Conditional and second-rank rules that the sheet should surface but that do
// not reduce to a single resource value (advantage, resistance, triggered
// benefits). They appear in the character sheet's Passive Effects section.
export function NodePassivesSection({ node, set }) {
  const passives = node.passives || [];
  const patch = (index, value) => {
    const next = [...passives];
    next[index] = { ...next[index], ...value };
    set({ passives: next });
  };
  return (
    <div className="space-y-1">
      <InfoTip label="Conditional or second-rank effects. They appear on the character sheet once the node has at least the listed number of points.">
        <Label>Passive Effects</Label>
      </InfoTip>
      {passives.map((passive, index) => (
        <div key={index} className="space-y-1 rounded-md border p-2">
          <div className="flex items-center gap-1">
            <Input
              className="h-8 flex-1"
              placeholder="Effect name (e.g. Danger Sense)"
              value={passive.name || ""}
              onChange={(event) => patch(index, { name: event.target.value })}
            />
            <Input
              className="h-8 w-16"
              type="number"
              min={1}
              title="Minimum points invested"
              value={passive.minPoints ?? 1}
              onChange={(event) =>
                patch(index, { minPoints: Math.max(1, Number(event.target.value) || 1) })
              }
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => set({ passives: passives.filter((_, i) => i !== index) })}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            className="min-h-12 text-xs"
            placeholder="Concise rules text shown on the sheet"
            value={passive.description || ""}
            onChange={(event) => patch(index, { description: event.target.value })}
          />
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          set({
            passives: [
              ...passives,
              { name: "", minPoints: 1, description: "" },
            ],
          })
        }
      >
        <Plus className="mr-1 h-4 w-4" /> Add passive effect
      </Button>
    </div>
  );
}
