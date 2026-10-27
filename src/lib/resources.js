import { evalResource } from "@/lib/geometry";
import { statOr10 } from "@/lib/skills";

// Homebrew sizes extend the classic ladder in both directions: Fine and
// Diminutive below Tiny, and a dozen titanic sizes above Gargantuan.
export const SIZE_LADDER = [
  "fine", "diminutive", "tiny", "small", "medium", "large", "huge", "gargantuan",
  "colossal", "titanic", "immense", "enormous", "stupendous", "tremendous",
  "humongous", "ginormous", "brobdingnagian", "vast", "astronomical", "immeasurable",
];
export const SIZE_LABELS = {
  fine: "Fine",
  diminutive: "Diminutive",
  tiny: "Tiny",
  small: "Small",
  medium: "Medium",
  large: "Large",
  huge: "Huge",
  gargantuan: "Gargantuan",
  colossal: "Colossal",
  titanic: "Titanic",
  immense: "Immense",
  enormous: "Enormous",
  stupendous: "Stupendous",
  tremendous: "Tremendous",
  humongous: "Humongous",
  ginormous: "Ginormous",
  brobdingnagian: "Brobdingnagian",
  vast: "Vast",
  astronomical: "Astronomical",
  immeasurable: "Immeasurable",
};
export const SIZE_MULT = {
  fine: 0.125, diminutive: 0.25, tiny: 0.5, small: 1, medium: 1, large: 2,
  huge: 4, gargantuan: 8, colossal: 16, titanic: 32, immense: 64, enormous: 128,
  stupendous: 256, tremendous: 512, humongous: 1024, ginormous: 2048,
  brobdingnagian: 4096, vast: 8192, astronomical: 16384, immeasurable: 32768,
};

// Built-in derived resources a talent can target. Their values come from the
// character sheet or level/stats; node resources either add to them (the
// yellow +N on the sheet) or replace them outright.
export const BUILTIN_RESOURCES = [
  { key: "Hit Points", group: "Core" },
  { key: "Hit Dice", group: "Core" },
  { key: "Armor Class", group: "Core" },
  { key: "Speed", group: "Core" },
  { key: "Horizontal Jump", group: "Movement" },
  { key: "Vertical Jump", group: "Movement" },
  { key: "Climbing Speed", group: "Movement" },
  { key: "Swimming Speed", group: "Movement" },
  { key: "Flying Speed", group: "Movement" },
  { key: "Burrowing Speed", group: "Movement" },
  { key: "Spell Attacks", group: "Core" },
  { key: "Save DCs", group: "Core" },
  { key: "Proficiency Bonus", group: "Core" },
  { key: "Saving Throws", group: "Core" },
  { key: "Initiative", group: "Core" },
  { key: "Darkvision", group: "Senses" },
  { key: "Blindsight", group: "Senses" },
  { key: "Truesight", group: "Senses" },
  { key: "Tremorsense", group: "Senses" },
  { key: "Barrier", group: "Core" },
  { key: "Inspiration", group: "Core" },
  { key: "Exhaustion", group: "Core" },
  { key: "Exertion", group: "Core" },
  { key: "Creature Type", group: "Type" },
  { key: "Size", group: "Size" },
  { key: "Count as Size", group: "Size" },
  { key: "STR", group: "Ability Scores" },
  { key: "DEX", group: "Ability Scores" },
  { key: "CON", group: "Ability Scores" },
  { key: "INT", group: "Ability Scores" },
  { key: "WIS", group: "Ability Scores" },
  { key: "CHA", group: "Ability Scores" },
  { key: "Heritage Points", group: "Point Pools" },
  { key: "Talent Points", group: "Point Pools" },
  { key: "Attribute Points", group: "Point Pools" },
];
export const BUILTIN_KEYS = new Set(BUILTIN_RESOURCES.map((r) => r.key));
export const BUILTIN_ROW_ORDER = [
  "Hit Points",
  "Hit Dice",
  "Armor Class",
  "Speed",
  "Horizontal Jump",
  "Vertical Jump",
  "Spell Attacks",
  "Save DCs",
  "Proficiency Bonus",
  "Saving Throws",
  "Initiative",
  "Inspiration",
  "Exhaustion",
  "Exertion",
  "Creature Type",
  "Size",
  "Count as Size",
  "STR",
  "DEX",
  "CON",
  "INT",
  "WIS",
  "CHA",
];
export const STATS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
// Movement is measured in "spaces" rather than feet. Default speed types and
// senses; the Reference Library seeds these and is the source of truth for the
// rows shown on the sheet.
export const DEFAULT_SPEED_TYPES = ["Standard", "Climbing", "Swimming", "Flying", "Burrowing"];
export const DEFAULT_SENSES = ["Darkvision", "Blindsight", "Truesight", "Tremorsense"];

