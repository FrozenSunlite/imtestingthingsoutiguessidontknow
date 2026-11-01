// Skill & check system: ability assignments, auto-calculated d20 modifiers
// (proficiency, expertise, custom bonuses, exhaustion) and DC helpers.

export const STATS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

// D&D 5e defaults: each skill's governing ability.
export const DEFAULT_SKILL_ABILITIES = {
  Acrobatics: "DEX",
  "Animal Handling": "WIS",
  Arcana: "INT",
  Athletics: "STR",
  Deception: "CHA",
  History: "INT",
  Insight: "WIS",
  Intimidation: "CHA",
  Investigation: "INT",
  Medicine: "WIS",
  Nature: "INT",
  Perception: "WIS",
  Performance: "CHA",
  Persuasion: "CHA",
  Religion: "WIS",
  "Sleight of Hand": "DEX",
  Stealth: "DEX",
  Survival: "WIS",
  Technology: "INT",
};

// Standard DC ladder for the dice roller.
export const DC_LADDER = [
  ["Very easy", 5],
  ["Easy", 10],
  ["Medium", 15],
  ["Hard", 20],
  ["Very hard", 25],
  ["Nearly impossible", 30],
];

// Ability modifier: a score of 0 counts as a drained score (−5), not "unset".
export function abilityMod(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return 0;
  return Math.floor((s - 10) / 2);
}

export const modFmt = (n) => (n >= 0 ? `+${n}` : `${n}`);

// A score of 0 is a real drained score (−5 modifier) — only missing data
// falls back to the 10 default.
export function statOr10(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 10;
}

// Normalize a library list entry — older saves store plain name strings.
// Skills default to their D&D ability when none is assigned.
export function normalizeListEntry(e, kind = "other") {
  const name = typeof e === "string" ? e : e?.name || "";
  const rawAb = typeof e === "string" ? "" : e?.ability || "";
  const assigned = rawAb && rawAb !== "—" ? rawAb : "";
  const ability = assigned || (kind === "skill" ? DEFAULT_SKILL_ABILITIES[name] || "" : "");
  return { name, ability };
}

// Check options grouped for a picker: library skills, all tool lists,
// instruments. Abilities are handled separately by the caller.
export function checkOptions(settings) {
  const lists = settings?.library?.lists || {};
  const norm = (arr, kind) =>
    (arr || []).map((e) => normalizeListEntry(e, kind)).filter((e) => e.name);
  return {
    skills: norm(lists.skills, "skill"),
    tools: [
      ...norm(lists.tools, "tool"),
      ...norm(lists.artisanTools, "tool"),
      ...norm(lists.gamingSets, "tool"),
      ...norm(lists.miscTools, "tool"),
    ],
    instruments: norm(lists.instruments, "instrument"),
  };
}

// Proficiency lookup for one check.
export function profEntryFor(character, group, name) {
  const key = { skill: "skills", tool: "tools", instrument: "instruments" }[group];
  if (!key || !name) return null;
  return ((character?.proficiencies || {})[key] || []).find((p) => p.name === name) || null;
}

// d20 check modifier for one option:
//   effective ability modifier + proficiency bonus when proficient
//   (doubled with Expertise) + the entry's custom bonus − 2 per exhaustion
//   stage (the sheet's d20-test penalty).
export function checkBonus({ option, group, character, profBonus, effAbilityMod }) {
  const entry = profEntryFor(character, group, option?.name);
  const prof = !!entry && (entry.times ?? 1) > 0;
  const expertise = prof && !!entry.expertise;
  const custom = Number(entry?.bonus) || 0;
  const exhaustion = Math.max(0, Math.min(6, Number(character?.exhaustion) || 0));
  const exPenalty = 2 * exhaustion;
  const total =
    (Number(effAbilityMod) || 0) +
    (prof ? (Number(profBonus) || 0) * (expertise ? 2 : 1) : 0) +
    custom -
    exPenalty;
  return { total, prof, expertise, custom, exPenalty, ability: option?.ability || "" };
}

// Spell save DC: 8 + proficiency + the casting ability's effective modifier.
export function spellSaveDC({ profBonus, effAbilityMod }) {
  return 8 + (Number(profBonus) || 0) + (Number(effAbilityMod) || 0);
}

// Parse a dice expression like "1d4" or "2d6" (a talent's extra check dice).
export function parseDice(expr) {
  const m = /^(\d{1,2})\s*d\s*(\d{1,3})$/i.exec(String(expr || "").trim());
  if (!m) return null;
  return {
    count: Math.max(1, Math.min(20, Number(m[1]))),
    size: Math.max(2, Math.min(100, Number(m[2]))),
  };
}

