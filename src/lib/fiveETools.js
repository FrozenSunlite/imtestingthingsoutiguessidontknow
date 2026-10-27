// Local 5eTools Reference Index: category-to-file mapping, entry extraction and
// normalisers for the data the main library can consume directly.

export const FIVE_CATEGORIES = [
  { id: "rulesGlossary", label: "Rules Glossary", files: ["variantrules.json", "actions.json", "conditionsdiseases.json", "senses.json", "skills.json"] },
  { id: "tables", label: "Tables", files: ["tables.json"], dirs: ["generated"] },
  { id: "books", label: "Books", files: ["books.json"], dirs: ["book"] },
  { id: "classes", label: "Classes", dirs: ["class"], kind: "classes" },
  { id: "backgrounds", label: "Backgrounds", files: ["backgrounds.json"] },
  { id: "feats", label: "Feats", files: ["feats.json"], kind: "feats" },
  { id: "species", label: "Species", files: ["races.json"] },
  { id: "charOptions", label: "Other Character Creation Options", files: ["charcreationoptions.json"], kind: "options" },
  { id: "optionalFeatures", label: "Other Options & Features", files: ["optionalfeatures.json"], kind: "options" },
  { id: "statGen", label: "Stat Generator", files: ["msbcr.json"] },
  { id: "life", label: "This Is Your Life", files: ["life.json"] },
  { id: "names", label: "Names", files: ["names.json"] },
  { id: "adventures", label: "Adventures", files: ["adventures.json"], dirs: ["adventure"] },
  { id: "cults", label: "Cults & Supernatural Boons", files: ["cultsboons.json"] },
  { id: "objects", label: "Objects", files: ["objects.json"] },
  { id: "traps", label: "Traps & Hazards", files: ["trapshazards.json"] },
  { id: "encounterGen", label: "Encounter Generator", files: ["encounters.json", "encounterbuilder.json"] },
  { id: "lootGen", label: "Loot Generator", files: ["loot.json"] },
  { id: "actions", label: "Actions", files: ["actions.json"] },
  { id: "bastions", label: "Bastions", files: ["bastions.json"] },
  { id: "bestiary", label: "Bestiary", dirs: ["bestiary"], kind: "monsters" },
  { id: "conditions", label: "Conditions & Diseases", files: ["conditionsdiseases.json"] },
  { id: "decks", label: "Decks", files: ["decks.json"] },
  { id: "deities", label: "Deities", files: ["deities.json"] },
  { id: "items", label: "Items", files: ["items.json", "items-base.json", "magicvariants.json"] },
  { id: "languages", label: "Languages", files: ["languages.json"] },
  { id: "gifts", label: "Supernatural Gifts & Rewards", files: ["rewards.json"] },
  { id: "psionics", label: "Psionics", files: ["psionics.json"] },
  { id: "spells", label: "Spells", dirs: ["spells"], kind: "spells" },
  { id: "vehicles", label: "Vehicles", files: ["vehicles.json"] },
];

const ENTRY_KEYS = [
  "monster", "spell", "item", "baseitem", "class", "subclass", "background", "feat",
  "race", "subrace", "table", "book", "adventure", "condition", "disease", "deity",
  "vehicle", "object", "trap", "hazard", "reward", "boon", "psionic", "deck",
  "action", "language", "name", "encounter", "loot", "bastion", "recipe", "homecraft",
  "charoption", "optionalfeature", "variantrule", "sense", "skill", "classFeature",
  "subclassFeature", "magicvariant", "cult", "supernaturalBoon",
];

export function filesForCategory(category, files) {
  if (!category) return [];
  const dirs = category.dirs || [];
  const names = new Set(category.files || []);
  return (files || []).filter((f) => {
    if (names.has(f.path) || names.has(f.name)) return true;
    return dirs.some((d) => f.path === d || f.path.startsWith(`${d}/`));
  });
}

export function entriesFromRaw(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  if (Array.isArray(raw.data)) return raw.data;
  // Items files carry both finished items and base items.
  if (Array.isArray(raw.item) || Array.isArray(raw.baseitem))
    return [...(raw.item || []), ...(raw.baseitem || [])];
  if (Array.isArray(raw.class) || Array.isArray(raw.subclass))
    return [...(raw.class || []), ...(raw.subclass || [])];
  for (const key of ENTRY_KEYS) {
    if (Array.isArray(raw[key])) return raw[key];
  }
  if (raw.name) return [raw];
  return [];
}

export const entryName = (entry) =>
  String(entry?.name || entry?.title || entry?.caption || entry?.abbreviation || "Untitled");

export const entrySource = (entry) =>
  [entry?.source, entry?.page ? `p.${entry.page}` : ""].filter(Boolean).join(" ");