// Convert legacy feet measurements in free text to spaces (1 space = 5 ft).
// Handles "30 ft.", "60 feet", "20-foot-radius Sphere" and similar.
export function feetToSpacesText(text) {
  if (typeof text !== "string" || !text) return text;
  const spaces = (n) => {
    const v = Math.round((Number(n) / 5) * 10) / 10;
    return v;
  };
  return text
    .replace(/(\d+(?:\.\d+)?)\s*-\s*foot(-?[a-z]*)/gi, (_, n, suffix) => `${spaces(n)}-space${suffix}`)
    .replace(/(\d+(?:\.\d+)?)\s*(?:ft\.?|feet|foot)\b/gi, (_, n) => {
      const v = spaces(n);
      return `${v} ${v === 1 ? "space" : "spaces"}`;
    });
}

// The speed/sense names shown on the sheet come from the library (seeded with
// the defaults). The character's saved values are looked up by these names.
export function speedTypeList(character, lib = null) {
  const names = (lib?.speedTypes || [])
    .map((s) => (typeof s === "string" ? s : s?.name))
    .filter(Boolean);
  return names.length ? names : DEFAULT_SPEED_TYPES;
}

export function senseList(character, lib = null) {
  const names = (lib?.senses || [])
    .map((s) => (typeof s === "string" ? s : s?.name))
    .filter(Boolean);
  return names.length ? names : DEFAULT_SENSES;
}

export const ACTION_CATEGORIES = [
  ["action", "Action"],
  ["bonus", "Bonus Action"],
  ["free", "Free"],
  ["reaction", "Reaction"],
  ["downtime", "Downtime"],
];

// 2014-style Exertion is a second six-stage track. Its effects are cumulative
// and shown on the sheet; Speed and maximum HP are also adjusted automatically.
export const EXERTION_EFFECTS = [
  "Disadvantage on ability checks",
  "Speed halved",
  "Disadvantage on attack rolls and saving throws",
  "Hit point maximum halved",
  "Speed reduced to 0",
  "Death",
];

// Formula variables are keyed without spaces: "Superiority Dice" → SuperiorityDice.
export const sanitizeKey = (name) => String(name || "").replace(/[^A-Za-z0-9]/g, "");

// Full picker catalog: built-ins first, then every resource name defined on
// any node of the tree, then the sheet's manual resources and the Reference
// Library's own resource list.
export function resourceCatalog(tree, manualResources = [], lib = null) {
  const custom = new Map();
  (tree?.nodes || []).forEach((n) =>
    (n.resources || []).forEach((r) => {
      const name = String(r?.name || "").trim();
      if (name && !BUILTIN_KEYS.has(name)) custom.set(name.toLowerCase(), { name, builtin: false });
    })
  );
  (lib?.resources || []).forEach((r) => {
    const name = String(r?.name || "").trim();
    if (name && !BUILTIN_KEYS.has(name)) custom.set(name.toLowerCase(), { name, builtin: false });
  });
  (manualResources || []).forEach((r) => {
    const name = String(r?.name || "").trim();
    if (name && !BUILTIN_KEYS.has(name)) custom.set(name.toLowerCase(), { name, builtin: false });
  });
  // Library speed types and senses are valid node targets too, so they show up
  // in resource pickers (e.g. "Climbing Speed", "Darkvision").
  (lib?.speedTypes || []).forEach((t) => {
    const name = String(t?.name || t || "").trim();
    if (!name) return;
    const key = name === "Standard" ? "Speed" : `${name} Speed`;
    if (!BUILTIN_KEYS.has(key)) custom.set(key.toLowerCase(), { name: key, builtin: false });
  });
  (lib?.senses || []).forEach((s) => {
    const name = String(s?.name || s || "").trim();
    if (name && !BUILTIN_KEYS.has(name)) custom.set(name.toLowerCase(), { name, builtin: false });
  });
  return [...BUILTIN_RESOURCES.map((r) => ({ name: r.key, builtin: true, group: r.group })), ...custom.values()];
}

