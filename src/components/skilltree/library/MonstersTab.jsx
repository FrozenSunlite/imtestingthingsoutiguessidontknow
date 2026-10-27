import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { ListHeader, EmptyNote } from "./shared";
import { matchesQuery } from "@/lib/textSearch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Plus, X, ArrowUpDown, UserPlus } from "lucide-react";
import { monsterToStatblock } from "@/components/skilltree/FamiliarTab";
import { ImageField } from "@/components/skilltree/ImageField";

// Reference Library tab: a log of monsters. Each entry is a full statblock
// (sorted by name, CR, type, alignment…), can carry inventory — a weapon adds
// an attack to its actions, armor with an AC replaces its AC — and can have
// Templates applied: named bundles of modifiers (spellcasting, extra actions,
// legendary resistances…) defined in the tab's template section.

const BLANK = {
  name: "", image: "", size: "", type: "", alignment: "", cr: "", description: "", flavor: "",
  ac: "", hp: "", speed: "", abilities: "", senses: "", languages: "",
  traits: [], actions: [], reactions: [], proficiencies: [], inventory: [], templates: [],
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

function Field({ label, value, onChange, placeholder, className }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input className={`h-8 ${className || ""}`} placeholder={placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// One monster entry: summary line with the effective stats, expandable editor.
function MonsterRow({ m, i, onPatch, onDelete, onImport, lib }) {
  const [open, setOpen] = useState(false);
  const eff = computed(m, lib);
  const patch = onPatch;
  const weaponNames = (lib.weapons || []).map((w) => w.name).filter(Boolean);
  const armorNames = (lib.armor || []).map((a) => a.name).filter(Boolean);
  const summary = [m.size, m.type].filter(Boolean).join(" ");
  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => setOpen(!open)} className="shrink-0">
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
          {m.alignment && <p>Alignment: {m.alignment}</p>}
          {(eff.ac || eff.hp) && (
            <p>
              AC {eff.ac || "—"}
              {armorSource(m, lib) ? ` (${armorSource(m, lib)})` : ""} · HP {eff.hp || "—"}
              {eff.legendary ? ` · Legendary Resistances ${eff.legendary}/day` : ""}
            </p>
          )}
          {eff.spellcasting && <p>Spellcasting: {eff.spellcasting}</p>}
          {m.description && <p className="line-clamp-2">{m.description}</p>}
          {m.flavor && <p className="line-clamp-2 italic">{m.flavor}</p>}
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
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <Field label="AC" value={m.ac} onChange={(v) => patch({ ac: v })} placeholder="13" />
              <Field label="HP" value={m.hp} onChange={(v) => patch({ hp: v })} placeholder="45" />
              <Field label="Speed" value={m.speed} onChange={(v) => patch({ speed: v })} placeholder="30 ft., fly 60 ft." />
            </div>
          </div>

          {/* Ability scores with auto-calculated modifiers */}
          <AbilityBlock m={m} patch={patch} />

          <div className="grid grid-cols-3 gap-1.5">
            <Field label="CR" value={m.cr} onChange={(v) => patch({ cr: v })} placeholder="1/2" />
            <Field label="Senses" value={m.senses} onChange={(v) => patch({ senses: v })} placeholder="Darkvision 60 ft." />
            <Field label="Languages" value={m.languages} onChange={(v) => patch({ languages: v })} placeholder="—" />
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
          <MiniList label="Reactions" items={m.reactions} onChange={(r) => patch({ reactions: r })} />
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
  const { character, setCharacter, settings, setSettings } = useTree();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");
  const [desc, setDesc] = useState(false);
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
    .filter(({ m }) => matchesQuery(m?.name, q))
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
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1 h-4 w-4" /> Add monster
        </Button>
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