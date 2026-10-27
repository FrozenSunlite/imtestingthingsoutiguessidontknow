import { useState } from "react";
import { useTree, aggregateResources, profBonusFor, statVars } from "@/lib/treeStore";
import { STATS, derivedSheet } from "@/lib/resources";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, X, ChevronDown } from "lucide-react";
import { SpellDetails } from "./SpellDetails";
import { SpellLibraryPicker } from "./SpellLibraryPicker";

const LEVELS = [
  ["cantrip", "Cantrip"],
  ["1", "1st level"],
  ["2", "2nd level"],
  ["3", "3rd level"],
  ["4", "4th level"],
  ["5", "5th level"],
  ["6", "6th level"],
  ["7", "7th level"],
  ["8", "8th level"],
  ["9", "9th level"],
];

export function SpellListSection() {
  const { mergedTree: tree, character, setCharacter, settings } = useTree();
  const spells = character.spellList || [];
  const levels = settings?.library?.levels || [];
  // Derived sheet values so every spell can show its auto-calculated save DC
  // and attack bonus (prof + casting-stat modifier, node contributions
  // included).
  const sheet = derivedSheet(
    character,
    tree,
    levels,
    aggregateResources(tree, character, levels),
    profBonusFor(character.level || 1, levels),
    statVars(character, tree),
    settings?.library
  );
  const libSpells = (settings?.library?.spells || []).filter((sp) => sp.name);
  const [open, setOpen] = useState({});
  // Collapsible level groups on the View sheet (undefined = expanded).
  const [lvlOpen, setLvlOpen] = useState({});
  // Every spell is filed under the spellcasting modifier chosen when it was
  // acquired; spells without one fall back to the character's default stat.
  const defaultStat = character.spellStat || "CHA";
  const statOf = (s) => s.spellStat || defaultStat;
  const [castStat, setCastStat] = useState(defaultStat);
  const presentStats = STATS.filter((st) => spells.some((s) => statOf(s) === st));
  const [statTab, setStatTab] = useState(null);
  const activeStat = presentStats.includes(statTab) ? statTab : presentStats[0];

  // Adding from the library copies the spell's full details (casting time,
  // components, save/attack, scaling…) so the sheet can show and use them.
  const addSpell = (name, level, src) =>
    setCharacter({
      ...character,
      spellList: [...spells, { ...(src || {}), name, level, spellStat: castStat }],
    });
  const removeSpell = (i) =>
    setCharacter({ ...character, spellList: spells.filter((_, j) => j !== i) });

  return (
    <div className="space-y-2">
      <Label>Spell List</Label>

      {spells.length > 0 && (
        <Tabs value={activeStat} onValueChange={setStatTab}>
          <TabsList className="h-8 w-full justify-start overflow-x-auto">
            {presentStats.map((st) => (
              <TabsTrigger key={st} value={st} className="px-2 text-xs">
                {st}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {activeStat &&
        LEVELS.map(([level, label]) => {
          const at = spells.filter((s) => statOf(s) === activeStat && (s.level || "cantrip") === level);
          if (at.length === 0) return null;
          return (
            <div key={level} className="rounded-md border p-2">
              <button
                className="flex w-full items-center gap-1 text-left"
                title="Collapse or expand this level"
                onClick={() => setLvlOpen((o) => ({ ...o, [level]: !(o[level] === false) }))}
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${lvlOpen[level] === false ? "-rotate-90" : ""}`}
                />
                <span className="flex-1 text-xs font-medium">{label}</span>
                <span className="text-[10px] text-muted-foreground">{at.length}</span>
              </button>
              {lvlOpen[level] !== false && (
              <div className="mt-1 space-y-1">
                {at.map((s) => {
                  const idx = spells.indexOf(s);
                  return (
                    <div key={s.name + s.level + idx}>
                      <div className="flex items-center gap-1">
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          title="Toggle details"
                          onClick={() => setOpen((o) => ({ ...o, [idx]: !o[idx] }))}
                        >
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${open[idx] ? "" : "-rotate-90"}`}
                          />
                        </button>
                        <span className="flex-1 truncate text-xs">
                          {s.name}
                          {s.repeats ? ` ×${s.repeats}` : ""}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeSpell(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {open[idx] && (
                        <SpellDetails spell={s} character={character} sheet={sheet} />
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          );
        })}

      <div className="flex items-center gap-2">
        <Label className="text-[10px] text-muted-foreground">
          Casting modifier for new spells
        </Label>
        <Select value={castStat} onValueChange={setCastStat}>
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {libSpells.length > 0 && (
        <SpellLibraryPicker
          spells={libSpells}
          onPick={(sp) => addSpell(sp.name, sp.level || "cantrip", sp)}
        />
      )}
      <AddSpellRow onAdd={addSpell} />
      {spells.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No spells yet — add cantrips and leveled spells above.
        </p>
      )}
    </div>
  );
}

function AddSpellRow({ onAdd }) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState("cantrip");
  return (
    <div className="flex items-center gap-1">
      <Input
        className="h-8 flex-1"
        placeholder="Spell name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            onAdd(name.trim(), level);
            setName("");
          }
        }}
      />
      <Select value={level} onValueChange={setLevel}>
        <SelectTrigger className="h-8 w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LEVELS.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          if (!name.trim()) return;
          onAdd(name.trim(), level);
          setName("");
        }}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}