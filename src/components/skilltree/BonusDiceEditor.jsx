import { cn } from "@/lib/utils";
import { checkOptions, STATS } from "@/lib/skills";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Plus, X } from "lucide-react";

const SPELL_LEVELS = [
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

// Targeting scopes offered per roll type.
const SCOPES = {
  attack: [
    ["all", "All attack rolls"],
    ["weapon", "Weapon…"],
  ],
  save: [
    ["all", "All saving throws"],
    ["ability", "Ability score"],
    ["spell", "Spell…"],
  ],
  check: [
    ["all", "All checks"],
    ["ability", "Ability score"],
    ["skill", "Skill"],
    ["tool", "Tool"],
    ["instrument", "Instrument"],
  ],
};

// A toggleable checkbox pill used to pick specific weapons or spells.
function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px]",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent"
      )}
    >
      <Check className={cn("h-3 w-3 shrink-0", !active && "opacity-30")} />
      {children}
    </button>
  );
}

// Weapon branch: match by category or property, then "all of this type"
// or checkmarks on the specific weapons that match.
function WeaponTarget({ value, onPatch, weapons, categories, properties }) {
  const by = value.by || "category";
  const matching =
    by === "category"
      ? weapons.filter((w) => (w.category || "") === (value.category || ""))
      : weapons.filter((w) => (w.properties || []).includes(value.property));
  const toggle = (name) => {
    const names = value.names || [];
    onPatch({ names: names.includes(name) ? names.filter((n) => n !== name) : [...names, name] });
  };
  return (
    <div className="space-y-1 rounded border bg-muted/30 p-1.5">
      <div className="flex items-center gap-1">
        <Select value={by} onValueChange={(v) => onPatch({ by: v, all: false, names: [] })}>
          <SelectTrigger className="h-7 w-28 shrink-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="category">By category</SelectItem>
            <SelectItem value="property">By property</SelectItem>
          </SelectContent>
        </Select>
        {by === "category" ? (
          <Select
            value={value.category || ""}
            onValueChange={(v) => onPatch({ category: v, all: false, names: [] })}
          >
            <SelectTrigger className="h-7 min-w-0 flex-1 text-xs">
              <SelectValue placeholder="Pick category…" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={value.property || ""}
            onValueChange={(v) => onPatch({ property: v, all: false, names: [] })}
          >
            <SelectTrigger className="h-7 min-w-0 flex-1 text-xs">
              <SelectValue placeholder="Pick property…" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {by === "category" && value.category && (
        <Pill active={!!value.all} onClick={() => onPatch({ all: !value.all })}>
          All {value.category} weapons
        </Pill>
      )}
      {by === "property" && value.property && (
        <Pill active={!!value.all} onClick={() => onPatch({ all: !value.all })}>
          All weapons with {value.property}
        </Pill>
      )}
      {!value.all && matching.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {matching.map((w) => (
            <Pill
              key={w.name}
              active={(value.names || []).includes(w.name)}
              onClick={() => toggle(w.name)}
            >
              {w.name}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}

// Spell branch: match by school or level, then "all of this type" or
// checkmarks on the specific spells that match.
function SpellTarget({ value, onPatch, spells, schools }) {
  const by = value.by || "school";
  const matching =
    by === "school"
      ? spells.filter((s) => (s.school || "") === (value.school || ""))
      : spells.filter((s) => (s.level || "cantrip") === (value.level || "cantrip"));
  const toggle = (name) => {
    const names = value.names || [];
    onPatch({ names: names.includes(name) ? names.filter((n) => n !== name) : [...names, name] });
  };
  return (
    <div className="space-y-1 rounded border bg-muted/30 p-1.5">
      <div className="flex items-center gap-1">
        <Select value={by} onValueChange={(v) => onPatch({ by: v, all: false, names: [] })}>
          <SelectTrigger className="h-7 w-28 shrink-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="school">By school</SelectItem>
            <SelectItem value="level">By level</SelectItem>
          </SelectContent>
        </Select>
        {by === "school" ? (
          <Select
            value={value.school || ""}
            onValueChange={(v) => onPatch({ school: v, all: false, names: [] })}
          >
            <SelectTrigger className="h-7 min-w-0 flex-1 text-xs">
              <SelectValue placeholder="Pick school…" />
            </SelectTrigger>
            <SelectContent>
              {schools.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={value.level || "cantrip"}
            onValueChange={(v) => onPatch({ level: v, all: false, names: [] })}
          >
            <SelectTrigger className="h-7 min-w-0 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPELL_LEVELS.map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {by === "school" && value.school && (
        <Pill active={!!value.all} onClick={() => onPatch({ all: !value.all })}>
          All {value.school} spells
        </Pill>
      )}
      {by === "level" && (
        <Pill active={!!value.all} onClick={() => onPatch({ all: !value.all })}>
          All {SPELL_LEVELS.find(([v]) => v === (value.level || "cantrip"))?.[1] || "these"} spells
        </Pill>
      )}
      {!value.all && matching.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {matching.map((s) => (
            <Pill
              key={s.name + (s.level || "")}
              active={(value.names || []).includes(s.name)}
              onClick={() => toggle(s.name)}
            >
              {s.name}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}

// Map an old compact target string onto the full targeting structure.
function convertLegacy(b) {
  const t = b.target || "attack";
  if (t === "attack") return { target: undefined, roll: "attack", scope: "all" };
  if (t.startsWith("save:"))
    return { target: undefined, roll: "save", scope: "ability", ability: t.slice(5) };
  if (t.startsWith("ability:"))
    return { target: undefined, roll: "check", scope: "ability", ability: t.slice(8) };
  const sep = t.indexOf(":");
  const group = sep > 0 ? t.slice(0, sep) : "";
  const name = sep > 0 ? t.slice(sep + 1) : "";
  if (group === "skill" || group === "tool" || group === "instrument") {
    return { target: undefined, roll: "check", scope: group, [group]: name };
  }
  return { target: undefined, roll: "attack", scope: "all" };
}

// Editor for a node's bonus-dice talents: pick the roll type (attack,
// saving throw or check), then narrow what it applies to — a weapon
// category (all of it or specific weapons by name/property), a spell
// (school or level), an ability score, a skill, tool or instrument.
export function BonusDiceEditor({ node, set, settings }) {
  const opts = checkOptions(settings);
  const lib = settings?.library || {};
  const weapons = (lib.weapons || []).filter((w) => w.name);
  const categories = (lib.weaponCategories || []).length
    ? lib.weaponCategories
    : ["Simple", "Martial", "Advanced", "Blaster", "Firearm"];
  const properties = (lib.properties || [])
    .map((p) => (typeof p === "string" ? p : p.name))
    .filter(Boolean);
  const spells = (lib.spells || []).filter((s) => s.name);
  const schools = [
    ...new Set([...(lib.spellSchools || []), ...spells.map((s) => s.school).filter(Boolean)]),
  ];
  const list = node.bonusDice || [];
  const setList = (arr) => set({ bonusDice: arr });
  const setB = (i, patch) => {
    const arr = [...list];
    arr[i] = { ...arr[i], ...patch };
    setList(arr);
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground">
        While this node has invested points, the listed dice are added to matching rolls in the
        dice roller.
      </p>
      {list.map((b, i) => {
        const legacy = b.target && !b.roll;
        const roll = b.roll || "attack";
        return (
          <div key={i} className="space-y-1 rounded-md border p-2">
            <div className="flex items-center gap-1">
              {legacy ? (
                <span
                  className="flex-1 truncate rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground"
                  title="Old-style target — convert to pick a roll type and scope"
                >
                  Legacy: {b.target}
                </span>
              ) : (
                <Select
                  value={roll}
                  onValueChange={(v) =>
                    setB(i, {
                      roll: v,
                      scope: "all",
                      weapon: undefined,
                      spell: undefined,
                      ability: undefined,
                      skill: undefined,
                      tool: undefined,
                      instrument: undefined,
                    })
                  }
                >
                  <SelectTrigger className="h-7 min-w-0 flex-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attack">Attack roll</SelectItem>
                    <SelectItem value="save">Saving throw</SelectItem>
                    <SelectItem value="check">Ability check</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Input
                className="h-7 w-20 shrink-0"
                placeholder="1d4"
                title="Dice added, e.g. 1d4"
                value={b.dice || ""}
                onChange={(e) => setB(i, { dice: e.target.value })}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 shrink-0 p-0"
                onClick={() => setList(list.filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {legacy ? (
              <Button size="sm" variant="outline" onClick={() => setB(i, convertLegacy(b))}>
                Convert to new targeting
              </Button>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <Select value={b.scope || "all"} onValueChange={(v) => setB(i, { scope: v })}>
                    <SelectTrigger className="h-7 min-w-0 flex-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(SCOPES[roll] || SCOPES.attack).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {b.scope === "ability" && (
                    <Select value={b.ability || "STR"} onValueChange={(v) => setB(i, { ability: v })}>
                      <SelectTrigger className="h-7 w-20 shrink-0 text-xs">
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
                  )}
                  {b.scope === "skill" && (
                    <Select
                      value={b.skill || opts.skills[0]?.name || ""}
                      onValueChange={(v) => setB(i, { skill: v })}
                    >
                      <SelectTrigger className="h-7 min-w-0 flex-1 text-xs">
                        <SelectValue placeholder="Pick skill…" />
                      </SelectTrigger>
                      <SelectContent>
                        {opts.skills.map((s) => (
                          <SelectItem key={s.name} value={s.name}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {b.scope === "tool" && (
                    <Select
                      value={b.tool || opts.tools[0]?.name || ""}
                      onValueChange={(v) => setB(i, { tool: v })}
                    >
                      <SelectTrigger className="h-7 min-w-0 flex-1 text-xs">
                        <SelectValue placeholder="Pick tool…" />
                      </SelectTrigger>
                      <SelectContent>
                        {opts.tools.map((s) => (
                          <SelectItem key={s.name} value={s.name}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {b.scope === "instrument" && (
                    <Select
                      value={b.instrument || opts.instruments[0]?.name || ""}
                      onValueChange={(v) => setB(i, { instrument: v })}
                    >
                      <SelectTrigger className="h-7 min-w-0 flex-1 text-xs">
                        <SelectValue placeholder="Pick instrument…" />
                      </SelectTrigger>
                      <SelectContent>
                        {opts.instruments.map((s) => (
                          <SelectItem key={s.name} value={s.name}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {b.scope === "weapon" && (
                  <WeaponTarget
                    value={b.weapon || {}}
                    onPatch={(w) => setB(i, { weapon: w })}
                    weapons={weapons}
                    categories={categories}
                    properties={properties}
                  />
                )}
                {b.scope === "spell" && (
                  <SpellTarget
                    value={b.spell || {}}
                    onPatch={(sp) => setB(i, { spell: sp })}
                    spells={spells}
                    schools={schools}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
      <Button
        size="sm"
        variant="outline"
        onClick={() => setList([...list, { dice: "1d4", roll: "attack", scope: "all" }])}
      >
        <Plus className="mr-1 h-4 w-4" /> Add bonus dice
      </Button>
    </div>
  );
}