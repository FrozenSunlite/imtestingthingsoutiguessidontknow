import { useTree } from "@/lib/treeStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, X } from "lucide-react";

const LISTS = [
  ["skills", "Skill Proficiencies"],
  ["tools", "Tool Proficiencies"],
  ["languages", "Languages"],
  ["instruments", "Musical Instruments"],
];

export function ProficienciesSection() {
  const { character, setCharacter, tree, updateNode } = useTree();
  const profs =
    character.proficiencies || { skills: [], tools: [], languages: [], instruments: [] };
  const setProfs = (next) => setCharacter({ ...character, proficiencies: next });
  const addItem = (key) =>
    setProfs({ ...profs, [key]: [...(profs[key] || []), { name: "", expertise: false, times: 1 }] });
  const patchItem = (key, i, patch) => {
    const arr = [...(profs[key] || [])];
    arr[i] = { ...arr[i], ...patch };
    setProfs({ ...profs, [key]: arr });
  };
  const removeItem = (key, i) =>
    setProfs({ ...profs, [key]: (profs[key] || []).filter((_, j) => j !== i) });

  return (
    <div className="space-y-2">
      <Label>Proficiencies & Languages</Label>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Each proficiency gain grants a Talent Point spendable only on that skill; the first
        unlock of a skill grants its first Mundane Talent. Expertise grants an extra point
        spendable on Mundane or Expertise Talents.
      </p>
      {/* "Proficiency of your choice" grants from unlocked nodes: type them here */}
      {(() => {
        const chosen = [];
        tree?.nodes.forEach((n) => {
          if ((n.currentPoints || 0) > 0)
            (n.proficiencies || []).forEach((p, pi) => {
              if (p.type === "choice") chosen.push({ node: n, pi });
            });
        });
        if (chosen.length === 0) return null;
        return (
          <div className="rounded-md border border-dashed p-2">
            <div className="text-xs font-medium">Proficiencies of your choice</div>
            <div className="mt-1 space-y-1">
              {chosen.map(({ node, pi }) => (
                <div key={node.id + pi} className="flex items-center gap-1">
                  <span
                    className="w-24 shrink-0 truncate text-[10px] text-muted-foreground"
                    title={node.name}
                  >
                    {node.name}
                  </span>
                  <Input
                    className="h-7 flex-1"
                    placeholder="Type the proficiency gained"
                    value={(node.choiceProficiencies || [])[pi] || ""}
                    onChange={(e) => {
                      const arr = [...(node.choiceProficiencies || [])];
                      arr[pi] = e.target.value;
                      updateNode(node.id, { choiceProficiencies: arr });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      {LISTS.map(([key, label]) => (
        <div key={key} className="rounded-md border p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">{label}</span>
            <Button size="sm" variant="ghost" onClick={() => addItem(key)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-1 space-y-1">
            {(profs[key] || []).map((p, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input
                  className="h-8 flex-1"
                  placeholder={key === "languages" ? "Language" : "Name"}
                  value={p.name || ""}
                  onChange={(e) => patchItem(key, i, { name: e.target.value })}
                />
                <input
                  type="number"
                  min={0}
                  title="Times proficiency gained"
                  value={p.times ?? 1}
                  onChange={(e) =>
                    patchItem(key, i, { times: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="h-8 w-12 rounded-md border bg-transparent px-1 text-center text-xs"
                />
                {key !== "languages" && (
                  <input
                    type="number"
                    title="Custom bonus to this check (added on top of ability + proficiency)"
                    value={p.bonus ?? 0}
                    onChange={(e) => patchItem(key, i, { bonus: Number(e.target.value) || 0 })}
                    className="h-8 w-12 rounded-md border bg-transparent px-1 text-center text-xs"
                  />
                )}
                <label
                  className="flex items-center gap-1 text-[10px] text-muted-foreground"
                  title="Expertise"
                >
                  <Switch
                    checked={!!p.expertise}
                    onCheckedChange={(v) => patchItem(key, i, { expertise: v })}
                  />
                  Exp
                </label>
                <Button size="sm" variant="ghost" onClick={() => removeItem(key, i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {(profs[key] || []).length === 0 && (
              <p className="text-xs text-muted-foreground">None yet.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}