export const entryMeta = (entry) => {
  const bits = [];
  if (entry?.cr) bits.push(`CR ${entry.cr}`);
  if (entry?.level != null) bits.push(entry.level === 0 ? "Cantrip" : `Level ${entry.level}`);
  if (entry?.school) bits.push(String(entry.school).toUpperCase());
  if (entry?.type && typeof entry.type === "string") bits.push(entry.type);
  if (entry?.rarity) bits.push(entry.rarity);
  if (entry?.className) bits.push(entry.className);
  if (entry?.level && entry?.className) bits.push(`Level ${entry.level}`);
  bits.push(entrySource(entry));
  return bits.filter(Boolean).join(" · ");
};

const textOf = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join("\n");
  if (typeof value === "object") {
    if (value.entries) return textOf(value.entries);
    if (value.items) return Object.values(value.items).map(textOf).filter(Boolean).join("\n");
    if (value.name) return String(value.name);
    return "";
  }
  return String(value);
};

export function entryText(entry) {
  if (!entry) return "";
  const parts = [entry.entries, entry.higherLevel, entry.description, entry.text, entry.fluff]
    .map(textOf)
    .filter(Boolean);
  return parts.join("\n\n");
}

export function entryPreview(entry) {
  return entryText(entry).replace(/\{[^}]+\}/g, "").trim().slice(0, 500);
}

const spellSchool = (code) => {
  const map = { A: "Abjuration", C: "Conjuration", D: "Divination", E: "Enchantment", I: "Illusion", N: "Necromancy", T: "Transmutation", V: "Evocation" };
  return map[String(code || "").toUpperCase()] || code || "";
};

const spellTime = (time) => {
  if (Array.isArray(time)) return time.map((t) => `${t.number || 1} ${t.unit || "action"}`).join(", ");
  if (time && typeof time === "object") return `${time.number || 1} ${time.unit || "action"}`;
  return textOf(time);
};

const spellRange = (range) => {
  if (!range) return "";
  if (typeof range === "string") return range;
  if (range.type === "point" && range.distance) {
    const d = range.distance;
    if (d.type === "feet" || d.type === "miles") {
      const amount = Number(d.amount) || 0;
      return d.type === "feet" ? `${Math.round((amount / 5) * 10) / 10} spaces` : `${amount} miles`;
    }
    return d.type || "";
  }
  return range.type || "";
};

const spellComponents = (components) => {
  if (!components) return { v: true, s: true, m: false, items: "", cost: "", consumed: false };
  return {
    v: !!components.v,
    s: !!components.s,
    m: !!components.m,
    items: typeof components.m === "string" ? components.m : textOf(components.m),
    cost: Number(components.m && typeof components.m === "object" ? components.m.cost : 0) || "",
    consumed: !!(components.m && typeof components.m === "object" && components.m.consume),
  };
};

// A 5eTools spell mapped into the Spells tab's schema.
export function spellToLibrary(s) {
  const comp = spellComponents(s.components);
  return {
    name: s.name || "",
    level: s.level === 0 ? "cantrip" : String(s.level ?? ""),
    school: spellSchool(s.school),
    subschool: "",
    repeats: "",
    castingTime: spellTime(s.time),
    range: spellRange(s.range),
    duration: textOf(s.duration),
    saveType: s.savingThrow ? "save" : "none",
    saveAbility: Array.isArray(s.savingThrow) ? s.savingThrow.join(", ") : s.savingThrow || "",
    attackKind: s.attack ? "spell" : "",
    attackMod: "spellcasting",
    attackAbility: "STR",
    targets: textOf(s.targets),
    aoe: "",
    v: comp.v,
    s: comp.s,
    m: comp.m,
    materialCost: comp.cost,
    materialItems: comp.items,
    materialConsumed: comp.consumed,
    aoeShape: "",
    aoeSize: "",
    aoeMeasure: "radius",
    upcast: textOf(s.higherLevel),
    upcastScaling: [],
    scaling: [],
    description: textOf(s.entries),
    flavor: textOf(s.fluff),
  };
}

// Feature list for a class/subclass/feat/option entry. When `raw` is the
// containing file, class and subclass features are pulled from its top-level
// arrays.
export function featuresForEntry(categoryId, entry, raw) {
  const text = (e) => ({ name: e.name || "", text: entryText(e) });
  if (categoryId === "feats" || categoryId === "charOptions" || categoryId === "optionalFeatures") {
    return [text(entry)];
  }
  if (categoryId !== "classes") return [];
  const isSubclass = !!entry.shortName || !!entry.subclassShortName;
  const features = isSubclass
    ? (raw?.subclassFeature || []).filter(
        (f) =>
          f.className === entry.className &&
          (f.subclassShortName === entry.shortName || f.subclassShortName === entry.subclassShortName)
      )
    : (raw?.classFeature || []).filter(
        (f) => f.className === entry.name && f.classSource === entry.source
      );
  features.sort((a, b) => (Number(a.level) || 0) - (Number(b.level) || 0));
  return features.map(text).filter((f) => f.name);
}
