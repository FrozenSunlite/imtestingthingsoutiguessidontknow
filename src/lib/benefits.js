// Node benefits: a small category-aware library of things a talent grants.
// Entries are stored on the node as { id, category, name, source, description, image }.
// The editor can add them from a select or by dropping Reference Library entries.
export const BENEFIT_CATEGORIES = [
  { id: "spell", label: "Spells" },
  { id: "equipment", label: "Equipment" },
  { id: "upgrade", label: "Upgrades" },
  { id: "armor", label: "Armor" },
  { id: "attribute", label: "Attributes" },
  { id: "skill", label: "Skill Proficiencies" },
  { id: "tool", label: "Tool Proficiencies" },
  { id: "language", label: "Languages" },
  { id: "speed", label: "Speeds" },
  { id: "sense", label: "Senses" },
  { id: "resource", label: "Resources" },
  { id: "stat", label: "Character Stats" },
  { id: "table", label: "Tables" },
];

const names = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) => (typeof item === "string" ? item : item?.name))
    .filter(Boolean);

const STAT_OPTIONS = [
  "Hit Points",
  "Armor Class",
  "Exhaustion",
  "Proficiency Bonus",
  "Initiative",
  "Speed",
  "Saving Throws",
  "Temp HP",
];

// Suggested names for the "add from library" select. The editor still allows
// typing any name, and drops can carry anything.
export function benefitOptions(settings, category) {
  const lib = settings?.library || {};
  switch (category) {
    case "spell":
      return names(lib.spells);
    case "equipment":
      return [
        ...names(lib.weapons),
        ...names(lib.armor),
        ...names(lib.adventuringGear),
      ];
    case "upgrade":
      return names(lib.weaponUpgrades);
    case "armor":
      return names(lib.armor);
    case "attribute":
      return names(lib.attributes);
    case "skill":
      return names(lib.lists?.skills);
    case "tool":
      return [
        ...names(lib.lists?.tools),
        ...names(lib.lists?.artisanTools),
        ...names(lib.lists?.gamingSets),
        ...names(lib.lists?.miscTools),
        ...names(lib.lists?.instruments),
      ];
    case "language":
      return names(lib.lists?.languages);
    case "speed":
      return names(lib.speedTypes);
    case "sense":
      return names(lib.senses);
    case "resource":
      return names(lib.resources);
    case "stat":
      return STAT_OPTIONS;
    default:
      return [];
  }
}

export const BENEFIT_CATEGORY_FOR_5E = {
  spells: "spell",
  items: "equipment",
  languages: "language",
  skills: "skill",
  senses: "sense",
  tables: "table",
  backgrounds: "other",
  species: "other",
  feats: "other",
  conditions: "other",
  actions: "other",
};

export const LEVEL_MODES = [
  { id: "any", label: "Any level" },
  { id: "equal", label: "Equal to" },
  { id: "upTo", label: "Up to" },
  { id: "below", label: "Below" },
  { id: "equalOrGreater", label: "Equal or greater" },
  { id: "equalOrLesser", label: "Equal or lesser" },
];

export const TABLE_SAVE_MODES = [
  { id: "any", label: "Any" },
  { id: "save", label: "Saving Throw" },
  { id: "attack", label: "Spell Attack" },
  { id: "neither", label: "Neither" },
];

export const TABLE_RANGE_MODES = [
  { id: "any", label: "Any" },
  { id: "melee", label: "Melee" },
  { id: "ranged", label: "Ranged" },
  { id: "neither", label: "Neither" },
];

const numLevel = (spell) => {
  const raw = spell?.level ?? spell?.spellLevel ?? spell?.lvl;
  if (raw === "cantrip" || raw === "0") return 0;
  return Number(raw) || 0;
};

const text = (value) => String(value ?? "").toLowerCase();

// Filter library spells for a table. Optional fields are skipped when the
// source entry doesn't carry them, so name-only libraries still work for
// coarse tables.
export function filterSpells(spells, filters = {}) {
  const list = (Array.isArray(spells) ? spells : []).map((s) =>
    typeof s === "string" ? { name: s } : s
  );
  return list.filter((s) => {
    if (!s?.name) return false;
    if (filters.schools?.length) {
      const school = text(s.school || s.School);
      if (!filters.schools.some((x) => school.includes(text(x)))) return false;
    }
    if (filters.levelMode && filters.levelMode !== "any" && filters.level !== "" && filters.level != null) {
      const want = Number(filters.level) || 0;
      const lvl = numLevel(s);
      if (filters.levelMode === "equal" && lvl !== want) return false;
      if (filters.levelMode === "upTo" && lvl > want) return false;
      if (filters.levelMode === "below" && lvl >= want) return false;
      if (filters.levelMode === "equalOrGreater" && lvl < want) return false;
      if (filters.levelMode === "equalOrLesser" && lvl > want) return false;
    }
    const check = (field, query) => {
      if (!query) return true;
      const hay = text(s[field]);
      return !hay || hay.includes(text(query));
    };
    if (!check("subschool", filters.subschool)) return false;
    if (!check("castingTime", filters.castingTime) && !check("time", filters.castingTime)) return false;
    if (!check("duration", filters.duration)) return false;
    if (!check("target", filters.target)) return false;
    if (!check("area", filters.area)) return false;
    if (!check("effect", filters.effect)) return false;
    if (!check("materials", filters.materials) && !check("components", filters.materials)) return false;
    if (filters.save && filters.save !== "any") {
      const hasSave = !!(s.save || s.savingThrow);
      const hasAttack = !!(s.spellAttack || s.attack);
      if (filters.save === "save" && !hasSave) return false;
      if (filters.save === "attack" && !hasAttack) return false;
      if (filters.save === "neither" && (hasSave || hasAttack)) return false;
    }
    if (filters.range && filters.range !== "any") {
      const range = text(s.range || s.rangeType);
      const melee = /melee|touch|self/.test(range);
      const ranged = /ranged|feet|foot|mile/.test(range) && !melee;
      if (filters.range === "melee" && !melee) return false;
      if (filters.range === "ranged" && !ranged) return false;
      if (filters.range === "neither" && (melee || ranged)) return false;
    }
    return true;
  });
}

export function tableOptions(table, spells) {
  if (!table) return [];
  if (table.source === "custom") {
    return String(table.optionsText || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return filterSpells(spells, table.filters || []).map((s) => s.name);
}

export function tableSummary(table, spells) {
  if (!table) return "";
  const options = tableOptions(table, spells);
  const how =
    table.mode === "roll"
      ? `Roll ${table.die || "d20"}`
      : `Choose ${Number(table.count) || 1}`;
  const source =
    table.source === "custom"
      ? `${options.length} option${options.length === 1 ? "" : "s"}`
      : `${options.length} matching spell${options.length === 1 ? "" : "s"}`;
  return `${how} from ${source}`;
}

export function benefitLabel(category) {
  return BENEFIT_CATEGORIES.find((c) => c.id === category)?.label || "Benefits";
}

export function benefitId() {
  return `bnf${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}

export function collectNodeBenefits(tree) {
  const out = [];
  const seen = new Set();
  const walk = (nodes) => {
    for (const n of nodes || []) {
      (n.subtrees || []).forEach((st) => walk(st.nodes));
      if ((Number(n.currentPoints) || 0) <= 0) continue;
      for (const b of n.benefits || []) {
        const key = `${b.category}|${String(b.name || "").toLowerCase()}`;
        if (!b.name || seen.has(key)) continue;
        seen.add(key);
        out.push(b);
      }
    }
  };
  walk(tree?.nodes);
  return out;
}
