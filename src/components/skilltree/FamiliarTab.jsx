import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, Plus, Save, Trash2, X } from "lucide-react";
import { ImageField } from "@/components/skilltree/ImageField";
import { feetToSpacesText } from "@/lib/resources";
import { speedEntries, speedTextFromEntries } from "@/lib/monsterSpeeds";

// The View sheet's Familiar tab: a monster-manual style statblock for the
// character's companion. Pick one from the Reference Library's Monsters list
// or start from a blank block, then edit every stat directly. Blocks can be
// saved back to the library. Stored on the character, so it saves and loads
// with the rest of the sheet.

const SIZE_MAP = { T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan" };
const ABILITIES = [
  ["str", "STR"],
  ["dex", "DEX"],
  ["con", "CON"],
  ["int", "INT"],
  ["wis", "WIS"],
  ["cha", "CHA"],
];
const modifier = (score) => {
  const m = Math.floor(((Number(score) || 0) - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
};
const toNum = (v) => {
  if (typeof v === "number") return Math.round(v);
  const m = String(v ?? "").match(/-?\d+/);
  return m ? Number(m[0]) : 0;
};
// "1/2" → 0.5 for CR sorting; unknowns sort last.
const crNum = (cr) => {
  const s = String(cr ?? "").trim();
  if (s === "1/8") return 0.125;
  if (s === "1/4") return 0.25;
  if (s === "1/2") return 0.5;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
};
const MONSTER_SORTS = [
  ["name", "Name"],
  ["cr", "CR"],
  ["type", "Type"],
  ["alignment", "Alignment"],
  ["size", "Size"],
  ["hp", "HP"],
];
const joinList = (v) => (Array.isArray(v) ? v.join(", ") : String(v ?? ""));

// {name, text} lists, accepting plain strings, [name, text] pairs,
// {name, text|desc} objects and 5e.tools-style {name, entries: [...]}.
const listOf = (v) => {
  const items = Array.isArray(v)
    ? v
    : v && typeof v === "object"
      ? Object.entries(v)
      : [];
  return items.map((x) => {
    if (typeof x === "string") return { name: "", text: x };
    if (Array.isArray(x)) return { name: String(x[0] ?? ""), text: String(x[1] ?? "") };
    const t = x.text ?? x.desc ?? x.entries;
    return {
      name: x.name || "",
      text: Array.isArray(t)
        ? t.map((e) => (typeof e === "object" ? JSON.stringify(e) : String(e))).join("\n")
        : String(t || ""),
    };
  });
};

// Accepts our own export shape plus common statblock JSON variants
// (e.g. dnd5e-api / 5e.tools monster exports).
export function normalizeStatblock(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const abil =
    r.abilities && typeof r.abilities === "object" && !Array.isArray(r.abilities)
      ? r.abilities
      : r;
  const stat = (k) => {
    const v = abil[k];
    if (v && typeof v === "object" && !Array.isArray(v)) return toNum(v.score ?? v.value);
    return toNum(v) || 10;
  };
  const speed = (() => {
    const s = r.speed ?? r.movement;
    if (s == null) return "";
    if (typeof s === "number") return feetToSpacesText(`${s} ft.`);
    if (typeof s === "string") return feetToSpacesText(s);
    if (Array.isArray(s)) return feetToSpacesText(s.join(", "));
    return feetToSpacesText(
      Object.entries(s)
        .map(([k, v]) => `${typeof v === "object" ? toNum(v?.number) : toNum(v)} ft. ${k === "walk" ? "" : k}`.trim())
        .join(", ")
    );
  })();
  const ac = r.ac ?? r.armorClass ?? r.armor_class;
  const acVal = Array.isArray(ac)
    ? toNum(ac[0]?.value ?? ac[0])
    : typeof ac === "object"
      ? toNum(ac?.value)
      : toNum(ac) || 10;
  const hp = r.hp ?? r.hitPoints ?? r.hit_points;
  const hpMax =
    typeof hp === "object" && hp
      ? toNum(hp.average ?? hp.value) || 1
      : toNum(hp) || 1;
  const cr = typeof r.cr === "object" ? (r.cr?.cr ?? "") : (r.cr ?? "");
  return {
    name: r.name || "",
    image: r.image || r.img || r.portrait || "",
    size: SIZE_MAP[r.size] || (typeof r.size === "string" ? r.size : ""),
    type: typeof r.type === "object" ? (r.type?.type ?? "") : (r.type ?? ""),
    alignment: joinList(r.alignment),
    ac: acVal,
    hpMax,
    hpCurrent: hpMax,
    speed,
    str: stat("str"),
    dex: stat("dex"),
    con: stat("con"),
    int: stat("int"),
    wis: stat("wis"),
    cha: stat("cha"),
    profBonus: toNum(r.profBonus ?? r.proficiencyBonus) || 2,
    hitDice: joinList(r.hitDice ?? r.hit_dice ?? r.hitdice),
    senses: feetToSpacesText(joinList(r.senses)),
    languages: joinList(r.languages),
    cr: String(cr),
    traits: listOf(r.traits ?? r.trait),
    actions: listOf(r.actions ?? r.action),
    reactions: listOf(r.reactions ?? r.reaction),
    proficiencies: listOf(r.proficiencies ?? r.saves ?? r.save),
    inventory: listOf(r.inventory),
  };
}

const BLANK = {
  name: "",
  image: "",
  size: "",
  type: "Familiar",
  alignment: "",
  ac: 10,
  hpMax: 1,
  hpCurrent: 1,
  speed: "",
  speeds: [],
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
  profBonus: 2,
  hitDice: "",
  senses: "",
  languages: "",
  cr: "",
  traits: [],
  actions: [],
  reactions: [],
  proficiencies: [],
  inventory: [],
  templates: [],
};

// A Reference Library monster → an editable statblock. The monster's ability
// scores are a "STR 18, DEX 11, …" string; parse the pairs.
export function monsterToStatblock(m) {
  const abil = {};
  String(m?.abilities || "")
    .split(",")
    .forEach((part) => {
      const p = part.trim().match(/^(STR|DEX|CON|INT|WIS|CHA)\s*[:=]?\s*(-?\d+)/i);
      if (p) abil[p[1].toLowerCase()] = Number(p[2]);
    });
  return {
    ...BLANK,
    name: m?.name || "",
    image: m?.image || m?.img || m?.portrait || "",
    size: m?.size || "",
    type: m?.type || "Familiar",
    alignment: m?.alignment || "",
    ac: toNum(m?.ac) || 10,
    hpMax: toNum(m?.hp) || 1,
    hpCurrent: toNum(m?.hp) || 1,
    speed: speedTextFromEntries(m?.speeds) || feetToSpacesText(m?.speed || ""),
    speeds: speedEntries(Array.isArray(m?.speeds) && m.speeds.length ? m.speeds : m?.speed),
    str: abil.str ?? 10,
    dex: abil.dex ?? 10,
    con: abil.con ?? 10,
    int: abil.int ?? 10,
    wis: abil.wis ?? 10,
    cha: abil.cha ?? 10,
    cr: String(m?.cr ?? ""),
    senses: feetToSpacesText(m?.senses || ""),
    languages: m?.languages || "",
    traits: (m?.traits || []).map((t) => ({ name: t.name || "", text: t.text || "" })),
    actions: (m?.actions || []).map((a) => ({ name: a.name || "", text: a.text || "" })),
    reactions: (m?.reactions || []).map((r) => ({ name: r.name || "", text: r.text || "" })),
    proficiencies: (m?.proficiencies || []).map((p) => ({ name: p.name || "", text: p.text || "" })),
    inventory: (m?.inventory || []).map((i) => ({
      name: i.name || "",
      text: i.kind === "weapon" ? i.damage || "" : i.kind === "armor" && i.ac ? `AC ${i.ac}` : "",
    })),
    templates: [...(m?.templates || [])],
  };
}

// An editable statblock → a Reference Library monster entry.
export function statblockToMonster(f) {
  return {
    name: f?.name || "",
    image: f?.image || "",
    size: f?.size || "",
    type: f?.type || "",
    alignment: f?.alignment || "",
    cr: f?.cr || "",
    description: "",
    ac: f?.ac ?? "",
    hp: f?.hpMax ?? "",
    speed: feetToSpacesText(f?.speed || ""),
    speeds: speedEntries(f?.speed),
    abilities: ABILITIES.map(([k, l]) => `${l} ${f?.[k] ?? 10}`).join(", "),
    senses: feetToSpacesText(f?.senses || ""),
    languages: f?.languages || "",
    traits: f?.traits || [],
    actions: f?.actions || [],
    reactions: f?.reactions || [],
    proficiencies: f?.proficiencies || [],
    inventory: (f?.inventory || []).map((i) => ({ name: i.name || "", kind: "other" })),
    templates: f?.templates || [],
  };
}

// A repeatable list of name + text entries (traits, actions, reactions).
function EntryList({ label, items, onChange }) {
  return (
    <div className="space-y-1 rounded-md border p-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <Button
          size="sm"
          variant="ghost"
          title={`Add ${label.toLowerCase().replace(/s$/, "")}`}
          onClick={() => onChange([...(items || []), { name: "", text: "" }])}
        >
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

function LabeledInput({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        className="h-8"
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// Effective familiar stats: base numbers plus every applied library template.
function famComputed(f, lib) {
  const tpls = (f.templates || [])
    .map((n) => (lib.monsterTemplates || []).find((t) => t.name === n))
    .filter(Boolean);
  const acBonus = tpls.reduce((s, t) => s + (Number(t.acBonus) || 0), 0);
  const hpBonus = tpls.reduce((s, t) => s + (Number(t.hpBonus) || 0), 0);
  return {
    tpls,
    ac: (Number(f.ac) || 0) + acBonus,
    hpMax: (Number(f.hpMax) || 0) + hpBonus,
    spellcasting: tpls.map((t) => t.spellcasting).filter(Boolean).join(" "),
    legendary: Math.max(0, ...tpls.map((t) => Number(t.legendaryResistances) || 0)),
  };
}

export function FamiliarTab() {
  const { character, setCharacter, settings, setSettings } = useTree();
  const [pick, setPick] = useState(undefined);
  const [sel, setSel] = useState(0);
  const [monsterSort, setMonsterSort] = useState("name");
  const [monsterDesc, setMonsterDesc] = useState(false);
  const monsters = (settings?.library?.monsters || []).filter((m) => m?.name);
  const sortedMonsters = [...monsters].sort((a, b) => {
    let d = 0;
    if (monsterSort === "cr") d = crNum(a.cr) - crNum(b.cr);
    else if (monsterSort === "hp") d = (Number(a.hp) || -1) - (Number(b.hp) || -1);
    else d = String(a[monsterSort] || "").localeCompare(String(b[monsterSort] || ""));
    return monsterDesc ? -d : d;
  });

  // Multiple familiars/companions (summons, mounts…). The old single
  // `familiar` field becomes slot one; `familiar` stays synced to slot one
  // so saves and exports keep working.
  const listFrom = (c) => c.familiars ?? (c.familiar ? [c.familiar] : []);
  const list = listFrom(character);
  const idx = Math.min(sel, Math.max(0, list.length - 1));
  const fam = list[idx];

  const setFam = (patch) =>
    setCharacter((c) => {
      const cur = listFrom(c);
      const next = cur.length ? [...cur] : [{ ...BLANK }];
      const i = Math.min(sel, Math.max(0, next.length - 1));
      next[i] = { ...(next[i] || BLANK), ...patch };
      return { ...c, familiars: next, familiar: next[0] || null };
    });

  const addFamiliar = (block) =>
    setCharacter((c) => {
      const next = [...listFrom(c), block || { ...BLANK }];
      return { ...c, familiars: next, familiar: next[0] || null };
    });

  const removeFamiliar = (i) =>
    setCharacter((c) => {
      const next = listFrom(c).filter((_, j) => j !== i);
      return { ...c, familiars: next, familiar: next[0] || null };
    });

  const addFromLibrary = () => {
    const m = monsters.find((x) => x.name === pick);
    if (!m) return;
    setSel(list.length);
    addFamiliar(monsterToStatblock(m));
    setPick(undefined);
  };

  const lib = settings?.library || {};
  const templates = lib.monsterTemplates || [];
  const eff = famComputed(fam ?? {}, lib);

  const saveToLibrary = () => {
    if (!fam) return;
    setSettings((s) => ({
      ...s,
      library: {
        ...s.library,
        monsters: [...(s.library.monsters || []), statblockToMonster(fam)],
      },
    }));
  };

  const sortControls = (
    <div className="flex items-center gap-1">
      <Select value={monsterSort} onValueChange={setMonsterSort}>
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONSTER_SORTS.map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="ghost"
        title="Reverse order"
        onClick={() => setMonsterDesc(!monsterDesc)}
      >
        <ArrowUpDown className="h-4 w-4" />
      </Button>
    </div>
  );

  if (!fam) {
    return (
      <div className="space-y-3 rounded-md border p-4 text-center">
        <p className="text-sm font-medium">No familiar yet</p>
        <p className="text-xs text-muted-foreground">
          {monsters.length
            ? "Pick a monster from the Reference Library, or start from a blank block."
            : "No monsters in the Reference Library yet — add some in the library's Monsters tab, or start from a blank block."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {monsters.length > 0 && (
            <>
              {sortControls}
              <Select value={pick} onValueChange={setPick}>
                <SelectTrigger className="h-9 w-56">
                  <SelectValue placeholder="Choose a monster…" />
                </SelectTrigger>
                <SelectContent>
                  {sortedMonsters.map((m, i) => (
                    <SelectItem key={i} value={m.name}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!pick} onClick={addFromLibrary}>
                Add familiar
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => addFamiliar({ ...BLANK })}>
            Blank statblock
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Familiar selector: one tab per companion/summon, plus an add button. */}
      <div className="flex flex-wrap items-center gap-1">
        {list.map((f, i) => (
          <button
            key={i}
            onClick={() => setSel(i)}
            className={`rounded-md border px-2 py-1 text-xs ${
              i === idx
                ? "border-destructive/50 bg-destructive/10 font-semibold"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {f.name || `Familiar ${i + 1}`}
          </button>
        ))}
        <Button
          size="sm"
          variant="outline"
          title="Add another familiar"
          onClick={() => {
            setSel(list.length);
            addFamiliar({ ...BLANK });
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Add another statblock from the library, sorted like the Monsters tab. */}
      {monsters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {sortControls}
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder="Add from library…" />
            </SelectTrigger>
            <SelectContent>
              {sortedMonsters.map((m, i) => (
                <SelectItem key={i} value={m.name}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!pick} onClick={addFromLibrary}>
            Add from library
          </Button>
        </div>
      )}

      {/* Statblock header */}
      <div className="rounded-md border border-destructive/40 p-3">
        <div className="flex items-center gap-2">
          <Input
            className="h-9 text-lg font-semibold"
            placeholder="Familiar name"
            value={fam.name || ""}
            onChange={(e) => setFam({ name: e.target.value })}
          />
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0"
            title="Save this statblock to the Reference Library's Monsters tab"
            onClick={saveToLibrary}
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 text-destructive"
            title="Remove the familiar"
            onClick={() => removeFamiliar(idx)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2">
          <ImageField
            label="Portrait"
            value={fam.image || ""}
            onChange={(v) => setFam({ image: v })}
            previewClass="h-32 w-32"
            info="Shown with this statblock on the View sheet. Uploads are stored in the project's image folder."
          />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <LabeledInput label="Size" value={fam.size} onChange={(v) => setFam({ size: v })} placeholder="Tiny" />
          <LabeledInput label="Type" value={fam.type} onChange={(v) => setFam({ type: v })} placeholder="Celestial" />
          <LabeledInput label="Alignment" value={fam.alignment} onChange={(v) => setFam({ alignment: v })} placeholder="Unaligned" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <LabeledInput label="Armor Class" value={fam.ac} onChange={(v) => setFam({ ac: toNum(v) })} />
          <LabeledInput label="HP (current)" value={fam.hpCurrent} onChange={(v) => setFam({ hpCurrent: toNum(v) })} />
          <LabeledInput label="HP (max)" value={fam.hpMax} onChange={(v) => setFam({ hpMax: toNum(v) })} />
          <LabeledInput
            label="Speed"
            value={feetToSpacesText(fam.speed) || ""}
            onChange={(v) => setFam({ speed: v })}
            placeholder="6 spaces, fly 12 spaces"
          />
        </div>
      </div>

      {/* Ability scores with auto-calculated modifiers */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {ABILITIES.map(([k, lbl]) => (
          <div key={k} className="rounded-md border border-destructive/40 p-2 text-center">
            <Label className="text-[10px] font-bold tracking-wider text-muted-foreground">{lbl}</Label>
            <Input
              className="mt-1 h-8 text-center"
              type="number"
              value={fam[k] ?? 10}
              onChange={(e) => setFam({ [k]: Number(e.target.value) || 0 })}
            />
            <span className="text-xs font-semibold text-destructive">{modifier(fam[k])}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <LabeledInput
          label="Proficiency Bonus"
          value={fam.profBonus}
          onChange={(v) => setFam({ profBonus: toNum(v) })}
        />
        <LabeledInput label="Challenge Rating" value={fam.cr} onChange={(v) => setFam({ cr: v })} />
        <LabeledInput label="Senses" value={feetToSpacesText(fam.senses) || ""} onChange={(v) => setFam({ senses: v })} placeholder="Darkvision 12 spaces" />
        <LabeledInput label="Languages" value={fam.languages} onChange={(v) => setFam({ languages: v })} placeholder="Understands your languages" />
      </div>

      <LabeledInput
        label="Hit Dice"
        value={fam.hitDice}
        onChange={(v) => setFam({ hitDice: v })}
        placeholder="2d6+2"
      />

      {/* Templates: named modifier bundles from the Reference Library's Monsters tab */}
      <div className="space-y-1 rounded-md border p-2">
        <Label className="text-xs">Templates</Label>
        <div className="flex flex-wrap gap-1">
          {templates.filter((t) => t.name).map((t) => {
            const on = (fam.templates || []).includes(t.name);
            return (
              <button
                key={t.name}
                onClick={() =>
                  setFam({
                    templates: on
                      ? (fam.templates || []).filter((n) => n !== t.name)
                      : [...(fam.templates || []), t.name],
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
          {templates.filter((t) => t.name).length === 0 && (
            <p className="text-[10px] text-muted-foreground">
              No templates yet — create them in the Reference Library's Monsters tab.
            </p>
          )}
        </div>
      </div>

      {/* Effective stats once templates are applied */}
      {eff.tpls.length > 0 && (
        <div className="space-y-1 rounded-md border border-destructive/40 p-2 text-xs">
          <p>
            <span className="font-semibold">With templates:</span> AC {eff.ac} · HP max {eff.hpMax}
            {eff.legendary ? ` · Legendary Resistances ${eff.legendary}/day` : ""}
          </p>
          {eff.spellcasting && <p>Spellcasting: {eff.spellcasting}</p>}
          {eff.tpls.flatMap((t) => t.traits || []).filter((x) => x?.name || x?.text).length > 0 && (
            <p>
              Template traits:{" "}
              {eff.tpls.flatMap((t) => t.traits || []).filter((x) => x?.name || x?.text).map((x) => x.name || x.text).join("; ")}
            </p>
          )}
          {eff.tpls.flatMap((t) => t.actions || []).filter((x) => x?.name || x?.text).length > 0 && (
            <p>
              Template actions:{" "}
              {eff.tpls.flatMap((t) => t.actions || []).filter((x) => x?.name || x?.text).map((x) => x.name || x.text).join("; ")}
            </p>
          )}
        </div>
      )}

      <EntryList label="Proficiencies" items={fam.proficiencies} onChange={(p) => setFam({ proficiencies: p })} />
      <EntryList label="Inventory" items={fam.inventory} onChange={(i) => setFam({ inventory: i })} />
      <EntryList label="Traits" items={fam.traits} onChange={(t) => setFam({ traits: t })} />
      <EntryList label="Actions" items={fam.actions} onChange={(a) => setFam({ actions: a })} />
      <EntryList label="Reactions" items={fam.reactions} onChange={(r) => setFam({ reactions: r })} />
    </div>
  );
}