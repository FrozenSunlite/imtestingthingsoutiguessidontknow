// Local 5eTools Reference Index: category-to-file mapping, entry extraction and
// normalisers for the data the main library can consume directly.

export const FIVE_CATEGORIES = [
  { id: "rulesGlossary", label: "Rules Glossary", files: ["variantrules.json"] },
  { id: "tables", label: "Tables", files: ["tables.json", "generated/gendata-tables.json"], kind: "tables" },
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
  { id: "actions", label: "Actions", files: ["actions.json"], kind: "actions" },
  { id: "bastions", label: "Bastions", files: ["bastions.json"] },
  { id: "bestiary", label: "Bestiary", dirs: ["bestiary"], kind: "monsters" },
  { id: "conditions", label: "Conditions & Diseases", files: ["conditionsdiseases.json"], kind: "conditions" },
  { id: "senses", label: "Senses", files: ["senses.json"], kind: "senses" },
  { id: "skills", label: "Skills", files: ["skills.json"], kind: "skills" },
  { id: "decks", label: "Decks", files: ["decks.json"] },
  { id: "deities", label: "Deities", files: ["deities.json"] },
  { id: "items", label: "Items", files: ["items.json", "items-base.json", "magicvariants.json"], kind: "items" },
  { id: "languages", label: "Languages", files: ["languages.json"], kind: "languages" },
  { id: "gifts", label: "Supernatural Gifts & Rewards", files: ["rewards.json"] },
  { id: "psionics", label: "Psionics", files: ["psionics.json"] },
  { id: "spells", label: "Spells", dirs: ["spells"], kind: "spells" },
  { id: "vehicles", label: "Vehicles", files: ["vehicles.json"], kind: "vehicles" },
];

const ENTRY_KEYS = [
  "monster", "spell", "item", "baseitem", "class", "subclass", "background", "feat",
  "race", "subrace", "table", "book", "adventure", "condition", "disease", "deity",
  "vehicle", "object", "trap", "hazard", "reward", "boon", "psionic", "deck",
  "action", "language", "name", "encounter", "loot", "bastion", "recipe", "homecraft",
  "charoption", "optionalfeature", "variantrule", "sense", "skill", "classFeature",
  "subclassFeature", "magicvariant", "cult", "supernaturalBoon",
];

// Source files that contain importable entries. Fluff, foundry and index
// files are not useful in the Reference Index and only clutter the file list.
export function isSourceFile(path) {
  const p = String(path || "").toLowerCase();
  if (!p.endsWith(".json")) return false;
  if (/(^|\/)(fluff-.+|foundry(-.+)?|index|sources)\.json$/.test(p)) return false;
  if (/(^|\/)(changelog|makebrew-creature|renderdemo|converter|makecards)\.json$/.test(p)) return false;
  return true;
}

