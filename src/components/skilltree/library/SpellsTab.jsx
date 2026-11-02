import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { matchesQuery } from "@/lib/textSearch";
import { benefitDragProps } from "@/lib/benefits";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, ChevronDown, Plus } from "lucide-react";
import { InfoTip } from "@/components/skilltree/InfoTip";

const LEVELS = [
  ["cantrip", "Cantrip"],
  ["1", "1st level"], ["2", "2nd level"], ["3", "3rd level"], ["4", "4th level"],
  ["5", "5th level"], ["6", "6th level"], ["7", "7th level"], ["8", "8th level"],
  ["9", "9th level"],
];

const DIE_SIZES = ["d4", "d6", "d8", "d10", "d12", "d20"];

const CASTING_TIMES = [
  "1 action",
  "1 bonus action",
  "1 reaction",
  "Free action",
  "1 minute",
  "10 minutes",
  "1 hour",
  "8 hours",
  "1 day",
];

const RANGES = [
  "Self",
  "Self (1-space radius)",
  "Self (2 spaces)",
  "Self (3 spaces)",
  "Touch",
  ...Array.from({ length: 30 }, (_, i) => `${i + 1} space${i ? "s" : ""}`),
  "60 spaces",
  "100 spaces",
  "1 mile",
];

const newSpell = () => ({
  name: "",
  level: "cantrip",
  school: "",
  subschool: "",
  repeats: "",
  castingTime: "",
  range: "",
  duration: "",
  saveType: "none",
  saveAbility: "",
  attackKind: "",
  attackMod: "spellcasting",
  attackAbility: "STR",
  targets: "",
  aoe: "",
  v: true,
  s: true,
  m: false,
  materialCost: "",
  materialItems: "",
  materialConsumed: false,
  aoeShape: "",
  aoeSize: "",
  aoeMeasure: "radius",
  upcast: "",
  upcastScaling: [],
  scaling: [],
  flavor: "",
});

const AOE_SHAPES = ["Cone", "Cube", "Cylinder", "Emanation", "Line", "Sphere"];
const ROUND_SHAPES = ["Sphere", "Cylinder", "Emanation"];

