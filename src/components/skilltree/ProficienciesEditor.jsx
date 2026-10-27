import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { FieldGroup } from "@/components/skilltree/FieldGroup";
import { X } from "lucide-react";

// Proficiencies a node grants each time a point is invested (refunds remove
// them). Extracted so subtree-node mini editors can reuse it.
export function ProficienciesEditor({ node, set }) {
  return (
    <FieldGroup label="Granted Proficiencies">
      <InfoTip label="Proficiencies granted each time a point is invested in this node; refunds remove them.">
        <Label>Proficiencies</Label>
      </InfoTip>
      {(node.proficiencies || []).map((p, i) => {
        const patch = (up) => {
          const proficiencies = [...node.proficiencies];
          proficiencies[i] = { ...p, ...up };
          set({ proficiencies });
        };
        const listId =
          p.type === "tool"
            ? "lib-tools"
            : p.type === "instrument"
            ? "lib-instruments"
            : p.type === "weapon"
            ? "lib-weapons"
            : p.type === "armor"
            ? "lib-armor"
            : "lib-skills";
        const isSave = p.type === "savingThrow";
        return (
          <div key={i} className="space-y-1.5 rounded-md border p-2">
            <div className="flex items-center gap-1">
              <Select value={p.type || "skill"} onValueChange={(v) => patch({ type: v })}>
                <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="skill">Skill</SelectItem>
                  <SelectItem value="weapon">Weapon proficiency</SelectItem>
                  <SelectItem value="armor">Armor proficiency</SelectItem>
                  <SelectItem value="tool">Tool</SelectItem>
                  <SelectItem value="instrument">Musical instrument</SelectItem>
                  <SelectItem value="language">Language</SelectItem>
                  <SelectItem value="savingThrow">Saving throw</SelectItem>
                  <SelectItem value="choice">Proficiency of your choice</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  set({ proficiencies: node.proficiencies.filter((_, j) => j !== i) })
                }
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {isSave ? (
              <Select value={p.name || "STR"} onValueChange={(v) => patch({ name: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((s) => (
                    <SelectItem key={s} value={s}>{s} saving throw</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="h-8"
                list={listId}
                placeholder={
                  p.type === "choice"
                    ? "Describe the choice (e.g. any skill)"
                    : `What ${p.type || "skill"} it grants`
                }
                value={p.name || ""}
                onChange={(e) => patch({ name: e.target.value })}
              />
            )}
            {p.type === "choice" && (
              <p className="text-[10px] text-muted-foreground">
                The actual proficiency is typed on the character sheet once this node is unlocked.
              </p>
            )}
            {isSave ? (
              <p className="text-[10px] text-muted-foreground">
                The sheet marks that saving throw as proficient while this node is invested.
              </p>
            ) : (
              <label className="flex items-center gap-1.5 text-xs">
                <Switch
                  checked={!!p.expertise}
                  onCheckedChange={(v) => patch({ expertise: v })}
                />
                Grants Expertise
              </label>
            )}
          </div>
        );
      })}
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          set({
            proficiencies: [...(node.proficiencies || []), { type: "skill", name: "", expertise: false }],
          })
        }
      >
        Add proficiency
      </Button>
    </FieldGroup>
  );
}