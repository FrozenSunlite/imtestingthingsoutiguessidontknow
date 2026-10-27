import { useTree } from "@/lib/treeStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TEXTAREAS = [
  ["traits", "Personality Traits"],
  ["ideals", "Ideals"],
  ["bonds", "Bonds"],
  ["flaws", "Flaws"],
  ["alliesOrganizations", "Allies & Organizations"],
  ["notes", "Notes"],
];

const APPEARANCE = [
  ["eyes", "Eyes"],
  ["skin", "Skin"],
  ["hair", "Hair"],
  ["height", "Height"],
  ["weight", "Weight"],
];

// Standard character-sheet boxes: appearance details, personality
// (traits/ideals/bonds/flaws), allies & organizations, backstory and notes.
export function SheetDetailsSection() {
  const { character, setCharacter } = useTree();
  const set = (patch) => setCharacter({ ...character, ...patch });
  const appearance = character.appearance || {};
  const setApp = (k, v) => set({ appearance: { ...appearance, [k]: v } });

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <Label className="text-xs font-medium">Appearance</Label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {APPEARANCE.map(([k, label]) => (
            <div key={k} className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground">{label}</Label>
              <Input
                className="h-8"
                value={appearance[k] || ""}
                onChange={(e) => setApp(k, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium">Personality</Label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {TEXTAREAS.slice(0, 4).map(([k, label]) => (
            <div key={k} className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground">{label}</Label>
              <Textarea
                className="min-h-[64px] text-xs"
                value={character[k] || ""}
                onChange={(e) => set({ [k]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-0.5">
        <Label className="text-[10px] text-muted-foreground">Allies & Organizations</Label>
        <Textarea
          className="min-h-[64px] text-xs"
          value={character.alliesOrganizations || ""}
          onChange={(e) => set({ alliesOrganizations: e.target.value })}
        />
      </div>

      <div className="space-y-0.5">
        <Label className="text-[10px] text-muted-foreground">Backstory</Label>
        <Textarea
          className="min-h-[120px] text-xs"
          value={character.backstory || ""}
          onChange={(e) => set({ backstory: e.target.value })}
        />
      </div>

      <div className="space-y-0.5">
        <Label className="text-[10px] text-muted-foreground">Notes</Label>
        <Textarea
          className="min-h-[80px] text-xs"
          value={character.notes || ""}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}