// Structured area-of-effect editor: standard D&D shapes, with a radius or
// diameter choice for round areas. Falls back to the free-text field when no
// standard shape is chosen.
function AoeEditor({ sp, patch }) {
  const round = ROUND_SHAPES.includes(sp.aoeShape || "");
  return (
    <div className="flex items-center gap-1">
      <Select
        value={sp.aoeShape || "__none__"}
        onValueChange={(v) => patch({ aoeShape: v === "__none__" ? "" : v })}
      >
        <InfoTip label="Standard area-of-effect shape — Cone, Cube, Cylinder, Emanation, Line or Sphere.">
          <SelectTrigger className="h-8 w-36">
            <SelectValue placeholder="AoE shape…" />
          </SelectTrigger>
        </InfoTip>
        <SelectContent>
          <SelectItem value="__none__">None</SelectItem>
          {AOE_SHAPES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {sp.aoeShape ? (
        <>
          <InfoTip label="Size of the area in spaces.">
            <Input
              className="h-8 w-16"
              type="number"
              min={1}
              placeholder="Spaces"
              value={sp.aoeSize ?? ""}
              onChange={(e) => patch({ aoeSize: e.target.value === "" ? "" : Number(e.target.value) || 0 })}
            />
          </InfoTip>
          {round && (
            <Select value={sp.aoeMeasure || "radius"} onValueChange={(v) => patch({ aoeMeasure: v })}>
              <InfoTip label="Measure round areas by radius or diameter.">
                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
              </InfoTip>
              <SelectContent>
                <SelectItem value="radius">Radius</SelectItem>
                <SelectItem value="diameter">Diameter</SelectItem>
              </SelectContent>
            </Select>
          )}
        </>
      ) : (
        <InfoTip label="Free-text area of effect — used when no standard shape is chosen.">
          <Input
            className="h-8 flex-1"
            placeholder="Area of effect (free text)"
            value={sp.aoe || ""}
            onChange={(e) => patch({ aoe: e.target.value })}
          />
        </InfoTip>
      )}
    </div>
  );
}

// One upcast threshold for leveled spells: what improves at a higher slot.
function UpcastEditor({ rows, onChange }) {
  const upd = (i, p) => {
    const next = [...(rows || [])];
    next[i] = { ...next[i], ...p };
    onChange(next);
  };
  return (
    <div className="col-span-2 space-y-1 rounded-md border p-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Upcast scaling (by slot level)
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            onChange([...(rows || []), { atSlot: 2, diceCount: "", dieSize: "", aoeSize: "", targets: "", repeats: "", effect: "" }])
          }
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {(rows || []).map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1">
          <InfoTip label="Slot level where this scaling kicks in.">
            <Input
              className="h-7 w-16"
              type="number"
              min={1}
              placeholder="Slot"
              value={r.atSlot ?? ""}
              onChange={(e) => upd(i, { atSlot: e.target.value === "" ? "" : Number(e.target.value) || 0 })}
            />
          </InfoTip>
          <InfoTip label="New number of dice at this slot — blank to leave unchanged.">
            <Input
              className="h-7 w-14"
              type="number"
              min={0}
              placeholder="Dice"
              value={r.diceCount ?? ""}
              onChange={(e) => upd(i, { diceCount: e.target.value === "" ? "" : Number(e.target.value) || 0 })}
            />
          </InfoTip>
          <Select value={r.dieSize || "__same__"} onValueChange={(v) => upd(i, { dieSize: v === "__same__" ? "" : v })}>
            <InfoTip label="New die size at this slot — leave as — to keep unchanged.">
              <SelectTrigger className="h-7 w-20">
                <SelectValue placeholder="Die" />
              </SelectTrigger>
            </InfoTip>
            <SelectContent>
              <SelectItem value="__same__">—</SelectItem>
              {DIE_SIZES.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <InfoTip label="How much larger the area gets, in spaces.">
            <Input
              className="h-7 w-20"
              type="number"
              min={0}
              placeholder="AoE +space"
              value={r.aoeSize ?? ""}
              onChange={(e) => upd(i, { aoeSize: e.target.value === "" ? "" : Number(e.target.value) || 0 })}
            />
          </InfoTip>
          <InfoTip label="New number of targets — blank to leave unchanged.">
            <Input
              className="h-7 w-20"
              placeholder="Targets"
              value={r.targets ?? ""}
              onChange={(e) => upd(i, { targets: e.target.value })}
            />
          </InfoTip>
          <InfoTip label="New repeats per cast — a number or a formula, e.g. prof.">
            <Input
              className="h-7 w-20"
              placeholder="Repeats"
              value={r.repeats ?? ""}
              onChange={(e) => upd(i, { repeats: e.target.value })}
            />
          </InfoTip>
          <InfoTip label="Any added effect at this slot.">
            <Input
              className="h-7 min-w-24 flex-1"
              placeholder="Added effect (optional)"
              value={r.effect || ""}
              onChange={(e) => upd(i, { effect: e.target.value })}
            />
          </InfoTip>
          <Button size="sm" variant="ghost" onClick={() => onChange((rows || []).filter((_, j) => j !== i))}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {(rows || []).length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          No rows yet — each row can raise dice, die size, area, targets or repeats at a higher slot.
        </p>
      )}
    </div>
  );
}

// One scaling threshold for cantrips: what changes at a character level.
function ScalingEditor({ rows, onChange }) {
  const upd = (i, p) => {
    const next = [...(rows || [])];
    next[i] = { ...next[i], ...p };
    onChange(next);
  };
  return (
    <div className="col-span-2 space-y-1 rounded-md border p-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Cantrip scaling (by character level)
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onChange([...(rows || []), { atLevel: 5, diceCount: "", dieSize: "", effect: "" }])}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {(rows || []).map((r, i) => (
        <div key={i} className="flex items-center gap-1">
          <InfoTip label="Character level where this scaling kicks in.">
            <Input
              className="h-7 w-16"
              type="number"
              min={1}
              placeholder="Level"
              value={r.atLevel ?? ""}
              onChange={(e) => upd(i, { atLevel: e.target.value === "" ? "" : Number(e.target.value) || 0 })}
            />
          </InfoTip>
          <InfoTip label="New number of dice at this level (e.g. 3) — blank to leave the count unchanged.">
            <Input
              className="h-7 w-14"
              type="number"
              min={0}
              placeholder="Dice"
              value={r.diceCount ?? ""}
              onChange={(e) => upd(i, { diceCount: e.target.value === "" ? "" : Number(e.target.value) || 0 })}
            />
          </InfoTip>
          <Select value={r.dieSize || "__same__"} onValueChange={(v) => upd(i, { dieSize: v === "__same__" ? "" : v })}>
            <InfoTip label="New die size at this level — leave as — to keep the size unchanged.">
              <SelectTrigger className="h-7 w-20">
                <SelectValue placeholder="Die" />
              </SelectTrigger>
            </InfoTip>
            <SelectContent>
              <SelectItem value="__same__">—</SelectItem>
              {DIE_SIZES.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <InfoTip label="Any added effect at this level.">
            <Input
              className="h-7 flex-1"
              placeholder="Added effect (optional)"
              value={r.effect || ""}
              onChange={(e) => upd(i, { effect: e.target.value })}
            />
          </InfoTip>
          <Button size="sm" variant="ghost" onClick={() => onChange((rows || []).filter((_, j) => j !== i))}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {(rows || []).length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          No thresholds yet — each row can raise the dice count, the die size, or
          both (e.g. "At level 5: 2d10 → 3d10" or "At level 5: d6 → d8").
        </p>
      )}
    </div>
  );
}

// Reference Library tab: the spell list the character sheet draws from when
// adding spells automatically, with full spell details.
export function SpellsTab() {
  const { settings, setSettings } = useTree();
  const spells = settings?.library?.spells || [];
  const setSpells = (next) =>
    setSettings((s) => ({ ...s, library: { ...s.library, spells: next } }));
  const [q, setQ] = useState("");
  const [open, setOpen] = useState({});

  const schools = settings?.library?.spellSchools || [];
  const subschools = settings?.library?.spellSubschools || [];

  const filtered = spells
    .map((sp, i) => ({ sp, i }))
    .filter(({ sp }) => matchesQuery(sp?.name, q));
  const add = () => setSpells([...spells, newSpell()]);
  const patch = (i, p) => {
    const next = [...spells];
    next[i] = { ...next[i], ...p };
    setSpells(next);
  };
  const remove = (i) => setSpells(spells.filter((_, j) => j !== i));

  return (
    <div className="space-y-2">
      <ListHeaderWrapper onAdd={add} query={q} setQuery={setQ} />
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {spells.length === 0 ? "Nothing added yet." : "No matches."}
        </p>
      ) : (
        filtered.map(({ sp, i }) => {
          const schoolOptions = [...new Set([...schools, ...(sp.school ? [sp.school] : [])])];
          const subOptions = [
            ...subschools.filter((s) => !s.parent || s.parent === sp.school),
            ...(sp.subschool ? [{ name: sp.subschool, parent: "" }] : []),
          ];
          const subNames = [...new Set(subOptions.map((s) => s.name).filter(Boolean))];
          return (
            <div
              key={i}
              {...benefitDragProps("spell", sp.name, {
                description: sp.description,
                image: sp.image,
              })}
              data-entry-name={sp.name ? String(sp.name) : ""}
              className="space-y-1.5 rounded-md border p-2"
            >
              <div className="flex items-center gap-1.5">
                <InfoTip label="The spell's name.">
                  <Input
                    className="h-8 flex-1"
                    placeholder="Spell name"
                    value={sp.name || ""}
                    onChange={(e) => patch(i, { name: e.target.value })}
                  />
                </InfoTip>
                <Select value={sp.level || "cantrip"} onValueChange={(v) => patch(i, { level: v })}>
                  <InfoTip label="Spell level, from cantrip to 9th.">
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                  </InfoTip>
                  <SelectContent>
                    {LEVELS.map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => remove(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <button
                  type="button"
                  data-entry-toggle={open[i] ? "open" : "closed"}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open[i] ? "" : "-rotate-90"}`} />
                  Details
                </button>
              </div>
              {sp.flavor && (
                <p className="line-clamp-1 pl-5 text-xs italic text-muted-foreground">{String(sp.flavor)}</p>
              )}
              {open[i] && (
                <div className="grid grid-cols-2 gap-1.5">
                  <Select value={sp.school || ""} onValueChange={(v) => patch(i, { school: v })}>
                    <InfoTip label="Magic school — edit schools in the Spell Schools tab.">
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="School…" />
                      </SelectTrigger>
                    </InfoTip>
                    <SelectContent>
                      {schoolOptions.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={sp.subschool || "__none__"}
                    onValueChange={(v) => patch(i, { subschool: v === "__none__" ? "" : v })}
                  >
                    <InfoTip label="Subschool (e.g. Dunamancy) — edit in the Spell Schools tab.">
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Subschool…" />
                      </SelectTrigger>
                    </InfoTip>
                    <SelectContent>
                      <SelectItem value="__none__">None (—)</SelectItem>
                      {subNames.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={sp.castingTime || "__none__"}
                    onValueChange={(v) =>
                      patch(i, { castingTime: v === "__none__" ? "" : v })
                    }
                  >
                    <InfoTip label="Casting time — Cast a Spell actions reference this, e.g. 1 action.">
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Casting time…" />
                      </SelectTrigger>
                    </InfoTip>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {CASTING_TIMES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sp.range || "__none__"} onValueChange={(v) => patch(i, { range: v === "__none__" ? "" : v })}>
                    <InfoTip label="Range - Self, a radius around you, Touch, or a distance in spaces.">
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Range…" />
                      </SelectTrigger>
                    </InfoTip>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {RANGES.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <InfoTip label="How long the spell lasts, e.g. Instantaneous or Concentration, up to 1 minute.">
                    <Input
                      className="h-8"
                      placeholder="Duration (e.g. Instantaneous)"
                      value={sp.duration || ""}
                      onChange={(e) => patch(i, { duration: e.target.value })}
                    />
                  </InfoTip>
                  <Select value={sp.saveType || "none"} onValueChange={(v) => patch(i, { saveType: v })}>
                    <InfoTip label="Does it require a saving throw or a spell attack roll?">
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    </InfoTip>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="save">Saving throw</SelectItem>
                      <SelectItem value="attack">Spell attack</SelectItem>
                    </SelectContent>
                  </Select>
                  {sp.saveType === "save" && (
                    <Select value={sp.saveAbility || ""} onValueChange={(v) => patch(i, { saveAbility: v })}>
                      <InfoTip label="Which ability the target saves with (uses your Spell Save DC).">
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Ability…" />
                        </SelectTrigger>
                      </InfoTip>
                      <SelectContent>
                        {["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                      </Select>
                      )}
                      <Select value={sp.attackKind || "__none__"} onValueChange={(v) => patch(i, { attackKind: v === "__none__" ? "" : v })}>
                      <InfoTip label="What kind of attack — a melee or ranged spell attack, or an attack made with an item.">
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Attack type…" />
                      </SelectTrigger>
                      </InfoTip>
                      <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      <SelectItem value="melee">Melee spell attack</SelectItem>
                      <SelectItem value="ranged">Ranged spell attack</SelectItem>
                      <SelectItem value="item">Uses an item</SelectItem>
                      </SelectContent>
                      </Select>
                      {sp.attackKind === "item" && (
                      <>
                      <Select value={sp.attackMod || "spellcasting"} onValueChange={(v) => patch(i, { attackMod: v })}>
                        <InfoTip label="Which modifier the attack uses — your spellcasting modifier, or the weapon's own modifier.">
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                        </InfoTip>
                        <SelectContent>
                          <SelectItem value="spellcasting">Spellcasting modifier</SelectItem>
                          <SelectItem value="weapon">Weapon's modifier</SelectItem>
                        </SelectContent>
                      </Select>
                      {sp.attackMod === "weapon" && (
                        <Select value={sp.attackAbility || "STR"} onValueChange={(v) => patch(i, { attackAbility: v })}>
                          <InfoTip label="STR by default — choose DEX when the weapon has finesse.">
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                          </InfoTip>
                          <SelectContent>
                            <SelectItem value="STR">STR</SelectItem>
                            <SelectItem value="DEX">DEX (finesse)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      </>
                      )}
                      <InfoTip label="How many creatures or objects it can target, e.g. 1 or Up to 3.">
                    <Input
                      className="h-8"
                      placeholder="Number of targets"
                      value={sp.targets ?? ""}
                      onChange={(e) => patch(i, { targets: e.target.value })}
                    />
                  </InfoTip>
                  <AoeEditor sp={sp} patch={(p) => patch(i, p)} />
                  <InfoTip label="Times it repeats per cast. A number or a formula using prof, level or a resource name — e.g. 3, prof, 1 + prof. Blank means 1.">
                    <Input
                      className="h-8"
                      placeholder="Repeats"
                      value={sp.repeats ?? ""}
                      onChange={(e) => patch(i, { repeats: e.target.value })}
                    />
                  </InfoTip>
                  <div className="col-span-2 flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs">
                      <InfoTip label="Requires a verbal component.">
                        <Checkbox checked={!!sp.v} onCheckedChange={(v) => patch(i, { v })} />
                      </InfoTip>
                      Verbal
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <InfoTip label="Requires a somatic component.">
                        <Checkbox checked={!!sp.s} onCheckedChange={(v) => patch(i, { s: v })} />
                      </InfoTip>
                      Somatic
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <InfoTip label="Requires a material component — configure its cost and items below.">
                        <Checkbox checked={!!sp.m} onCheckedChange={(v) => patch(i, { m: v })} />
                      </InfoTip>
                      Material
                    </label>
                  </div>
                  {sp.m && (
                    <>
                      <InfoTip label="Gold the material component costs; checked against the character's gold on cast.">
                        <Input
                          className="h-8"
                          type="number"
                          min={0}
                          placeholder="Material cost (gp)"
                          value={sp.materialCost ?? ""}
                          onChange={(e) => patch(i, { materialCost: e.target.value === "" ? "" : Number(e.target.value) || 0 })}
                        />
                      </InfoTip>
                      <InfoTip label="Named items required, comma separated — matched against inventory on cast.">
                        <Input
                          className="h-8"
                          placeholder="Required items (comma separated)"
                          value={sp.materialItems || ""}
                          onChange={(e) => patch(i, { materialItems: e.target.value })}
                        />
                      </InfoTip>
                      <label className="col-span-2 flex items-center gap-1.5 text-xs">
                        <InfoTip label="The items are consumed on cast and removed from inventory; lacking them blocks the spell unless developer mode is on.">
                          <Checkbox
                            checked={!!sp.materialConsumed}
                            onCheckedChange={(v) => patch(i, { materialConsumed: v })}
                          />
                        </InfoTip>
                        Consumed on use (removed from inventory)
                      </label>
                    </>
                  )}
                  {sp.image && (
                    <img
                      src={sp.image}
                      alt=""
                      loading="lazy"
                      className="col-span-2 max-h-40 rounded border bg-muted/20 object-contain"
                    />
                  )}
                  <InfoTip label="Artwork imported with the spell. Saved with the project.">
                    <Input
                      className="col-span-2 h-8"
                      placeholder="Image URL or /images/…"
                      value={sp.image || ""}
                      onChange={(e) => patch(i, { image: e.target.value })}
                    />
                  </InfoTip>
                  <InfoTip label="What the spell does — shown on the character sheet.">
                    <Textarea
                      className="col-span-2 min-h-16"
                      placeholder="Effect…"
                      value={sp.description || ""}
                      onChange={(e) => patch(i, { description: e.target.value })}
                    />
                  </InfoTip>
                  <InfoTip label="Flavor and lore for reading aloud — kept separate from the rules effect above, which is what the character sheet shows.">
                    <Textarea
                      className="col-span-2 min-h-12"
                      placeholder="Flavor (read-aloud lore)…"
                      value={sp.flavor || ""}
                      onChange={(e) => patch(i, { flavor: e.target.value })}
                    />
                  </InfoTip>
                  {sp.level === "cantrip" ? (
                    <ScalingEditor rows={sp.scaling} onChange={(next) => patch(i, { scaling: next })} />
                  ) : (
                    <>
                      <UpcastEditor rows={sp.upcastScaling} onChange={(next) => patch(i, { upcastScaling: next })} />
                      <InfoTip label="Extra note for higher-level casts — the scaling rows above cover dice, area, targets and repeats.">
                        <Textarea
                          className="col-span-2 min-h-16"
                          placeholder="Extra upcast note (optional)…"
                          value={sp.upcast || ""}
                          onChange={(e) => patch(i, { upcast: e.target.value })}
                        />
                      </InfoTip>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
      <p className="text-[10px] text-muted-foreground">
        The Spell List on the character sheet can add spells straight from this library.
      </p>
    </div>
  );
}

function ListHeaderWrapper({ onAdd, query, setQuery }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button size="sm" variant="outline" onClick={onAdd}>
        <Plus className="mr-1 h-4 w-4" /> Add spell
      </Button>
      <InfoTip label="Filter this list by name.">
        <Input
          className="h-8 w-48"
          placeholder="Search spells…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InfoTip>
    </div>
  );
}