// Every custom resource the sheet should show: resources granted by nodes or
// present on the character, plus every Reference Library resource even when it
// has no current value yet. Library entries appear at 0 so the catalogue and
// the sheet stay in sync.
export function customResourceList(aggregated = [], lib = null) {
  const rows = (aggregated || []).filter((e) => e && !BUILTIN_KEYS.has(e.name));
  const seen = new Set(rows.map((e) => String(e.name).toLowerCase()));
  (lib?.resources || []).forEach((r) => {
    const name = String(r?.name || "").trim();
    if (!name || seen.has(name.toLowerCase()) || BUILTIN_KEYS.has(name)) return;
    seen.add(name.toLowerCase());
    rows.push({
      name,
      color: r.color || "#ffffff",
      uses: 0,
      value: "0",
      diceParts: [],
      text: "",
      typeParts: [],
      grant: null,
      replaced: null,
      dieSize: "",
      dieAdjust: 0,
      dieOverride: "",
      recovery: "",
      recoveryAmount: "",
      libraryOnly: true,
    });
  });
  return rows;
}

// Ranked search over a catalog: starts-with matches first, then contains.
export function searchCatalog(items, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return items.slice(0, 8);
  return items
    .map((i) => {
      const n = i.name.toLowerCase();
      const score = n.startsWith(q) ? 0 : n.includes(q) ? 1 : 2;
      return { i, score };
    })
    .filter((x) => x.score <= 1)
    .sort((a, b) => a.score - b.score || a.i.name.localeCompare(b.i.name))
    .map((x) => x.i)
    .slice(0, 8);
}

// Resolve a resource definition to { num, text, dice } given vars
// (level, stats, prof and other resources' numeric values).
export function resolveResourceValue(r, vars = {}) {
  const vt = r.valueType || "flat";
  if (vt === "equal") {
    const ref = r.equalTo || "";
    if (ref === "level") return { num: Number(vars.level) || 0, text: String(vars.level ?? "") };
    if (ref === "hitDie") {
      const n = Number(vars.hitDie) || 0;
      return { num: n, text: `d${n}` };
    }
    const v = vars[sanitizeKey(ref)];
    if (v != null && Number.isFinite(Number(v))) return { num: Number(v), text: String(v) };
    return { num: NaN, text: `= ${ref || "?"}` };
  }
  const raw = String(r.uses ?? r.value ?? "").trim();
  if (vt === "formula" || (vt === "flat" && raw !== "" && !/^-?\d+(\.\d+)?$/.test(raw))) {
    const ev = evalResource(raw, vars);
    const num = parseFloat(ev);
    if (Number.isFinite(num) && /^-?\d+(\.\d+)?$/.test(String(ev).trim())) return { num, text: String(num) };
    return { num: NaN, text: ev || raw };
  }
  const flat = parseFloat(raw) || 0;
  if (vt === "flatDice") {
    const count = Number(r.diceCount) || 0;
    const dice = count ? `${count}${r.diceSize || "d6"}` : "";
    return { num: flat, text: dice ? (flat ? `${flat}+${dice}` : dice) : String(flat), dice };
  }
  return { num: flat, text: String(flat) };
}

