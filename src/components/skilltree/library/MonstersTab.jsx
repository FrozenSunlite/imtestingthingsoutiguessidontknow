import { useRef, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { EmptyNote } from "./shared";
import { matchesQuery } from "@/lib/textSearch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Plus, X, ArrowUpDown, UserPlus, FileUp } from "lucide-react";
import { monsterToStatblock } from "@/components/skilltree/FamiliarTab";
import { ImageField } from "@/components/skilltree/ImageField";
import { feetToSpacesText } from "@/lib/resources";
import { speedEntries, speedTextFromEntries } from "@/lib/monsterSpeeds";
import { importMonsterPayload } from "@/lib/monsterImport";
import { toast } from "sonner";

// Reference Library tab: a log of monsters. Each entry is a full statblock
// (sorted by name, CR, type, alignment…), can carry inventory — a weapon adds
// an attack to its actions, armor with an AC replaces its AC — and can have
// Templates applied: named bundles of modifiers (spellcasting, extra actions,
// legendary resistances…) defined in the tab's template section.

const BLANK = {
  name: "", image: "", size: "", type: "", category: "", tags: [], source: "", alignment: "", cr: "", description: "", flavor: "",
  ac: "", hp: "", speed: "", speeds: [], abilities: "", senses: "", languages: "",
  saves: "", skills: "", damageVulnerabilities: "", damageResistances: "", damageImmunities: "",
  conditionImmunities: "", initiative: "", proficiencyBonus: "", xp: "", gear: "", spellcasting: "",
  unique: false, dungeonExempt: false,
  traits: [], actions: [], bonusActions: [], reactions: [], legendaryActions: [], lairActions: [], mythicActions: [],
  proficiencies: [], inventory: [], templates: [],
};
const BLANK_TEMPLATE = {
  name: "", description: "", acBonus: "", hpBonus: "", spellcasting: "",
  legendaryResistances: "", traits: [], actions: [],
};

const SORTS = [
  ["name", "Name"], ["cr", "CR"], ["type", "Type"],
  ["alignment", "Alignment"], ["size", "Size"], ["hp", "HP"],
];

// "1/2" → 0.5 for CR sorting; unknowns sort last.
const crNum = (cr) => {
  const s = String(cr ?? "").trim();
  if (s === "1/8") return 0.125;
  if (s === "1/4") return 0.25;
  if (s === "1/2") return 0.5;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
};

// Ability scores are stored as a "STR 18, DEX 11, …" string; parse it into
// per-ability numbers so they edit like the Familiar page's boxes.
const ABILITY_KEYS = [["str", "STR"], ["dex", "DEX"], ["con", "CON"], ["int", "INT"], ["wis", "WIS"], ["cha", "CHA"]];
const parseAbilities = (s) => {
  const out = {};
  String(s || "").split(",").forEach((part) => {
    const m = part.trim().match(/^(STR|DEX|CON|INT|WIS|CHA)\s*[:=]?\s*(-?\d+)/i);
    if (m) out[m[1].toLowerCase()] = Number(m[2]);
  });
  return out;
};
const serializeAbilities = (scores) =>
  ABILITY_KEYS.map(([k, l]) => `${l} ${scores[k] ?? 10}`).join(", ");
const modifier = (score) => {
  const m = Math.floor(((Number(score) || 10) - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
};

// Ability score boxes with auto-calculated modifiers, Familiar-page style.
function AbilityBlock({ m, patch }) {
  const scores = parseAbilities(m.abilities);
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
      {ABILITY_KEYS.map(([k, lbl]) => (
        <div key={k} className="rounded-md border border-destructive/40 p-2 text-center">
          <Label className="text-[10px] font-bold tracking-wider text-muted-foreground">{lbl}</Label>
          <Input
            className="mt-1 h-8 text-center"
            type="number"
            value={scores[k] ?? 10}
            onChange={(e) => patch({ abilities: serializeAbilities({ ...scores, [k]: Number(e.target.value) || 0 }) })}
          />
          <span className="text-xs font-semibold text-destructive">{modifier(scores[k] ?? 10)}</span>
        </div>
      ))}
    </div>
  );
}

// An inventory item resolves to an attack (weapon) or an AC (armor). Manual
// fields win; otherwise a matching library weapon/armor fills in the numbers.
function resolveItem(item, lib) {
  if (!item) return null;
  if (item.kind === "weapon") {
    let dmg = (item.damage || "").trim();
    if (!dmg) {
      const w = (lib.weapons || []).find(
        (x) => (x.name || "").toLowerCase() === (item.name || "").toLowerCase()
      );
      if (w) dmg = `${w.diceCount || 1}${w.dieSize || "d6"}${w.damageType ? ` ${w.damageType}` : ""}`;
    }
    return { attack: `${item.name}${dmg ? ` — ${dmg}` : ""}` };
  }
  if (item.kind === "armor") {
    let ac = String(item.ac ?? "").trim();
    if (!ac) {
      const a = (lib.armor || []).find(
        (x) => (x.name || "").toLowerCase() === (item.name || "").toLowerCase()
      );
      if (a) ac = String(a.ac || "");
    }
    return ac ? { ac } : null;
  }
  return null;
}

// Effective statblock: base stats, then armor AC, then every applied template.
function computed(m, lib) {
  const tpls = (m.templates || [])
    .map((n) => (lib.monsterTemplates || []).find((t) => t.name === n))
    .filter(Boolean);
  const armor = (m.inventory || [])
    .map((i) => resolveItem(i, lib))
    .find((r) => r?.ac);
  const acBonus = tpls.reduce((s, t) => s + (Number(t.acBonus) || 0), 0);
  const baseAc = String(armor?.ac ?? m.ac ?? "").trim();
  const ac = baseAc && Number.isFinite(Number(baseAc))
    ? String(Number(baseAc) + acBonus)
    : `${baseAc}${acBonus ? ` +${acBonus}` : ""}`.trim();
  const hpBonus = tpls.reduce((s, t) => s + (Number(t.hpBonus) || 0), 0);
  const baseHp = Number(m.hp);
  const hp = Number.isFinite(baseHp) && hpBonus ? baseHp + hpBonus : m.hp;
  const attacks = (m.inventory || [])
    .map((i) => resolveItem(i, lib))
    .filter((r) => r?.attack)
    .map((r) => ({ name: r.attack, text: "From inventory." }));
  const lr = Math.max(0, ...tpls.map((t) => Number(t.legendaryResistances) || 0));
  return {
    tpls,
    ac,
    hp,
    spellcasting: tpls.map((t) => t.spellcasting).filter(Boolean).join(" "),
    legendary: lr,
    actions: [...(m.actions || []), ...attacks, ...tpls.flatMap((t) => t.actions || [])],
    traits: [...(m.traits || []), ...tpls.flatMap((t) => t.traits || [])],
  };
}

// A repeatable name + text list (traits, actions…), portioned like the
// Familiar page's entry lists.
function MiniList({ label, items, onChange }) {
  return (
    <div className="space-y-1 rounded-md border p-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <Button size="sm" variant="ghost" onClick={() => onChange([...(items || []), { name: "", text: "" }])}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {(items || []).map((it, i) => (
        <div key={i} className="flex items-start gap-1">
          <Input
            className="h-8 w-32 shrink-0"
            placeholder="Name"
            value={it.name || ""}
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...it, name: e.target.value };
              onChange(next);
            }}
          />
          <Textarea
            className="min-h-8 flex-1"
            rows={1}
            placeholder="Text"
            value={it.text || ""}
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...it, text: e.target.value };
              onChange(next);
            }}
          />
          <Button size="sm" variant="ghost" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, className, list }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input className={`h-8 ${className || ""}`} list={list} placeholder={placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// One monster entry: summary line with the effective stats, expandable editor.
function MonsterRow({ m, i: _i, onPatch, onDelete, onImport, lib }) {
  const [open, setOpen] = useState(false);
  const eff = computed(m, lib);
  const patch = onPatch;
  const weaponNames = (lib.weapons || []).map((w) => w.name).filter(Boolean);
  const armorNames = (lib.armor || []).map((a) => a.name).filter(Boolean);
  const summary = [m.size, m.type].filter(Boolean).map(String).join(" ");
  const movement = Array.isArray(m.speeds) && m.speeds.length ? m.speeds : speedEntries(m.speed);
  const speedTypeOptions = [
    ...new Set([
      "Standard",
      ...(lib.speedTypes || []).map((s) => s?.name || s).filter(Boolean),
      ...movement.map((e) => e.type).filter(Boolean),
    ]),
  ];
  const setMovement = (next) =>
    patch({ speeds: next, speed: speedTextFromEntries(next) });
  return (
    <div className="rounded-md border p-2" data-entry-name={m.name ? String(m.name) : ""}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-entry-toggle={open ? "open" : "closed"}
          onClick={() => setOpen(!open)}
          className="shrink-0"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {m.image && (
          <img
            src={m.image}
            alt=""
            className="h-9 w-9 shrink-0 rounded border object-cover"
            style={{ imageRendering: "pixelated" }}
          />
        )}
        <Input
          className="h-8 flex-1 font-semibold"
          placeholder="Monster name"
          value={m.name || ""}
          onChange={(e) => patch({ name: e.target.value })}
        />
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
          {summary && `${summary} · `}
          {m.cr ? `CR ${m.cr}` : "CR —"}
        </span>
        {m.unique && (
          <span className="shrink-0 rounded bg-amber-500/15 px-1 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
            Unique
          </span>
        )}
        {m.dungeonExempt && (
          <span className="shrink-0 rounded bg-muted px-1 text-[9px] font-semibold text-muted-foreground">
            Exempt
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0"
          title="Import to the character sheet's Familiar tab"
          onClick={onImport}
        >
          <UserPlus className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" className="shrink-0" onClick={onDelete}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {!!(m.description || m.alignment || eff.ac || eff.hp || eff.spellcasting || eff.legendary > 0) && (
        <div className="mt-1 space-y-0.5 px-5 text-xs text-muted-foreground">
          {m.alignment && <p>Alignment: {String(m.alignment)}</p>}
          {(eff.ac || eff.hp) && (
            <p>
              AC {eff.ac || "—"}
              {armorSource(m, lib) ? ` (${armorSource(m, lib)})` : ""} · HP {eff.hp || "—"}
              {eff.legendary ? ` · Legendary Resistances ${eff.legendary}/day` : ""}
            </p>
          )}
          {eff.spellcasting && <p>Spellcasting: {eff.spellcasting}</p>}
          {m.description && <p className="line-clamp-2">{String(m.description)}</p>}
          {m.flavor && <p className="line-clamp-2 italic">{String(m.flavor)}</p>}
        </div>
      )}
      {open && (
        <div className="mt-2 space-y-2">
          {/* Statblock header: identity + defense, portioned like the Familiar page */}
          <div className="rounded-md border border-destructive/40 p-2">
            <ImageField
              label="Artwork"
              value={m.image || ""}
              onChange={(v) => patch({ image: v })}
              previewClass="h-28 w-28"
              info="Shown on the monster row here and carried into the familiar when imported."
            />
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <Field label="Size" value={m.size} onChange={(v) => patch({ size: v })} placeholder="Huge" />
              <Field label="Type" value={m.type} onChange={(v) => patch({ type: v })} placeholder="Beast" />
              <Field label="Alignment" value={m.alignment} onChange={(v) => patch({ alignment: v })} placeholder="Unaligned" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Field label="AC" value={m.ac} onChange={(v) => patch({ ac: v })} placeholder="13" />
              <Field label="HP" value={m.hp} onChange={(v) => patch({ hp: v })} placeholder="45" />
            </div>
            <div className="mt-2 space-y-1 rounded-md border p-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Movement
                </Label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() =>
                    setMovement([
                      ...movement,
                      {
                        type: speedTypeOptions.find((t) => !movement.some((e) => e.type === t)) || "Standard",
                        spaces: 6,
                      },
                    ])
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add movement
                </Button>
              </div>
              {movement.length === 0 && (
                <p className="text-[10px] text-muted-foreground">
                  No movement set. Add a speed type from the Reference Library.
                </p>
              )}
              {movement.map((row, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <Select
                    value={row.type || "Standard"}
                    onValueChange={(v) =>
                      setMovement(movement.map((r, j) => (j === idx ? { ...r, type: v } : r)))
                    }
                  >
                    <SelectTrigger className="h-8 min-w-0 flex-1 text-xs">
                      <SelectValue placeholder="Speed Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {speedTypeOptions.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-8 w-20 text-center"
                    type="number"
                    min={0}
                    step={0.5}
                    value={row.spaces ?? 0}
                    onChange={(e) =>
                      setMovement(
                        movement.map((r, j) =>
                          j === idx ? { ...r, spaces: Math.max(0, Number(e.target.value) || 0) } : r
                        )
                      )
                    }
                  />
                  <span className="text-[10px] text-muted-foreground">spaces</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => setMovement(movement.filter((_, j) => j !== idx))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Ability scores with auto-calculated modifiers */}
          <AbilityBlock m={m} patch={patch} />

          <div className="grid grid-cols-3 gap-1.5">
            <Field label="CR" value={m.cr} onChange={(v) => patch({ cr: v })} placeholder="1/2" />
            <Field label="Senses" value={feetToSpacesText(m.senses) || ""} onChange={(v) => patch({ senses: v })} placeholder="Darkvision 12 spaces" />
            <Field label="Languages" value={m.languages} onChange={(v) => patch({ languages: v })} placeholder="—" />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <Field label="Category" value={m.category} onChange={(v) => patch({ category: v })} placeholder="Undead, Goblinoid, Boss…" />
            <Field
              label="Tags (comma-separated)"
              value={(m.tags || []).join(", ")}
              onChange={(v) => patch({ tags: v.split(",").map((t) => t.trim()).filter(Boolean) })}
              placeholder="undead, minion, flying"
              list="monster-tags"
            />
            <Field label="Source" value={m.source} onChange={(v) => patch({ source: v })} placeholder="MM 2014 / MM 2024" />
          </div>
          <div className="grid gap-1.5 rounded border p-2 sm:grid-cols-2">
            <label className="flex items-start justify-between gap-2 text-xs">
              <span>
                <span className="font-medium">Unique</span>
                <span className="block text-[10px] text-muted-foreground">
                  Only one may exist, and only as an Elite (Mini Boss) or Boss.
                </span>
              </span>
              <Switch
                checked={!!m.unique}
                onCheckedChange={(v) => patch({ unique: v })}
              />
            </label>
            <label className="flex items-start justify-between gap-2 text-xs">
              <span>
                <span className="font-medium">Exempt</span>
                <span className="block text-[10px] text-muted-foreground">
                  Blacklisted from automatic dungeon placement.
                </span>
              </span>
              <Switch
                checked={!!m.dungeonExempt}
                onCheckedChange={(v) => patch({ dungeonExempt: v })}
              />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <Field label="Initiative" value={m.initiative} onChange={(v) => patch({ initiative: v })} placeholder="+2" />
            <Field label="Prof. Bonus" value={m.proficiencyBonus} onChange={(v) => patch({ proficiencyBonus: v })} placeholder="+2" />
            <Field label="XP" value={m.xp} onChange={(v) => patch({ xp: v })} placeholder="50" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Saving Throws" value={m.saves} onChange={(v) => patch({ saves: v })} placeholder="DEX +4, CON +2" />
            <Field label="Skills" value={m.skills} onChange={(v) => patch({ skills: v })} placeholder="Perception +4, Stealth +6" />
            <Field label="Damage Vulnerabilities" value={m.damageVulnerabilities} onChange={(v) => patch({ damageVulnerabilities: v })} placeholder="Radiant" />
            <Field label="Damage Resistances" value={m.damageResistances} onChange={(v) => patch({ damageResistances: v })} placeholder="Cold, fire" />
            <Field label="Damage Immunities" value={m.damageImmunities} onChange={(v) => patch({ damageImmunities: v })} placeholder="Poison" />
            <Field label="Condition Immunities" value={m.conditionImmunities} onChange={(v) => patch({ conditionImmunities: v })} placeholder="Charmed, frightened" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Spellcasting / innate spells</Label>
            <Textarea
              className="min-h-12 text-xs"
              rows={2}
              placeholder="Innate spellcasting, spell save DC, slots…"
              value={m.spellcasting || ""}
              onChange={(e) => patch({ spellcasting: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Gear / equipment</Label>
            <Textarea
              className="min-h-10 text-xs"
              rows={2}
              placeholder="Weapons, armor, carried items…"
              value={m.gear || ""}
              onChange={(e) => patch({ gear: e.target.value })}
            />
          </div>
          <Textarea
            className="min-h-12 text-xs"
            placeholder="Description (statblock flavor)…"
            value={m.description || ""}
            onChange={(e) => patch({ description: e.target.value })}
          />
          <Textarea
            className="min-h-12 text-xs"
            placeholder="Flavor text — read-aloud lore for the table, kept out of the statblock…"
            value={m.flavor || ""}
            onChange={(e) => patch({ flavor: e.target.value })}
          />

          {/* Templates: named modifier bundles, defined below the list. */}
          <div className="rounded-md border p-2">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Templates
            </Label>
            <div className="mt-1 flex flex-wrap gap-1">
              {(lib.monsterTemplates || []).filter((t) => t.name).map((t) => {
                const on = (m.templates || []).includes(t.name);
                return (
                  <button
                    key={t.name}
                    onClick={() =>
                      patch({
                        templates: on
                          ? (m.templates || []).filter((n) => n !== t.name)
                          : [...(m.templates || []), t.name],
                      })
                    }
                    className={`rounded border px-2 py-0.5 text-xs ${
                      on ? "border-primary bg-primary/10 font-semibold" : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
              {(lib.monsterTemplates || []).filter((t) => t.name).length === 0 && (
                <p className="text-[10px] text-muted-foreground">
                  No templates yet — create one in the Monster Templates section below.
                </p>
              )}
            </div>
          </div>

          {/* Loot pools: recursive loot tables rolled when this monster is looted. */}
          <div className="rounded-md border p-2">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Loot Pools
            </Label>
            <div className="mt-1 flex flex-wrap gap-1">
              {(lib.lootPools || []).filter((p) => p.name).map((p) => {
                const on = (m.lootPools || []).includes(p.name);
                return (
                  <button
                    key={p.name}
                    onClick={() =>
                      patch({
                        lootPools: on
                          ? (m.lootPools || []).filter((n) => n !== p.name)
                          : [...(m.lootPools || []), p.name],
                      })
                    }
                    className={`rounded border px-2 py-0.5 text-xs ${
                      on ? "border-primary bg-primary/10 font-semibold" : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
              {(lib.lootPools || []).filter((p) => p.name).length === 0 && (
                <p className="text-[10px] text-muted-foreground">
                  No loot pools yet — create them in the Reference Library (Loot Pools).
                </p>
              )}
            </div>
          </div>

          {/* Inventory: weapons become attacks, armor replaces AC. */}
          <div className="rounded-md border p-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Inventory
              </Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => patch({ inventory: [...(m.inventory || []), { name: "", kind: "other", damage: "", ac: "" }] })}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {(m.inventory || []).map((it, j) => (
              <div key={j} className="mt-1 flex items-center gap-1">
                <Input
                  className="h-8 flex-1 text-xs"
                  placeholder="Item name"
                  list="monster-item-names"
                  value={it.name || ""}
                  onChange={(e) => {
                    const next = [...m.inventory];
                    next[j] = { ...it, name: e.target.value };
                    patch({ inventory: next });
                  }}
                />
                <Select value={it.kind || "other"} onValueChange={(v) => {
                  const next = [...m.inventory];
                  next[j] = { ...it, kind: v };
                  patch({ inventory: next });
                }}>
                  <SelectTrigger className="h-8 w-24 shrink-0 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weapon">Weapon</SelectItem>
                    <SelectItem value="armor">Armor</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {it.kind === "weapon" && (
                  <Input
                    className="h-8 w-28 shrink-0 text-xs"
                    placeholder="Damage (e.g. 1d8 slashing)"
                    value={it.damage || ""}
                    onChange={(e) => {
                      const next = [...m.inventory];
                      next[j] = { ...it, damage: e.target.value };
                      patch({ inventory: next });
                    }}
                  />
                )}
                {it.kind === "armor" && (
                  <Input
                    className="h-8 w-20 shrink-0 text-xs"
                    placeholder="AC (e.g. 16)"
                    value={it.ac || ""}
                    onChange={(e) => {
                      const next = [...m.inventory];
                      next[j] = { ...it, ac: e.target.value };
                      patch({ inventory: next });
                    }}
                  />
                )}
                <Button size="sm" variant="ghost" onClick={() => patch({ inventory: m.inventory.filter((_, k) => k !== j) })}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <MiniList label="Proficiencies" items={m.proficiencies} onChange={(p) => patch({ proficiencies: p })} />
          <MiniList label="Traits" items={m.traits} onChange={(t) => patch({ traits: t })} />
          <MiniList label="Actions" items={m.actions} onChange={(a) => patch({ actions: a })} />
          <MiniList label="Bonus Actions" items={m.bonusActions} onChange={(a) => patch({ bonusActions: a })} />
          <MiniList label="Reactions" items={m.reactions} onChange={(r) => patch({ reactions: r })} />
          <MiniList label="Legendary Actions" items={m.legendaryActions} onChange={(a) => patch({ legendaryActions: a })} />
          <MiniList label="Lair Actions" items={m.lairActions} onChange={(a) => patch({ lairActions: a })} />
          <MiniList label="Mythic Actions" items={m.mythicActions} onChange={(a) => patch({ mythicActions: a })} />
          <datalist id="monster-tags">
            {["undead", "goblinoid", "beast", "fiend", "celestial", "dragon", "giant", "fey", "elemental", "construct", "monstrosity", "ooze", "plant", "aquatic", "flying", "minion", "elite", "boss", "animal"].map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <datalist id="monster-item-names">
            {[...weaponNames, ...armorNames].map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
      )}
    </div>
  );
}

const armorSource = (m, lib) => {
  const hit = (m.inventory || []).find((it) => it.kind === "armor" && resolveItem(it, lib)?.ac);
  return hit?.name || "";
};

// Monster Templates section: modifier bundles applied to monsters.
function TemplatesSection({ lib, setLib }) {
  const [open, setOpen] = useState(false);
  const templates = lib.monsterTemplates || [];
  const setT = (next) => setLib({ monsterTemplates: next });
  const add = () => setT([...templates, { ...BLANK_TEMPLATE }]);
  const patch = (i, p) => {
    const next = [...templates];
    next[i] = { ...next[i], ...p };
    setT(next);
  };
  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center justify-between">
        <button type="button" className="flex items-center gap-1 text-xs font-semibold" onClick={() => setOpen(!open)}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Monster Templates ({templates.length})
        </button>
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1 h-4 w-4" /> Add template
        </Button>
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-[10px] text-muted-foreground">
            Templates are modifiers a monster can wear: an AC/HP bonus, spellcasting text, legendary
            resistances and extra actions or traits. Applied on each monster's Templates chips.
          </p>
          {templates.map((t, i) => (
            <div key={i} className="space-y-1.5 rounded-md border p-2">
              <div className="flex items-center gap-1.5">
                <Input
                  className="h-8 flex-1 font-semibold"
                  placeholder="Template name"
                  value={t.name || ""}
                  onChange={(e) => patch(i, { name: e.target.value })}
                />
                <Button size="sm" variant="ghost" onClick={() => setT(templates.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <Field label="AC Bonus" value={t.acBonus} onChange={(v) => patch(i, { acBonus: v })} placeholder="+2" />
                <Field label="HP Bonus" value={t.hpBonus} onChange={(v) => patch(i, { hpBonus: v })} placeholder="+12" />
                <Field label="Legendary Resist." value={t.legendaryResistances} onChange={(v) => patch(i, { legendaryResistances: v })} placeholder="3/day" />
                <Field label="Spellcasting" value={t.spellcasting} onChange={(v) => patch(i, { spellcasting: v })} placeholder="Innate spellcasting…" />
              </div>
              <Field label="Description" value={t.description} onChange={(v) => patch(i, { description: v })} placeholder="What the template changes…" />
              <MiniList label="Traits" items={t.traits} onChange={(x) => patch(i, { traits: x })} />
              <MiniList label="Actions" items={t.actions} onChange={(a) => patch(i, { actions: a })} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MonstersTab() {
  const { setCharacter, settings, setSettings } = useTree();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");
  const [desc, setDesc] = useState(false);
  const importRef = useRef(null);
  if (!settings) return null;
  const lib = settings.library;
  const setLib = (patch) => setSettings((s) => ({ ...s, library: { ...s.library, ...patch } }));
  const monsters = lib.monsters || [];

  const add = () => setLib({ monsters: [...monsters, { ...BLANK }] });
  const patch = (i, p) => {
    const next = [...monsters];
    next[i] = { ...next[i], ...p };
    setLib({ monsters: next });
  };
  const remove = (i) => setLib({ monsters: monsters.filter((_, j) => j !== i) });

  const importMonsters = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = importMonsterPayload(JSON.parse(reader.result));
        if (!imported.length) {
          toast.error("No monsters found in that file.");
          return;
        }
        const byName = new Map(monsters.map((m) => [String(m.name || "").toLowerCase(), m]));
        let added = 0;
        let replaced = 0;
        imported.forEach((m) => {
          const key = m.name.toLowerCase();
          if (byName.has(key)) {
            byName.set(key, { ...byName.get(key), ...m });
            replaced += 1;
          } else {
            byName.set(key, m);
            added += 1;
          }
        });
        setLib({ monsters: [...byName.values()] });
        toast.success(`Imported ${imported.length} monsters — ${added} new, ${replaced} updated.`);
      } catch {
        toast.error("Could not read that monster file. Expected JSON.");
      }
    };
    reader.readAsText(file);
  };

  // Send a library monster to the character sheet as a new familiar statblock.
  const importToFamiliars = (m) => {
    const block = monsterToStatblock(m);
    setCharacter((c) => {
      const cur = c.familiars ?? (c.familiar ? [c.familiar] : []);
      const next = [...cur, block];
      return { ...c, familiars: next, familiar: next[0] || null };
    });
  };

  const shown = monsters
    .map((m, i) => ({ m, i }))
    .filter(({ m }) =>
      matchesQuery(
        [
          m?.name,
          m?.type,
          m?.category,
          ...(Array.isArray(m?.tags) ? m.tags : []),
        ].filter(Boolean).join(" "),
        q
      )
    )
    .sort((a, b) => {
      let d = 0;
      if (sort === "cr") d = crNum(a.m.cr) - crNum(b.m.cr);
      else if (sort === "hp") d = (Number(a.m.hp) || -1) - (Number(b.m.hp) || -1);
      else d = String(a.m[sort] || "").localeCompare(String(b.m[sort] || ""));
      return desc ? -d : d;
    });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={add}>
            <Plus className="mr-1 h-4 w-4" /> Add monster
          </Button>
          <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}>
            <FileUp className="mr-1 h-4 w-4" /> Import
          </Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              importMonsters(f);
            }}
          />
        </div>
        <div className="flex items-center gap-1">
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORTS.map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" title="Reverse order" onClick={() => setDesc(!desc)}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          <Input
            className="h-8 w-40"
            placeholder="Search monsters…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyNote items={monsters} query={q} />
      ) : (
        shown.map(({ m, i }) => (
          <MonsterRow
            key={i}
            m={m}
            i={i}
            onPatch={(p) => patch(i, p)}
            onDelete={() => remove(i)}
            onImport={() => importToFamiliars(m)}
            lib={lib}
          />
        ))
      )}
      <TemplatesSection lib={lib} setLib={setLib} />
    </div>
  );
}