// Xanathar's-style tool↔skill pairings: a tool-proficient character who is
// also proficient in a related skill rolls that tool's checks with advantage.
export const TOOL_SKILL_PAIRS = {
  "Alchemist's Supplies": ["Arcana", "Medicine", "History"],
  "Brewer's Supplies": ["Medicine", "Persuasion", "Nature"],
  "Calligrapher's Supplies": ["Deception", "History"],
  "Carpenter's Tools": ["History", "Investigation"],
  "Cartographer's Tools": ["Nature", "Survival"],
  "Cobbler's Tools": ["Deception", "Persuasion"],
  "Cook's Utensils": ["Medicine", "Nature", "Survival"],
  "Glassblower's Tools": ["Arcana", "History"],
  "Jeweler's Tools": ["Investigation", "Sleight of Hand"],
  "Leatherworker's Tools": ["Stealth", "Survival"],
  "Mason's Tools": ["History", "Investigation"],
  "Painter's Supplies": ["Deception", "Investigation"],
  "Potter's Tools": ["Arcana", "History"],
  "Smith's Tools": ["History", "Investigation"],
  "Tinker's Tools": ["History", "Investigation"],
  "Weaver's Tools": ["Deception", "Sleight of Hand"],
  "Woodcarver's Tools": ["Nature", "Survival"],
  "Disguise Kit": ["Deception", "Performance"],
  "Forgery Kit": ["Deception", "History"],
  "Thieves' Tools": ["Investigation", "Sleight of Hand", "Stealth"],
  "Herbalism Kit": ["Medicine", "Nature", "Survival"],
  "Navigator's Tools": ["Nature", "Survival"],
};

// Which related skills the character is proficient in for this tool check
// (drives the synergy-advantage rule above).
export function toolSynergy({ option, character }) {
  const related = TOOL_SKILL_PAIRS[option?.name] || [];
  if (!related.length) return [];
  const skills = ((character?.proficiencies || {}).skills || []).filter(
    (p) => (p.times ?? 1) > 0
  );
  return related.filter((s) => skills.some((p) => p.name === s));
}

// Which rolls a bonus-dice entry applies to. A roll context describes the roll
// being made:
//   {type: "attack", ability, weapon: {name, category, properties} | null}
//   {type: "save", ability, spell: {name, school, level} | null}
//   {type: "check", group: "ability"|"skill"|"tool"|"instrument", name, ability}
// A bonus entry is either the legacy compact form
//   {target: "skill:Perception", dice}
// or the full form:
//   {dice, roll: "attack"|"save"|"check", scope: "all"|"ability"|"skill"|"tool"|
//    "instrument"|"weapon"|"spell", ability, skill, tool, instrument,
//    weapon: {by: "category"|"property", category, property, all, names},
//    spell: {by: "school"|"level", school, level, all, names}}
export function bonusMatchesRoll(b, ctx = {}) {
  if (!b) return false;
  if (b.target !== undefined) {
    // Legacy compact targets.
    const t = b.target;
    if (t === "attack") return ctx.type === "attack";
    if (t.startsWith("save:")) return ctx.type === "save" && ctx.ability === t.slice(5);
    if (t.startsWith("ability:"))
      return ctx.type === "check" && ctx.group === "ability" && ctx.name === t.slice(8);
    const sep = t.indexOf(":");
    if (sep > 0)
      return ctx.type === "check" && ctx.group === t.slice(0, sep) && ctx.name === t.slice(sep + 1);
    return false;
  }
  if ((b.roll || "attack") !== ctx.type) return false;
  const scope = b.scope || "all";
  if (scope === "all") return true;
  if (scope === "ability") return !!ctx.ability && ctx.ability === b.ability;
  if (scope === "skill") return ctx.type === "check" && ctx.group === "skill" && ctx.name === b.skill;
  if (scope === "tool") return ctx.type === "check" && ctx.group === "tool" && ctx.name === b.tool;
  if (scope === "instrument")
    return ctx.type === "check" && ctx.group === "instrument" && ctx.name === b.instrument;
  if (scope === "weapon") {
    if (ctx.type !== "attack" || !ctx.weapon) return false;
    const w = b.weapon || {};
    if ((w.by || "category") === "category") {
      if ((ctx.weapon.category || "") !== (w.category || "")) return false;
    } else if (!(ctx.weapon.properties || []).includes(w.property)) {
      return false;
    }
    return !!w.all || (w.names || []).includes(ctx.weapon.name);
  }
  if (scope === "spell") {
    if (!ctx.spell) return false;
    const sp = b.spell || {};
    if ((sp.by || "school") === "school") {
      if ((ctx.spell.school || "") !== (sp.school || "")) return false;
    } else if ((ctx.spell.level || "cantrip") !== (sp.level || "cantrip")) {
      return false;
    }
    return !!sp.all || (sp.names || []).includes(ctx.spell.name);
  }
  return false;
}

// Extra dice invested talent nodes add to rolls matching their targeting.
export function talentBonusDice(tree, ctx) {
  const out = [];
  (tree?.nodes || []).forEach((n) => {
    if ((n.currentPoints || 0) <= 0) return;
    (n.bonusDice || []).forEach((b) => {
      const parsed = parseDice(b?.dice);
      if (parsed && bonusMatchesRoll(b, ctx)) out.push(parsed);
    });
  });
  return out;
}

// Ability-score prerequisites: [{ stat, min }] checked against the
// character's effective scores (base + attribute bonuses + manual modifier).
export function abilityReqStatus(reqs, stats, abilityMods = {}) {
  const missing = [];
  (reqs || []).forEach((r) => {
    if (!r?.stat) return;
    const need = Number(r.min) || 0;
    const have = statOr10(stats?.[r.stat]) + (Number(abilityMods?.[r.stat]) || 0);
    if (have < need) missing.push(`${r.stat} ${need}+ (have ${have})`);
  });
  return { ok: missing.length === 0, missing };
}