// Numeric value per resource name (for formulas and shared action pools).
export function numericResourceMap(aggregated = []) {
  const out = {};
  (aggregated || []).forEach((e) => {
    if (e.grant || e.text || (e.diceParts || []).length) return;
    const n = Number(e.value);
    if (Number.isFinite(n)) out[sanitizeKey(e.name)] = n;
  });
  return out;
}

// Formula variables: level, effective stats, each ability's modifier
// (STRmod…), the hit die's numeric size (hitDie = 6 for a d6), prof, plus
// every resource's numeric value keyed without spaces.
export function buildVars(level, stats, profBonus, resourceNums = {}, hitDieSize = "") {
  const vars = { level: Number(level) || 1, ...(stats || {}), prof: profBonus };
  STATS.forEach((s) => (vars[s + "mod"] = Math.floor((statOr10(stats?.[s]) - 10) / 2)));
  vars.hitDie = Number(String(hitDieSize || "d6").replace(/\D/g, "")) || 6;
  return { ...vars, ...resourceNums };
}

// Node actions on invested nodes → runtime instances with resolved uses.
// Combines the library's default actions with actions granted by unlocked
// nodes. A node action with the same name and category replaces the default,
// so a customized copy wins; defaults come first, custom additions after.
// How many times an action/spell repeats when activated (e.g. Multiattack,
// Eldritch Blast beams). A number or formula; 1 when unset.
export function repeatsFor(entry, vars = {}) {
  const raw = entry?.repeats;
  if (raw === undefined || raw === null || raw === "") return 1;
  const ev = evalResource(String(raw), vars);
  const n = parseInt(ev, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function mergeLibraryActions(libActions, nodeActions, vars = {}) {
  const ownUses = (a) => {
    if ((a.usesMode || "atwill") !== "own") return null;
    const ev = evalResource(String(a.uses ?? "1").trim() || "1", vars);
    const num = parseFloat(ev);
    return Number.isFinite(num) && /^-?\d+(\.\d+)?$/.test(String(ev).trim()) ? num : ev;
  };
  const base = (libActions || [])
    .filter((a) => a.name)
    .map((a) => ({
      id: `lib:${a.category || "action"}:${a.name}`,
      nodeId: null,
      nodeName: "Default",
      name: a.name,
      description: a.description || "",
      category: a.category || "action",
      usesMode: a.usesMode || "atwill",
      ownUses: ownUses(a),
      sharedResource: (a.usesMode || "atwill") === "shared" ? a.sharedResource || "" : "",
      recovery: a.recovery || "none",
      recoveryAmount: a.recoveryAmount || "",
      resolve: a.resolve || "none",
      repeats: a.repeats ?? "",
      trigger: a.trigger || "",
      requiresStatus: a.requiresStatus || "",
      grantsStatus: a.grantsStatus || "",
    }));
  const granted = (nodeActions || []).map((a) => ({
    ...a,
    resolve: a.resolve || "none",
    repeats: a.repeats ?? "",
  }));
  const taken = new Set(granted.map((a) => `${a.category || "action"}:${a.name}`));
  return [...base.filter((b) => !taken.has(`${b.category}:${b.name}`)), ...granted];
}

export function collectActions(tree, vars = {}) {
  const out = [];
  (tree?.nodes || []).forEach((n) => {
    if ((n.currentPoints || 0) <= 0) return;
    (n.actions || []).forEach((a, i) => {
      if (!a?.name) return;
      const usesMode = a.usesMode || "atwill";
      let ownUses = null;
      if (usesMode === "own") {
        const ev = evalResource(String(a.uses ?? "1").trim() || "1", vars);
        const num = parseFloat(ev);
        ownUses = Number.isFinite(num) && /^-?\d+(\.\d+)?$/.test(String(ev).trim()) ? num : ev;
      }
      out.push({
        id: `${n.id}:${i}`,
        nodeId: n.id,
        nodeName: n.name,
        name: a.name,
        description: a.description || "",
        category: a.category || "action",
        usesMode,
        ownUses,
        sharedResource: usesMode === "shared" ? a.sharedResource || "" : "",
        recovery: a.recovery || "none",
        recoveryAmount: a.recoveryAmount || "",
        repeats: a.repeats || "",
        trigger: a.trigger || "",
        requiresStatus: a.requiresStatus || "",
        grantsStatus: a.grantsStatus || "",
      });
    });
  });
  return out;
}

// Restore uses after a rest. A blank recovery amount restores the full pool
// (the default); a number restores that many uses.
export function restRestore(actions, spent, rest) {
  const next = { ...spent };
  (actions || []).forEach((a) => {
    // A long rest also restores everything that comes back on a short rest.
    if (a.recovery !== rest && !(rest === "long" && a.recovery === "short")) return;
    const key = a.usesMode === "shared" ? "shared:" + a.sharedResource : a.id;
    const amt = a.recoveryAmount === "" ? null : Number(a.recoveryAmount) || 0;
    const cur = Number(next[key]) || 0;
    next[key] = Math.max(0, amt == null ? 0 : cur - amt);
  });
  return next;
}

// Net size shift applied to a size-ish builtin by invested nodes (+/− steps).
export function sizeShift(tree, key = "Count as Size") {
  let shift = 0;
  (tree?.nodes || []).forEach((n) => {
    if ((n.currentPoints || 0) <= 0) return;
    (n.resources || []).forEach((r) => {
      if (String(r?.name || "").trim() !== key || r.type === "grant" || r.mode === "replace") return;
      const num = parseFloat(String(r.uses ?? r.value ?? "").trim());
      if (Number.isFinite(num)) shift += num;
    });
  });
  return shift;
}

export function ladderIndex(size, shift = 0) {
  const idx = SIZE_LADDER.indexOf(String(size || "medium").toLowerCase());
  const base = idx < 0 ? 2 : idx;
  return Math.min(SIZE_LADDER.length - 1, Math.max(0, base + shift));
}

// Built-in derived values with node contributions. aggregated comes from
// aggregateResources (adds in .uses, overrides in .replaced).
export function derivedSheet(
  character,
  tree,
  levels,
  aggregated,
  profBonus,
  stats,
  lib = null
) {
  const find = (key) => (aggregated || []).find((e) => e.name === key);
  const val = (key, base) => {
    const e = find(key);
    const adds = Number(e ? e.uses || 0 : 0) || 0;
    const replaced = e && e.replaced != null ? e.replaced : null;
    const finalNum = Math.round(((replaced != null ? Number(replaced) || 0 : base) + adds) * 10) / 10;
    return { base, adds, replaced, final: finalNum };
  };
  const out = {};
  STATS.forEach((s) => (out[s] = val(s, statOr10(stats?.[s]))));
  // Modifiers use the effective score (base + attribute nodes + node
  // resource contributions), so a stat dropped below 10 yields negative
  // modifiers everywhere.
  const mod = (s) => Math.floor((statOr10(out[s]?.final ?? stats?.[s]) - 10) / 2);
  const spellStat = character.spellStat || "CHA";
  const sm = mod(spellStat);
  out["Hit Points"] = val("Hit Points", Number(character.hitPoints) || 0);
  // Equipped armor overrides unarmored defense: the armor's structured AC (a
  // flat value, optionally plus an ability or skill modifier) replaces the
  // 10 + DEX base and any node's AC replacement, while node additions still
  // stack on top.
  const armor = equippedArmorEntry(character, lib);
  const skillModOf = (name) => {
    const sk = (lib?.lists?.skills || []).find(
      (s) => String(s?.name || "").toLowerCase() === String(name).toLowerCase()
    );
    if (!sk) return 0;
    let m = mod(sk.ability || "DEX");
    if (
      (character.proficiencies?.skills || []).some(
        (p) => String(p?.name || "").toLowerCase() === String(name).toLowerCase()
      )
    )
      m += profBonus;
    return m;
  };
  let acBase = 10 + mod("DEX");
  if (armor) {
    const { flat, plus } = parseArmorAC(armor);
    acBase = flat + (plus ? (STATS.includes(plus) ? mod(plus) : skillModOf(plus)) : 0);
  }
  const acEntry = val("Armor Class", acBase);
  if (armor) {
    acEntry.replaced = null;
    acEntry.armor = armor.name;
  }
  out["Armor Class"] = acEntry;
  const enc = encumbranceInfo(character, tree);
  const smallPen = character.smallRaceHeritage ? 5 : 0;
  // Exhaustion (2024) and Exertion (2014-style) both affect movement.
  const ex = val("Exhaustion", Number(character.exhaustion) || 0);
  const exStages = Math.max(0, Math.min(6, Math.round(ex.final)));
  const exr = val("Exertion", Number(character.exertion) || 0);
  const exrStages = Math.max(0, Math.min(6, Math.round(exr.final)));
  out["Speed"] = val(
    "Speed",
    (Number(character.speed ?? 6) || 0) + (Number(character.modifiers?.speed) || 0)
  );
  let speedFinal = Math.max(
    0,
    out["Speed"].final - smallPen - (character.trackEncumbrance ? enc.penalty : 0)
  );
  // 2024 Exhaustion: −5 ft (one space) per stage.
  speedFinal = Math.max(0, speedFinal - exStages);
  // 2014-style Exertion: halved at stage 2, reduced to 0 at stage 5.
  const beforeExertion = speedFinal;
  if (exrStages >= 2) speedFinal = Math.floor(speedFinal / 2);
  if (exrStages >= 5) speedFinal = 0;
  out["Speed"].final = speedFinal;
  out["Speed"].encPenalty = character.trackEncumbrance ? enc.penalty : 0;
  out["Speed"].smallPenalty = smallPen;
  out["Speed"].exhaustPenalty = exStages;
  out["Speed"].exertPenalty = Math.max(0, beforeExertion - speedFinal);
  // Movement in spaces: jump distances (2 horizontal / 1 vertical by default),
  // per-type speeds (Standard is the Speed above; others start at 0 or their
  // saved value) and sense ranges. Nodes add to or replace each by name.
  out["Horizontal Jump"] = val("Horizontal Jump", Number(character.jumpH ?? 2) || 0);
  out["Vertical Jump"] = val("Vertical Jump", Number(character.jumpV ?? 1) || 0);
  speedTypeList(character, lib).forEach((t) => {
    if (t === "Standard") return;
    out[`${t} Speed`] = val(`${t} Speed`, Number(character.speeds?.[t] ?? 0) || 0);
  });
  (aggregated || []).forEach((e) => {
    if (/ Speed$/.test(e.name) && !out[e.name]) out[e.name] = val(e.name, 0);
  });
  senseList(character, lib).forEach((s) => {
    out[s] = val(s, Number(character.senses?.[s] ?? 0) || 0);
  });
  out["Proficiency Bonus"] = val("Proficiency Bonus", profBonus);
  out["Saving Throws"] = val("Saving Throws", 0);
  out["Spell Attacks"] = val("Spell Attacks", profBonus + sm);
  out["Save DCs"] = val("Save DCs", 8 + profBonus + sm);
  // Hit dice: the quantity defaults to the level (or an explicit
  // hitDiceCount override) and the die size to d6. A node resource that
  // REPLACES Hit Dice overrides either: a plain number replaces the
  // quantity, a die value like "d10" replaces the size.
  const hd = find("Hit Dice");
  const hdBase =
    character.hitDiceCount != null && character.hitDiceCount !== ""
      ? Number(character.hitDiceCount) || 0
      : Number(character.level) || 1;
  const hdRepl = hd?.replaced;
  const hdCountRepl =
    hdRepl != null && !/^d\d+$/i.test(String(hdRepl)) ? Number(hdRepl) || 0 : null;
  const hdSizeRepl =
    hdRepl != null && /^d\d+$/i.test(String(hdRepl)) ? String(hdRepl).toLowerCase() : null;
  out["Hit Dice"] = {
    base: hdBase,
    adds: Number(hd ? hd.uses || 0 : 0) || 0,
    replaced: hdCountRepl,
    size: hdSizeRepl || character.hitDiceSize || "d6",
    final:
      (hdCountRepl != null ? hdCountRepl : hdBase) + (Number(hd ? hd.uses || 0 : 0) || 0),
  };
  const sz = find("Size");
  const cs = find("Count as Size");
  out["Size"] = {
    base: character.size || "",
    adds: Number(sz ? sz.uses || 0 : 0) || 0,
    replaced: sz?.replaced ?? null,
    idx: ladderIndex(character.size, sz ? sz.uses || 0 : 0),
  };
  out["Count as Size"] = {
    base: character.sizeCountAs || "medium",
    adds: Number(cs ? cs.uses || 0 : 0) || 0,
    replaced: cs?.replaced ?? null,
    idx: ladderIndex(character.sizeCountAs, cs ? cs.uses || 0 : 0),
  };
  // Creature Type: base type from the character; node resources add extra
  // types (in the order they were acquired) or replace them outright. With
  // multiple full replacements, every replacing type is shown.
  const ct = find("Creature Type");
  const ctParts = ct?.typeParts || [];
  const ctReplaces = ctParts.filter((p) => p.mode === "replace").map((p) => p.text);
  const ctAdds = ctParts.filter((p) => p.mode !== "replace" && p.text).map((p) => p.text);
  out["Creature Type"] = {
    base: character.creatureType || "Humanoid",
    text: (ctReplaces.length
      ? ctReplaces
      : [character.creatureType || "Humanoid", ...ctAdds]
    ).join(" "),
    adds: ctAdds,
  };
  out["Exhaustion"] = {
    ...ex,
    final: exStages,
    penalty: 2 * exStages,
    speedPenalty: exStages,
  };
  out["Exertion"] = {
    ...exr,
    final: exrStages,
    effects: EXERTION_EFFECTS.slice(0, exrStages),
    speedMultiplier: exrStages >= 5 ? 0 : exrStages >= 2 ? 0.5 : 1,
    hpMaxMultiplier: exrStages >= 4 ? 0.5 : 1,
  };
  const init = val("Initiative", mod("DEX"));
  init.final = init.final - 2 * exStages;
  out["Initiative"] = init;
  // Inspiration is one slot; talents can add more. `filled` is how many of
  // those slots the player currently has marked.
  const insp = val("Inspiration", 1);
  const inspSlots = Math.max(0, Math.round(insp.final));
  out["Inspiration"] = {
    ...insp,
    slots: inspSlots,
    filled: Math.max(0, Math.min(inspSlots, Number(character.inspiration) || 0)),
  };
  return out;
}

// Total carried weight: items (weight × qty) plus coins (50 coins = 1 lb),
// so coin piles count toward encumbrance and speed penalties.
export function totalCarried(character) {
  // Items in storage or chests stay behind and don't count toward encumbrance.
  const items = (character?.inventory || [])
    .filter((i) => (i?.location || "carried") !== "storage")
    .reduce(
      (a, i) => a + (Number(i?.weight) || 0) * (Number(i?.qty) || 1),
      0
    );
  const coins = Object.values(character?.coins || {}).reduce(
    (a, b) => a + (Number(b) || 0),
    0
  );
  return items + Math.floor(coins / 50);
}

// Variant encumbrance: thresholds at 5×/10×/15× STR (scaled by Count as Size).
// Past Light −2 spaces of speed, past Heavy −4; Max is the hard carry cap.
export function encumbranceInfo(character, tree = null) {
  const str = Number(character?.stats?.STR) || 0;
  const idx = SIZE_LADDER.indexOf(String(character?.sizeCountAs || "medium").toLowerCase());
  const shifted = Math.min(
    SIZE_LADDER.length - 1,
    Math.max(0, (idx < 0 ? 2 : idx) + (tree ? sizeShift(tree, "Count as Size") : 0))
  );
  const mult = SIZE_MULT[SIZE_LADDER[shifted]] ?? 1;
  const weight = totalCarried(character);
  return {
    weight,
    light: str * 5 * mult,
    heavy: str * 10 * mult,
    max: str * 15 * mult,
    penalty: weight > str * 10 * mult ? 4 : weight > str * 5 * mult ? 2 : 0,
  };
}

// The armor library entry for the piece currently equipped (location
// "equipped" in the inventory), or null.
export function equippedArmorEntry(character, lib = null) {
  const inv = (character?.inventory || []).find(
    (it) => it?.type === "Armor" && it?.location === "equipped" && it?.name
  );
  if (!inv) return null;
  const entry = (lib?.armor || []).find((a) => a?.name === inv.name);
  return entry ? { ...entry } : null;
}

// Structured armor AC: a flat value, optionally plus an ability (DEX…) or a
// skill modifier. Falls back to parsing the legacy free-text formula
// ("14 + Dex") for older library saves.
export function parseArmorAC(a = {}) {
  if (a.acFlat != null || a.acPlus != null)
    return { flat: Number(a.acFlat) || 0, plus: a.acPlus || "" };
  const m = String(a.ac || "").trim().match(/^(\d+)\s*(?:\+\s*(\w+))?$/i);
  const word = m?.[2] || "";
  const stat = STATS.find((s) => s.toLowerCase() === word.toLowerCase());
  return { flat: m ? Number(m[1]) : 0, plus: stat ? stat : word };
}

// Damage resistances / immunities / vulnerabilities. Claims come from the
// character's manual toggles (damageStates) and from invested nodes' resources
// named e.g. "Resistance: Fire", "Immunity: Fire" or "Vulnerability: Fire".
// Returns { states, claims }: states maps damage type → final state
// ("resist" | "immune" | "vuln"), with immunity and vulnerability overriding
// resistance; claims keeps where each type's claims came from.
const DMG_KIND_PREFIXES = [
  ["vulnerability:", "vuln"],
  ["vulnerable to:", "vuln"],
  ["immunity:", "immune"],
  ["immune to:", "immune"],
  ["resistance:", "resist"],
  ["resistant to:", "resist"],
];

export function damageAffinities(character, tree = null, lib = null) {
  const claims = {};
  // Canonical damage-type names: library casing wins, then an existing claim.
  const canon = (t) => {
    const raw = String(t || "").trim();
    if (!raw) return "";
    const libHit = (lib?.damageTypes || []).find(
      (d) => String(d || "").toLowerCase() === raw.toLowerCase()
    );
    if (libHit) return libHit;
    const existing = Object.keys(claims).find((k) => k.toLowerCase() === raw.toLowerCase());
    return existing || raw;
  };
  const add = (type, kind, from) => {
    const t = canon(type);
    if (!t) return;
    const c = (claims[t] = claims[t] || { resist: false, immune: false, vuln: false, from: {} });
    c[kind] = true;
    c.from[from] = true;
  };
  (tree?.nodes || []).forEach((n) => {
    if ((n.currentPoints || 0) <= 0) return;
    (n.resources || []).forEach((r) => {
      const name = String(r?.name || "").trim().toLowerCase();
      for (const [p, kind] of DMG_KIND_PREFIXES) {
        if (name.startsWith(p)) {
          const raw = name.slice(p.length).trim();
          const match = Object.keys(claims).find((k) => k.toLowerCase() === raw);
          add(match || raw, kind, "talent");
        }
      }
    });
  });
  Object.entries(character?.damageStates || {}).forEach(([type, kind]) => {
    if (kind && kind !== "none") add(type, kind, "manual");
  });
  const states = {};
  Object.entries(claims).forEach(([t, c]) => {
    states[t] = c.vuln ? "vuln" : c.immune ? "immune" : c.resist ? "resist" : "none";
  });
  return { states, claims };
}