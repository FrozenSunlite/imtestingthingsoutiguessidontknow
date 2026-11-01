import { useState } from "react";
import { useTree, aggregateResources, statVars, profBonusFor } from "@/lib/treeStore";
import { derivedSheet, numericResourceMap, sanitizeKey, STATS } from "@/lib/resources";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";

// A calculator inside a save DC: a flat number, an ability modifier, a skill
// modifier, or the numeric value of a resource granted by a node — or nothing.
const KINDS = [
  ["none", "Nothing"],
  ["flat", "Flat number"],
  ["stat", "Ability modifier"],
  ["skill", "Skill modifier"],
  ["prof", "Proficiency bonus"],
  ["resource", "Resource value"],
];

const blankPart = () => ({ kind: "none", value: "" });

export function SaveDCsSection() {
  const { mergedTree: tree, character, setCharacter, settings } = useTree();
  const [adding, setAdding] = useState(false);
  const levels = settings?.library?.levels || [];
  const stats = statVars(character, tree);
  const aggregated = aggregateResources(tree, character, levels);
  const sheet = derivedSheet(
    character,
    tree,
    levels,
    aggregated,
    profBonusFor(character.level || 1, levels),
    stats,
    settings?.library
  );
  const resNums = numericResourceMap(aggregated);
  const profBonus = profBonusFor(character.level || 1, levels);
  const skills = (settings?.library?.lists?.skills || []).filter((s) => s?.name);

  const mod = (s) => Math.floor(((sheet[s]?.final ?? 10) - 10) / 2);
  const skillMod = (name) => {
    const sk = skills.find(
      (s) => String(s.name).toLowerCase() === String(name).toLowerCase()
    );
    if (!sk) return 0;
    let m = mod(sk.ability || "DEX");
    if ((character.proficiencies?.skills || []).some(
      (p) => String(p?.name || "").toLowerCase() === String(name).toLowerCase()
    ))
      m += profBonus;
    return m;
  };

  const list = character.saveDCs || [];
  const setList = (next) => setCharacter({ ...character, saveDCs: next });
  const patch = (i, p) => {
    const next = [...list];
    next[i] = { ...next[i], ...p };
    setList(next);
  };

  const partValue = (part) => {
    if (!part || part.kind === "none") return 0;
    if (part.kind === "flat") return Number(part.value) || 0;
    if (part.kind === "stat") return mod(part.value) || 0;
    if (part.kind === "skill") return skillMod(part.value);
    if (part.kind === "prof") return profBonus;
    if (part.kind === "resource") return Number(resNums[sanitizeKey(part.value)]) || 0;
    return 0;
  };

  const partEditor = (entry, pi, part, onPart) => (
    <div key={pi} className="flex items-center gap-1">
      <Select value={part.kind || "none"} onValueChange={(v) => onPart({ kind: v, value: "" })}>
        <SelectTrigger className="h-7 w-32 shrink-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {KINDS.map(([k, label]) => (
            <SelectItem key={k} value={k}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {part.kind === "flat" && (
        <Input
          type="number"
          className="h-7 flex-1"
          placeholder="Number"
          value={part.value ?? ""}
          onChange={(e) => onPart({ value: e.target.value })}
        />
      )}
      {part.kind === "stat" && (
        <Select value={part.value || "__"} onValueChange={(v) => onPart({ value: v })}>
          <SelectTrigger className="h-7 flex-1">
            <SelectValue placeholder="Ability…" />
          </SelectTrigger>
          <SelectContent>
            {STATS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {part.kind === "skill" && (
        <Select value={part.value || "__"} onValueChange={(v) => onPart({ value: v })}>
          <SelectTrigger className="h-7 flex-1">
            <SelectValue placeholder="Skill…" />
          </SelectTrigger>
          <SelectContent>
            {skills.map((s) => (
              <SelectItem key={s.name} value={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {part.kind === "resource" && (
        <Input
          className="h-7 flex-1"
          placeholder="Resource name (e.g. Hexblade's Curse)"
          value={part.value ?? ""}
          onChange={(e) => onPart({ value: e.target.value })}
        />
      )}
      {part.kind !== "none" && (
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {partValue(part) >= 0 ? "+" : ""}
          {partValue(part)}
        </span>
      )}
    </div>
  );

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Save DCs
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setList([...list, { name: "", parts: [blankPart(), blankPart(), blankPart()] }]);
            setAdding(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add save DC
        </Button>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Spellcasting save DC:{" "}
        <span className="font-semibold text-foreground">
          {Math.round(sheet["Save DCs"]?.final ?? 8 + profBonus + mod(character.spellStat || "CHA"))}
        </span>{" "}
        (8 + proficiency + {character.spellStat || "CHA"}).
      </p>
      {list.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Custom saving throw DCs — each sums up to three calculators: a flat number, an
          ability modifier, a skill modifier or a resource value granted by a node. Leave any
          calculator as "Nothing".
        </p>
      )}
      <div className={adding ? "space-y-2" : "grid gap-2 sm:grid-cols-2"}>
        {list.map((entry, i) => {
          const total = (entry.parts || []).reduce((a, p) => a + partValue(p), 0);
          return (
            <div key={i} className="space-y-1.5 rounded-xl border bg-accent/40 p-3">
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 flex-1"
                  placeholder="Save name (e.g. Hexblade's Curse)"
                  value={entry.name || ""}
                  onChange={(e) => patch(i, { name: e.target.value })}
                />
                <div className="shrink-0 text-right">
                  <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                    DC
                  </div>
                  <div className="text-lg font-bold leading-tight">{total}</div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setList(list.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {(entry.parts || []).map((part, pi) =>
                partEditor(
                  entry,
                  pi,
                  part,
                  (p) => {
                    const parts = [...entry.parts];
                    parts[pi] = { ...part, ...p };
                    patch(i, { parts });
                  }
                )
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}