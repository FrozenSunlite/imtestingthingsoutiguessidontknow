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