export function filesForCategory(category, files) {
  if (!category) return [];
  const dirs = category.dirs || [];
  const names = new Set(category.files || []);
  return (files || []).filter((f) => {
    if (!isSourceFile(f.path)) return false;
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
  if (Array.isArray(raw.condition) || Array.isArray(raw.disease) || Array.isArray(raw.status))
    return [...(raw.condition || []), ...(raw.disease || []), ...(raw.status || [])];
  if (Array.isArray(raw.cult) || Array.isArray(raw.boon))
    return [...(raw.cult || []), ...(raw.boon || [])];
  if (Array.isArray(raw.vehicle) || Array.isArray(raw.vehicleUpgrade))
    return [...(raw.vehicle || []), ...(raw.vehicleUpgrade || [])];
  if (Array.isArray(raw.deck) || Array.isArray(raw.card))
    return [...(raw.deck || []), ...(raw.card || [])];
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

const TAG_ATK = {
  mw: "Melee Weapon Attack",
  rw: "Ranged Weapon Attack",
  ms: "Melee Spell Attack",
  rs: "Ranged Spell Attack",
};

// Turn a single 5eTools inline tag ({@b text}, {@damage 1d6}, {@hit 5}…) into
// readable text. Unknown tags keep their first argument rather than dumping
// markup into the preview.
function tagText(tag, args) {
  const first = args.split("|")[0].trim();
  switch (tag) {
    case "hit": {
      const n = Number(first);
      return Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n}` : first;
    }
    case "dc":
      return `DC ${first}`;
    case "atk":
      return first
        .split(",")
        .map((k) => TAG_ATK[k.trim()] || k.trim())
        .filter(Boolean)
        .join(" or ");
    case "recharge":
      if (!first) return "Recharge";
      return first === "6" ? "Recharge 6" : `Recharge ${first}–6`;
    case "chance":
      return `${first} chance`;
    case "d20":
    case "d100":
      return `d${tag.slice(1)}${first && first !== "1" ? ` (${first})` : ""}`;
    case "note":
    case "comic":
    case "adventureBook":
      return first;
    case "link":
      return first;
    case "scaledice":
    case "scaledamage":
      return args.split("|")[0].trim();
    case "filter":
      return first.replace(/^.*?=/, "");
    case "footnote":
    case "sup":
    case "sub":
      return first;
    default:
      return first;
  }
}

// Remove 5eTools inline markup, including nested tags such as
// {@note text {@b more}}. Newlines are preserved.
export function fiveText(value) {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    let out = "";
    let i = 0;
    const s = value;
    while (i < s.length) {
      const start = s.indexOf("{@", i);
      if (start < 0) {
        out += s.slice(i);
        break;
      }
      out += s.slice(i, start);
      let depth = 1;
      let j = start + 2;
      while (j < s.length && depth > 0) {
        if (s[j] === "{") depth += 1;
        else if (s[j] === "}") depth -= 1;
        j += 1;
      }
      const inner = s.slice(start + 2, j - 1);
      const m = inner.match(/^([^\s]+)\s*([\s\S]*)$/);
      if (!m) {
        out += inner;
      } else {
        out += tagText(m[1].toLowerCase(), m[2]);
      }
      i = j;
    }
    return out;
  }
  if (Array.isArray(value)) return value.map(fiveText).filter(Boolean).join("\n");
  if (typeof value === "object") {
    if (value.type === "table" || value.type === "tableGroup") {
      return tableRowsText(value);
    }
    if (value.type === "list") {
      return (value.items || []).map((it) => `• ${fiveText(it)}`).join("\n");
    }
    if (value.type === "options") {
      return [value.name, ...(value.entries || [])].map(fiveText).filter(Boolean).join("\n");
    }
    if (value.type === "inset" || value.type === "insetReadaloud") {
      return [value.name, ...(value.entries || [])].map(fiveText).filter(Boolean).join("\n");
    }
    if (value.type === "quote") {
      return [value.byline ? `“${value.byline}”` : "", ...(value.entries || [])]
        .map(fiveText)
        .filter(Boolean)
        .join("\n");
    }
    if (value.entries) return fiveText(value.entries);
    if (value.items) return Object.values(value.items).map(fiveText).filter(Boolean).join("\n");
    if (value.name && value.description) return `${value.name}: ${fiveText(value.description)}`;
    if (value.name) return String(value.name);
    if (value.description) return fiveText(value.description);
    if (value.entry) return fiveText(value.entry);
    return "";
  }
  return String(value);
}

function tableRowsText(table) {
  const columns = table.colLabels || [];
  const rows = (table.rows || []).map((row) =>
    (Array.isArray(row) ? row : [row]).map((cell) => fiveText(cell)).join(" | ")
  );
  return [columns.join(" | "), ...rows].filter(Boolean).join("\n");
}

const textOf = fiveText;

export function entryText(entry) {
  if (!entry) return "";
  const parts = [entry.entries, entry.higherLevel, entry.description, entry.text, entry.fluff]
    .map(fiveText)
    .filter(Boolean);
  return parts.join("\n\n");
}

export function entryPreview(entry) {
  return entryText(entry).replace(/\s+/g, " ").trim().slice(0, 500);
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
  const mat = components.m;
  return {
    v: !!components.v,
    s: !!components.s,
    m: !!mat,
    items:
      typeof mat === "string"
        ? mat
        : mat && typeof mat === "object"
          ? textOf(mat.text ?? mat.items ?? mat)
          : "",
    cost: Number(mat && typeof mat === "object" ? mat.cost : 0) || "",
    consumed: !!(mat && typeof mat === "object" && mat.consume),
  };
};

const UNIT = {
  action: "action", bonus: "bonus action", reaction: "reaction",
  round: "round", minute: "minute", hour: "hour", day: "day",
};

const spellDuration = (duration) => {
  if (!duration) return "";
  const one = (d) => {
    if (!d) return "";
    if (typeof d === "string") return fiveText(d);
    if (d.type === "instant") return "Instantaneous";
    if (d.type === "permanent") return "Permanent";
    if (d.type === "timed") {
      const amount = Number(d.duration?.amount) || 1;
      const unit = UNIT[d.duration?.type] || d.duration?.type || "";
      return `${amount} ${unit}${amount === 1 || unit.endsWith("s") ? "" : "s"}${d.concentration ? " (concentration)" : ""}`;
    }
    return fiveText(d.type || d);
  };
  return Array.isArray(duration) ? duration.map(one).filter(Boolean).join(", ") : one(duration);
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
    duration: spellDuration(s.duration),
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

const titleCase = (s) =>
  String(s || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

const gp = (cp) => {
  const n = Number(cp);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${Number((n / 100).toFixed(2))} gp`;
};

const diceParts = (text) => {
  const m = String(text || "").match(/^(\d*)d(\d+)$/i);
  if (!m) return { diceCount: 1, dieSize: "d6" };
  return { diceCount: Math.max(1, Number(m[1]) || 1), dieSize: `d${m[2]}` };
};

const DAMAGE_CODE = {
  A: "Acid", B: "Bludgeoning", C: "Cold", F: "Fire", O: "Force",
  L: "Lightning", N: "Necrotic", P: "Piercing", I: "Poison", Y: "Psychic",
  R: "Radiant", S: "Slashing", T: "Thunder",
};

const PROPERTY_CODE = {
  V: "Versatile", F: "Finesse", L: "Light", H: "Heavy", "2H": "Two-Handed",
  R: "Reach", T: "Thrown", A: "Ammunition", LD: "Loading", S: "Special",
  AF: "Ammunition", BF: "Burst Fire", C: "Special", D: "Special",
};

const codeOf = (entry) => {
  const raw = typeof entry?.type === "object" ? entry.type?.type : entry?.type;
  return String(raw || "").split("|")[0].trim();
};

// Normalise a 5eTools item (magic item or base item) into the matching
// Reference Library tab. Returns null for entries with no useful destination.
export function itemToLibrary(entry) {
  if (!entry || !entry.name) return null;
  const code = codeOf(entry);
  const rarity = String(entry.rarity || "none").toLowerCase();
  const magic = rarity !== "none" && rarity !== "varies";
  const baseName = String(entry.baseItem || "").split("|")[0];
  const description = [entryText(entry), fiveText(entry.additionalEntries)].filter(Boolean).join("\n\n");
  const cost = gp(entry.value);
  const common = { name: entry.name, cost, description };

  if (entry.poison) {
    const text = entryText(entry);
    const dc = String(text.match(/DC (\d+)/i)?.[1] || entry.dc || "");
    const damage = String(text.match(/(\d+d\d+)/i)?.[1] || "");
    const status = String(text.match(/the (\w+) condition/i)?.[1] || "");
    const duration = String(text.match(/for (\d+ (?:minute|hour|day|round)s?)/i)?.[1] || "");
    return {
      key: "poisons",
      value: {
        ...common,
        dc,
        damage,
        damageType: "Poison",
        status: titleCase(status),
        duration,
      },
    };
  }
  if (code === "EXP" || entry.explosive) {
    return {
      key: "explosives",
      value: { ...common, period: "Medieval", weight: Number(entry.weight) || 0 },
    };
  }

  // Magic weapons and armor live in Wondrous Items and link to a base item.
  if (magic && (code === "M" || code === "R" || code === "LA" || code === "MA" || code === "HA" || code === "S")) {
    const itemType = code === "M" || code === "R" ? "Weapon" : "Armor";
    return {
      key: "wondrousItems",
      value: {
        ...common,
        rarity: titleCase(rarity === "varies" ? "varies" : rarity),
        itemType,
        link: baseName,
        uses: entry.charges ?? "",
        recharge: entry.recharge || "",
        consumable: false,
      },
    };
  }

  if (code === "M" || code === "R") {
    const dice = diceParts(entry.dmg1);
    return {
      key: "weapons",
      value: {
        ...common,
        category: titleCase(entry.weaponCategory || (code === "R" ? "simple" : "martial")),
        attackType: code === "R" ? "ranged" : "melee",
        diceCount: dice.diceCount,
        dieSize: dice.dieSize,
        damageType: DAMAGE_CODE[String(entry.dmgType || "").toUpperCase()] || fiveText(entry.dmgType),
        properties: (entry.property || [])
          .map((p) => PROPERTY_CODE[String(p).split("|")[0].toUpperCase()] || fiveText(p))
          .filter(Boolean),
        weight: Number(entry.weight) || 0,
      },
    };
  }

  if (code === "LA" || code === "MA" || code === "HA" || code === "S") {
    const type = { LA: "Light", MA: "Medium", HA: "Heavy", S: "Shield" }[code];
    return {
      key: "armor",
      value: {
        ...common,
        type,
        requirement: entry.strength ? `STR ${entry.strength}` : "",
        acFlat: entry.ac ?? 0,
        acPlus: code === "LA" || code === "MA" ? "DEX" : "",
        stealthDisadvantage: !!entry.stealth,
        weight: Number(entry.weight) || 0,
      },
    };
  }

  if (code === "A" || code === "AF") {
    return {
      key: "ammo",
      value: {
        ...common,
        damage: entry.dmg1 ? `${entry.dmg1} ${DAMAGE_CODE[String(entry.dmgType || "").toUpperCase()] || ""}`.trim() : "",
        weight: Number(entry.weight) || 0,
        packSize: 20,
      },
    };
  }

  if (code === "VEH" || code === "SHP" || code === "AIR" || code === "SPC") {
    const category = { VEH: "Land", SHP: "Sea", AIR: "Sky", SPC: "Space" }[code] || "";
    return {
      key: "vehicles",
      value: {
        ...common,
        period: "Medieval",
        category,
        classification: fiveText(entry.vehicleType),
        speed: fiveText(entry.speed),
        carry: entry.capCargo ?? 0,
        weight: 0,
        size: fiveText(entry.size),
      },
    };
  }

  if (code === "TG" || code === "TB") {
    return { key: "tradeGoods", value: { ...common, period: "Medieval" } };
  }

  if (code === "P" || code === "SC" || code === "WD" || code === "RD" || code === "ST" || code === "RG" || magic) {
    const itemType = {
      P: "Potion", SC: "Scroll", WD: "Wand", RD: "Rod", ST: "Staff", RG: "Ring",
    }[code] || "Wondrous Item";
    return {
      key: "wondrousItems",
      value: {
        ...common,
        rarity: titleCase(rarity === "none" ? "common" : rarity),
        itemType,
        uses: entry.charges ?? "",
        recharge: entry.recharge || "",
        consumable: code === "P" || code === "SC",
        link: baseName,
      },
    };
  }

  if (code === "G" || code === "FD" || code === "SCF" || code === "INS" || code === "GS" || code === "T" || code === "MNT" || code === "TAH") {
    const category = {
      G: "Common Items", FD: "Food and Drink", SCF: "Arcane Focus", INS: "Instruments",
      GS: "Gaming Set", T: "Tools", MNT: "Mounts", TAH: "Tack and Harness",
    }[code] || "Common Items";
    return {
      key: "adventuringGear",
      value: {
        ...common,
        category,
        period: "Medieval",
        weight: Number(entry.weight) || 0,
        isContainer: false,
      },
    };
  }

  if (magic || entry.wondrous) {
    return {
      key: "wondrousItems",
      value: {
        ...common,
        rarity: titleCase(rarity === "none" ? "common" : rarity),
        itemType: "Wondrous Item",
        uses: entry.charges ?? "",
        recharge: entry.recharge || "",
        consumable: false,
      },
    };
  }

  return {
    key: "adventuringGear",
    value: {
      ...common,
      category: "Common Items",
      period: "Medieval",
      weight: Number(entry.weight) || 0,
      isContainer: false,
    },
  };
}

export function conditionToStatus(entry) {
  const text = entryText(entry);
  if (!entry?.name) return null;
  return {
    name: entry.name,
    kind: "condition",
    description: text.slice(0, 500),
    effects: text
      .split(/\n+/)
      .map((s) => s.trim())
      .filter((s) => s && !s.toLowerCase().startsWith(entry.name.toLowerCase()))
      .slice(0, 12),
  };
}

export function actionToLibrary(entry) {
  if (!entry?.name) return null;
  const time = fiveText(entry.time);
  const lower = time.toLowerCase();
  const category = lower.includes("bonus")
    ? "bonus"
    : lower.includes("reaction")
      ? "reaction"
      : lower.includes("free") || lower.includes("no action")
        ? "free"
        : "action";
  return {
    name: entry.name,
    description: entryText(entry),
    category,
    usesMode: "atwill",
  };
}

export function vehicleToLibrary(entry) {
  if (!entry?.name) return null;
  const terrain = String(entry.terrain || "").toLowerCase();
  const category = terrain.includes("sea") || terrain.includes("water")
    ? "Sea"
    : terrain.includes("air") || terrain.includes("sky")
      ? "Sky"
      : terrain.includes("space")
        ? "Space"
        : "Land";
  return {
    name: entry.name,
    period: "Medieval",
    category,
    classification: fiveText(entry.vehicleType),
    cost: "",
    speed: fiveText(entry.speed),
    carry: entry.capCargo ?? 0,
    weight: 0,
    size: fiveText(entry.size),
    description: entryText(entry),
  };
}

export function languageToLibrary(entry) {
  return entry?.name ? String(entry.name) : "";
}

export function skillToLibrary(entry) {
  if (!entry?.name) return null;
  return {
    name: entry.name,
    ability: String(entry.ability || "").toUpperCase(),
  };
}

export function senseToLibrary(entry) {
  if (!entry?.name) return null;
  return { name: entry.name, description: entryText(entry) };
}

export function tableToRollTable(entry) {
  if (!entry?.name && !entry?.caption) return null;
  const rows = (entry.rows || []).map((row) => {
    const cells = (Array.isArray(row) ? row : row?.row || [row])
      .map((cell) => {
        if (cell && typeof cell === "object") {
          if (cell.roll) {
            return cell.roll.exact != null
              ? String(cell.roll.exact)
              : `${cell.roll.min ?? ""}${cell.roll.max != null ? `–${cell.roll.max}` : ""}`;
          }
          return fiveText(cell.entry ?? cell.entries ?? cell.name ?? "");
        }
        return fiveText(cell);
      })
      .filter(Boolean);
    return {
      name: cells.join(" · "),
      category: "Table",
      price: "",
      currency: "gp",
      weight: 0,
      description: "",
      qty: 1,
    };
  }).filter((r) => r.name);
  return { name: entry.name || entry.caption || "Table", rows };
}

// Feature list for a class/subclass/feat/option entry. When `raw` is the
// containing file, class and subclass features are pulled from its top-level
// arrays. Each feature keeps its level and group so the importer can build a
// level-aligned class tab with subclass branches.
export function featuresForEntry(categoryId, entry, raw) {
  const text = (e, group) => ({
    name: String(e.name || ""),
    text: String(entryText(e) || ""),
    level: Number(e.level) || 0,
    group,
  });
  if (categoryId === "feats" || categoryId === "charOptions" || categoryId === "optionalFeatures") {
    return [text(entry, "Feature")];
  }
  if (categoryId !== "classes") return [];
  const isSubclass = !!entry.shortName || !!entry.subclassShortName;
  const sameSource = (f, source) => !source || !f.classSource || f.classSource === source;
  const features = isSubclass
    ? (raw?.subclassFeature || []).filter(
        (f) =>
          f.className === entry.className &&
          sameSource(f, entry.classSource) &&
          (f.subclassShortName === entry.shortName || f.subclassShortName === entry.subclassShortName)
      )
    : (raw?.classFeature || []).filter(
        (f) => f.className === entry.name && sameSource(f, entry.source)
      );
  features.sort((a, b) => (Number(a.level) || 0) - (Number(b.level) || 0));
  return features
    .map((f) => text(f, isSubclass ? entry.name : "Class"))
    .filter((f) => f.name);
}

// A class and the subclasses selected alongside it become one tab: base
// features form the main level ladder, each subclass branches from the level
// where it is gained.
export function featuresForClassBundle(base, subclasses = [], raw) {
  const list = featuresForEntry("classes", base, raw);
  (subclasses || []).forEach((sub) => {
    list.push(
      ...featuresForEntry("classes", sub, raw).map((f) => ({
        ...f,
        group: sub.name || "Subclass",
        subclass: true,
      }))
    );
  });
  return list;
}

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

// Conservative, text-driven extraction of the mechanics a class feature
// mentions: activation, uses/rest recovery, healing or damage dice, and point
// pools. These give imported class nodes usable actions and resources without
// pretending to understand every rule in the prose.
export function featureMechanics(feature) {
  const text = String(feature?.text || "");
  const lower = text.toLowerCase();
  const actions = [];
  const resources = [];

  const activation = /as a bonus action|use (?:your|a) bonus action/.test(lower)
    ? "bonus"
    : /as an action|use (?:your|an) action/.test(lower)
      ? "action"
      : /as a reaction|use (?:your|a) reaction/.test(lower)
        ? "reaction"
        : /no action required/.test(lower)
          ? "free"
          : "";

  const rest = /short or long rest/.test(lower)
    ? "long"
    : /long rest/.test(lower)
      ? "long"
      : /short rest/.test(lower)
        ? "short"
        : "";
  const oncePerRest =
    /once you use (?:this|it)|once per (?:short|long) rest|you must finish a (?:short or long|long|short) rest/.test(lower) ||
    /until you finish a (?:short or long|long|short) rest/.test(lower);
  const profUses = /number of times equal to your proficiency bonus/.test(lower);
  const usesMode = oncePerRest || profUses ? "own" : "atwill";
  const uses = profUses ? "prof" : "1";

  const parts = [];
  const heal = text.match(/regain (?:a number of )?hit points equal to ([0-9]+d[0-9]+)(?: \+ your ([a-z ]+?) level)?/i);
  if (heal) {
    parts.push({
      type: "heal",
      dice: heal[1],
      ability: "",
      bonus: heal[2] ? "level" : "",
    });
  }
  const damage = text.match(/(?:extra|additional) ([0-9]+d[0-9]+) ([a-z]+) damage/i);
  if (damage) {
    parts.push({
      type: "damage",
      dice: damage[1],
      damageType: damage[2][0].toUpperCase() + damage[2].slice(1).toLowerCase(),
      ability: "",
      bonus: "",
    });
  }

  if (activation || parts.length || usesMode !== "atwill") {
    actions.push({
      name: feature?.name || "Feature",
      description: text,
      category: activation || "free",
      usesMode,
      uses,
      sharedResource: "",
      recovery: rest || "none",
      recoveryAmount: "",
      resolve: "none",
      repeats: "",
      parts,
    });
  }

  // Point pools phrased as "a number of X points equal to your Y level".
  const pool = text.match(/number of ([a-z ]+?) points? equal to your ([a-z ]+?) level/i);
  if (pool) {
    const name = pool[1]
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/ Points$/, " Points");
    resources.push({
      name: name.endsWith("Points") ? name : `${name} Points`,
      uses: "",
      type: "point",
      valueType: "equal",
      equalTo: "level",
      recovery: /short rest/.test(lower) ? "short" : /long rest/.test(lower) ? "long" : "none",
      recoveryAmount: "",
      color: "#38bdf8",
    });
  }

  // Superiority Dice / similar "you have four d8 superiority dice" pools.
  const dicePool = text.match(
    /you have (one|two|three|four|five|six|seven|eight|nine|ten|\d+) (?:d(\d+) )?([a-z ]+?dice)/i
  );
  if (dicePool) {
    const count = NUMBER_WORDS[dicePool[1].toLowerCase()] || Number(dicePool[1]) || 1;
    const sizeMatch =
      text.match(/which are d(\d+)s?/i) ||
      text.match(/d(\d+) (?:superiority )?dice/i);
    resources.push({
      name: dicePool[3].replace(/\b\w/g, (c) => c.toUpperCase()),
      uses: String(count),
      type: "point",
      valueType: "flatDice",
      diceCount: 1,
      diceSize: dicePool[2] ? `d${dicePool[2]}` : sizeMatch ? `d${sizeMatch[1]}` : "d6",
      recovery: /short rest/.test(lower) ? "short" : "long",
      recoveryAmount: "",
      color: "#f59e0b",
    });
  }

  return { actions, resources };
}
