// Category-aware preview details for entries in the 5eTools Reference Index.
// The source files use very different shapes (statblocks, spells, class feature
// ladders, tables, books), so the preview shows the fields that matter for the
// selected category instead of only the generic description text.
import { fiveText, entryName, itemToLibrary, spellToLibrary } from "@/lib/fiveETools";
import { spellClassNames } from "@/lib/fiveEToolsLookup";
import { normalizeImportedMonster } from "@/lib/monsterImport";

const clean = (value) => fiveText(value).replace(/[ \t]+\n/g, "\n").trim();
const titleCase = (s) =>
  String(s || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
const join = (value, sep = ", ") => {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) return value.map((v) => clean(v)).filter(Boolean).join(sep);
  return clean(value);
};
const yesNo = (v) => (v ? "Yes" : "");
const SIZE_LABEL = {
  T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan",
};
const sizeText = (value) => {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((s) => SIZE_LABEL[s] || clean(s)).join(", ");
  return SIZE_LABEL[value] || clean(value);
};

const feet = (n) => {
  const v = Math.round((Number(n) / 5) * 10) / 10;
  return Number.isFinite(v) ? `${v} ${v === 1 ? "space" : "spaces"}` : "";
};

const speedText = (speed) => {
  if (speed == null) return "";
  if (typeof speed === "string") return clean(speed);
  if (typeof speed === "number") return feet(speed);
  if (Array.isArray(speed)) return speed.map(speedText).filter(Boolean).join(", ");
  return Object.entries(speed)
    .filter(([, v]) => v != null && v !== false)
    .map(([k, v]) => {
      if (typeof v === "number") return `${k === "walk" ? "Walk" : k[0].toUpperCase() + k.slice(1)} ${feet(v)}`;
      if (v && typeof v === "object" && v.number != null) {
        const unit = v.units || v.unit || "ft.";
        return `${k === "walk" ? "Walk" : k[0].toUpperCase() + k.slice(1)} ${v.number} ${unit}`;
      }
      return `${k[0].toUpperCase() + k.slice(1)}`;
    })
    .join(", ");
};

// Starting proficiencies are often "choose N from [list]" objects rather than
// plain strings; flatten them into readable text.
const proficiencyText = (value) => {
  if (!value) return "";
  if (typeof value === "string") return clean(value);
  if (Array.isArray(value)) return value.map(proficiencyText).filter(Boolean).join("; ");
  if (typeof value !== "object") return clean(value);
  if (value.choose) {
    const from = value.choose.from || [];
    return `Choose ${value.choose.count || 1} from ${from.map((v) => titleCase(v)).join(", ")}`;
  }
  if (value.any) return `Any ${value.any}`;
  return clean(value);
};

const prerequisite = (value) => {
  if (!value) return "";
  if (typeof value === "string") return clean(value);
  if (Array.isArray(value)) return value.map(prerequisite).filter(Boolean).join(", ");
  if (typeof value !== "object") return clean(value);
  const bits = [];
  if (value.level != null) {
    const l = value.level;
    bits.push(typeof l === "object" ? `Level ${l.level ?? ""}${l.class ? ` (${clean(l.class)})` : ""}` : `Level ${l}`);
  }
  if (value.race?.length) bits.push(value.race.map((r) => clean(r.name || r)).join(" or "));
  if (value.background?.length) bits.push(`Background: ${value.background.map((r) => clean(r.name || r)).join(" or ")}`);
  if (value.feat?.length) bits.push(`Feat: ${value.feat.map((r) => clean(r.name || r)).join(" or ")}`);
  if (value.spell) bits.push(`Spell: ${clean(value.spell)}`);
  if (value.other) bits.push(clean(value.other));
  if (value.ability?.length) bits.push(value.ability.map((a) => clean(a)).join(", "));
  if (!bits.length) return clean(value);
  return bits.join(", ");
};

const componentText = (components) => {
  if (!components) return "";
  const parts = [];
  if (components.v) parts.push("V");
  if (components.s) parts.push("S");
  if (components.m) {
    const mat = typeof components.m === "string" ? components.m : clean(components.m);
    parts.push(mat ? `M (${mat})` : "M");
  }
  return parts.join(", ");
};

const classNames = (classes) => {
  if (!classes) return "";
  const groups = [
    ["fromClassList", ""],
    ["fromClassListVariant", " (variant)"],
    ["fromSubclass", ""],
  ];
  return groups
    .flatMap(([key, suffix]) =>
      (classes[key] || []).map((c) =>
        `${clean(c.name || c.className)}${c.subclassName ? ` (${clean(c.subclassName)})` : ""}${suffix}`
      )
    )
    .join(", ");
};

// Resolve 5eTools feature references ("Second Wind|Fighter||1") against the
// feature arrays in a class file.
function featureFromRef(ref, list, subclass) {
  if (!ref) return null;
  if (typeof ref === "object") {
    const inner = ref.classFeature || ref.subclassFeature || "";
    return inner ? featureFromRef(inner, list, subclass) : null;
  }
  const parts = String(ref).split("|");
  const [name, className, classSource, ...rest] = parts;
  const level = Number(rest[rest.length - 1]) || 0;
  const sub = subclass ? rest[0] || "" : "";
  return (
    (list || []).find(
      (f) =>
        f.name === name &&
        (!f.className || f.className === className) &&
        (!f.classSource || !classSource || f.classSource === classSource) &&
        (!subclass || !f.subclassShortName || f.subclassShortName === sub) &&
        (!f.level || !level || Number(f.level) === level)
    ) || {
      name,
      level,
      entries: [],
      _unresolved: true,
    }
  );
}

function featuresFrom(raw, entry, subclass) {
  if (!raw) return [];
  const list = subclass ? raw.subclassFeature || [] : raw.classFeature || [];
  const refs = subclass ? entry.subclassFeatures || [] : entry.classFeatures || [];
  return refs
    .map((ref) => featureFromRef(ref, list, subclass))
    .filter(Boolean)
    .map((f) => ({
      level: Number(f.level) || 0,
      name: clean(f.name || entryName(f)),
      text: clean(f.entries),
    }))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

const featureSection = (features, label = "Features") => {
  if (!features.length) return null;
  return {
    title: `${label} (${features.length})`,
    list: features.map((f) => ({
      label: `${f.level ? `Level ${f.level}` : "—"} · ${f.name}`,
      text: f.text ? f.text.replace(/\s+/g, " ").slice(0, 220) : "",
    })),
  };
};

const textSection = (title, value) => {
  const text = clean(value);
  return text ? { title, text } : null;
};

const rowText = (row) => {
  const cells = Array.isArray(row) ? row : row?.row || [row];
  return cells.map((cell) => {
    if (cell && typeof cell === "object") {
      if (cell.roll) {
        return cell.roll.exact != null
          ? String(cell.roll.exact)
          : `${cell.roll.min ?? ""}${cell.roll.max != null ? `–${cell.roll.max}` : ""}`;
      }
      if (cell.type === "cell") return clean(cell.entry ?? cell.entries ?? "");
    }
    return clean(cell);
  });
};

const tableBlock = (table) => {
  if (!table) return null;
  const columns = (table.colLabels || []).map(clean);
  const rows = (table.rows || []).slice(0, 100).map(rowText);
  return { title: clean(table.name || table.caption || "Table"), columns, rows };
};

// Find the first embedded image in a 5eTools entry tree. Homebrew commonly
// uses an `image` entry with an external href instead of a top-level `img`.
const findImage = (value) => {
  if (!value) return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImage(item);
      if (found) return found;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  if (value.type === "image" || value.type === "gallery") {
    const href = value.href;
    if (typeof href === "string") return href;
    if (href?.url) return href.url;
    if (href?.path) return href.path;
    if (href?.paths?.length) return findImage(href.paths);
    if (value.url) return value.url;
  }
  return findImage(value.entries) || findImage(value.items) || findImage(value.fluff);
};

export function entryImage(entry) {
  if (!entry) return "";
  return (
    [entry.img, entry.image, entry.portrait, entry.cover].find(
      (v) => typeof v === "string" && v
    ) ||
    findImage(entry.entries) ||
    findImage(entry.fluff) ||
    ""
  );
}

const contentsList = (contents, depth = 0) =>
  (contents || []).flatMap((c) => {
    if (!c) return [];
    if (typeof c === "string") return [{ label: c, text: "" }];
    if (c.name) {
      return [
        { label: `${"  ".repeat(depth)}${clean(c.name)}`, text: clean(c.entries).slice(0, 160) },
        ...contentsList(c.contents, depth + 1),
      ];
    }
    return contentsList(c.contents, depth);
  });

const actionEntries = (entry, keys) => {
  const sections = [];
  keys.forEach(([key, title]) => {
    const list = entry?.[key];
    if (!Array.isArray(list) || !list.length) return;
    sections.push({
      title,
      text: list
        .map((a) => {
          const name = clean(a?.name);
          const text = clean(a?.entries ?? a?.text);
          return [name && `${name}.`, text].filter(Boolean).join(" ");
        })
        .filter(Boolean)
        .join("\n\n"),
    });
  });
  return sections;
};

const monsterDetails = (entry) => {
  const m = normalizeImportedMonster(entry) || {};
  const fields = [
    ["Type", [m.size, m.type, m.alignment].filter(Boolean).join(" ")],
    ["Armor Class", m.ac],
    ["Hit Points", m.hp],
    ["Speed", m.speed],
    ["Challenge", m.cr ? `CR ${m.cr}${m.xp !== "" && m.xp != null ? ` (${m.xp} XP)` : ""}` : ""],
    ["Ability Scores", m.abilities],
    ["Saving Throws", m.saves],
    ["Skills", m.skills],
    ["Damage Vulnerabilities", m.damageVulnerabilities],
    ["Damage Resistances", m.damageResistances],
    ["Damage Immunities", m.damageImmunities],
    ["Condition Immunities", m.conditionImmunities],
    ["Senses", m.senses],
    ["Languages", m.languages],
    ["Gear", m.gear],
    ["Proficiency Bonus", m.proficiencyBonus],
  ];
  const sections = [
    textSection("Description", entry.description || entry.entries),
    ...actionEntries(entry, [
      ["trait", "Traits"],
      ["action", "Actions"],
      ["bonus", "Bonus Actions"],
      ["reaction", "Reactions"],
      ["legendary", "Legendary Actions"],
      ["mythic", "Mythic Actions"],
      ["lair", "Lair Actions"],
      ["spellcasting", "Spellcasting"],
    ]),
  ].filter(Boolean);
  return { fields, sections };
};

const spellDetails = (entry, context = {}) => {
  const s = spellToLibrary(entry);
  const fields = [
    ["Level", s.level === "cantrip" ? "Cantrip" : s.level ? `Level ${s.level}` : ""],
    ["School", s.school],
    ["Casting Time", s.castingTime],
    ["Range", s.range],
    ["Components", componentText(entry.components)],
    ["Duration", s.duration],
    ["Save", s.saveAbility ? titleCase(s.saveAbility) : ""],
    ["Classes", classNames(entry.classes) || spellClassNames(entry, context.spellLookup)],
    ["Damage", join(entry.damageInflict, ", ").split(", ").map(titleCase).join(", ")],
    ["Conditions", join(entry.conditionInflict, ", ").split(", ").map(titleCase).join(", ")],
  ];
  const sections = [
    textSection("Description", s.description),
    textSection("At Higher Levels", s.upcast),
    textSection("From", entry.fluff?.name ? `${entry.fluff.name}` : ""),
  ].filter(Boolean);
  return { fields, sections };
};

const classDetails = (entry, raw, subclass) => {
  const features = featuresFrom(raw, entry, subclass);
  const sp = entry.startingProficiencies || {};
  const fields = subclass
    ? [
        ["Class", clean(entry.className)],
        ["Source", clean(entry.classSource)],
        ["Features", String(features.length || "")],
      ]
    : [
        ["Hit Die", entry.hd ? `d${entry.hd.faces} per ${clean(entry.hd.number) === "1" ? "level" : "level"}` : ""],
        ["Saving Throws", join(entry.proficiency, ", ").toUpperCase()],
        ["Armor", proficiencyText(sp.armor)],
        ["Weapons", proficiencyText(sp.weapons)],
        ["Tools", proficiencyText(sp.tools)],
        ["Skills", proficiencyText(sp.skills)],
        ["Subclass", clean(entry.subclassTitle)],
        ["Source", clean(entry.source)],
      ];
  const sections = [
    featureSection(features),
    textSection("Starting Equipment", entry.startingEquipment?.entries || entry.startingEquipment),
    textSection("Multiclassing", entry.multiclassing?.entries || entry.multiclassing),
  ].filter(Boolean);
  return { fields, sections };
};

const featDetails = (entry) => ({
  fields: [
    ["Category", clean(entry.category)],
    ["Prerequisite", prerequisite(entry.prerequisite)],
    ["Repeatable", yesNo(entry.repeatable)],
    ["Source", clean(entry.source)],
  ],
  sections: [
    textSection("Description", entry.entries),
    textSection("Additional", entry.additionalEntries),
  ].filter(Boolean),
});

const backgroundDetails = (entry) => ({
  fields: [
    ["Ability Scores", join(entry.ability, ", ")],
    ["Feat", join(entry.feats)],
    ["Skills", proficiencyText(entry.skillProficiencies)],
    ["Tools", proficiencyText(entry.toolProficiencies)],
    ["Languages", proficiencyText(entry.languageProficiencies)],
    ["Equipment", clean(entry.startingEquipment)],
    ["Source", clean(entry.source)],
  ],
  sections: [textSection("Description", entry.entries)].filter(Boolean),
});

const speciesDetails = (entry) => ({
  fields: [
    ["Size", sizeText(entry.size)],
    ["Speed", speedText(entry.speed)],
    ["Ability Scores", join(entry.ability)],
    ["Languages", proficiencyText(entry.languageProficiencies)],
    ["Source", clean(entry.source)],
  ],
  sections: [
    textSection("Description", entry.entries),
    ...actionEntries(entry, [
      ["trait", "Traits"],
      ["traitTags", "Tags"],
    ]),
  ].filter(Boolean),
});

const optionDetails = (entry) => ({
  fields: [
    ["Type", clean(entry.featureType || entry.optionType)],
    ["Prerequisite", prerequisite(entry.prerequisite)],
    ["Source", clean(entry.source)],
  ],
  sections: [textSection("Description", entry.entries)].filter(Boolean),
});

const ITEM_TYPE_LABEL = {
  M: "Melee Weapon", R: "Ranged Weapon", A: "Ammunition", AF: "Ammunition",
  LA: "Light Armor", MA: "Medium Armor", HA: "Heavy Armor", S: "Shield",
  P: "Potion", SC: "Scroll", WD: "Wand", RD: "Rod", ST: "Staff", RG: "Ring",
  W: "Wondrous Item", G: "Adventuring Gear", FD: "Food and Drink",
  SCF: "Spellcasting Focus", INS: "Instrument", GS: "Gaming Set", T: "Tool",
  MNT: "Mount", TAH: "Tack and Harness", EXP: "Explosive", TG: "Trade Good",
  TB: "Trade Bar", VEH: "Vehicle (Land)", SHP: "Vehicle (Water)",
  AIR: "Vehicle (Air)", SPC: "Vehicle (Space)", OTH: "Other", GV: "Generic Variant",
};

const itemDetails = (entry) => {
  const mapped = itemToLibrary(entry);
  const value = mapped?.value || {};
  const code = String(typeof entry.type === "object" ? entry.type?.type : entry.type || "")
    .split("|")[0]
    .trim();
  const rarity = String(entry.rarity || "").toLowerCase();
  return {
    fields: [
      ["Type", mapped?.key === "wondrousItems" && value.itemType ? value.itemType : ITEM_TYPE_LABEL[code] || clean(entry.type)],
      ["Rarity", rarity && rarity !== "none" ? titleCase(rarity) : ""],
      ["Attunement", entry.reqAttune ? clean(entry.reqAttune) : entry.reqAttuneTags ? "Required" : ""],
      ["Weight", entry.weight != null ? `${entry.weight} lb.` : ""],
      ["Value", value.cost || (entry.value != null ? `${Number((Number(entry.value) / 100).toFixed(2))} gp` : "")],
      ["Properties", value.properties?.length ? join(value.properties) : join(entry.property)],
      ["Mastery", join(entry.mastery)],
      ["Damage", value.diceCount
        ? `${value.diceCount}${value.dieSize}${value.damageType ? ` ${value.damageType}` : ""}`
        : clean(entry.dmg1 || entry.dmg2)],
      ["Armor Class", value.acFlat != null ? String(value.acFlat) : clean(entry.ac)],
      ["Source", clean(entry.source)],
    ],
    sections: [
      textSection("Description", entry.entries),
      textSection("Additional", entry.additionalEntries),
    ].filter(Boolean),
  };
};

const conditionDetails = (entry, kind) => ({
  fields: [
    ["Type", kind],
    ["Source", clean(entry.source)],
  ],
  sections: [textSection("Description", entry.entries)].filter(Boolean),
});

const tableDetails = (entry) => {
  const block = tableBlock(entry);
  return {
    fields: [
      ["Caption", clean(entry.caption)],
      ["Rows", String((entry.rows || []).length)],
      ["Source", clean(entry.source)],
    ],
    sections: block ? [block] : [],
  };
};

const bookDetails = (entry, adventure) => ({
  fields: [
    ["Author", join(entry.author)],
    ["Published", clean(entry.published)],
    ["Group", clean(entry.group)],
    ...(adventure
      ? [
          ["Storyline", clean(entry.storyline)],
          ["Level", clean(entry.level)],
        ]
      : []),
    ["Source", clean(entry.source || entry.id)],
  ],
  sections: [
    {
      title: "Contents",
      list: contentsList(entry.data?.map((chapter) => ({ name: chapter.name })) || entry.contents),
    },
    textSection("Description", entry.entries),
  ].filter((s) => s && (s.list?.length || s.text)),
});

const deityDetails = (entry) => ({
  fields: [
    ["Pantheon", clean(entry.pantheon)],
    ["Alignment", clean(entry.alignment)],
    ["Category", clean(entry.category)],
    ["Domains", join(entry.domains)],
    ["Province", clean(entry.province)],
    ["Symbol", clean(entry.symbol)],
    ["Source", clean(entry.source)],
  ],
  sections: [textSection("Description", entry.entries)].filter(Boolean),
});

const vehicleDetails = (entry) => ({
  fields: [
    ["Type", clean(entry.vehicleType)],
    ["Size", sizeText(entry.size)],
    ["Terrain", clean(entry.terrain)],
    ["Crew", entry.capCrew != null ? String(entry.capCrew) : ""],
    ["Passengers", entry.capPassenger != null ? String(entry.capPassenger) : ""],
    ["Cargo", entry.capCargo != null ? `${entry.capCargo} tons` : ""],
    ["Armor Class", clean(entry.ac)],
    ["Hit Points", clean(entry.hp)],
    ["Speed", speedText(entry.speed)],
    ["Immunities", join(entry.immune)],
    ["Source", clean(entry.source)],
  ],
  sections: [textSection("Description", entry.entries)].filter(Boolean),
});

const objectDetails = (entry) => ({
  fields: [
    ["Type", clean(entry.objectType)],
    ["Size", sizeText(entry.size)],
    ["Armor Class", clean(entry.ac)],
    ["Hit Points", clean(entry.hp)],
    ["Speed", speedText(entry.speed)],
    ["Ability Scores", ["str", "dex", "con", "int", "wis", "cha"]
      .filter((k) => entry[k] != null)
      .map((k) => `${k.toUpperCase()} ${entry[k]}`)
      .join(", ")],
    ["Senses", join(entry.senses)],
    ["Immunities", join(entry.immune)],
    ["Source", clean(entry.source)],
  ],
  sections: [
    textSection("Description", entry.entries),
    textSection("Actions", entry.actionEntries),
  ].filter(Boolean),
});

const trapDetails = (entry) => ({
  fields: [
    ["Type", clean(entry.trapHazType)],
    ["Rating", clean(entry.rating)],
    ["Source", clean(entry.source)],
  ],
  sections: [textSection("Description", entry.entries)].filter(Boolean),
});

const rewardDetails = (entry) => ({
  fields: [
    ["Type", clean(entry.type)],
    ["Source", clean(entry.source)],
  ],
  sections: [textSection("Description", entry.entries)].filter(Boolean),
});

const psionicDetails = (entry) => ({
  fields: [
    ["Type", clean(entry.type)],
    ["Order", clean(entry.order)],
    ["Focus", clean(entry.focus)],
    ["Source", clean(entry.source)],
  ],
  sections: [
    textSection("Description", entry.entries),
    {
      title: "Modes",
      text: (entry.modes || [])
        .map((m) => `${clean(m.name)}${m.entries ? `: ${clean(m.entries)}` : ""}`)
        .join("\n\n"),
    },
  ].filter((s) => s && s.text),
});

const deckDetails = (entry) => ({
  fields: [
    ["Cards", String((entry.cards || []).length)],
    ["Source", clean(entry.source)],
  ],
  sections: [
    textSection("Description", entry.entries),
    {
      title: "Cards",
      list: (entry.cards || []).map((c) => ({ label: clean(c.name), text: "" })),
    },
  ].filter((s) => s && (s.text || s.list?.length)),
});

const actionDetails = (entry) => ({
  fields: [
    ["Time", clean(entry.time)],
    ["Source", clean(entry.source)],
  ],
  sections: [textSection("Description", entry.entries)].filter(Boolean),
});

const languageDetails = (entry) => ({
  fields: [
    ["Typical Speakers", join(entry.typicalSpeakers)],
    ["Script", clean(entry.script)],
    ["Source", clean(entry.source)],
  ],
  sections: [textSection("Description", entry.entries)].filter(Boolean),
});

const bastionDetails = (entry) => ({
  fields: [
    ["Type", clean(entry.facilityType)],
    ["Level", clean(entry.level)],
    ["Prerequisite", prerequisite(entry.prerequisite)],
    ["Space", clean(entry.space)],
    ["Hirelings", clean(entry.hirelings)],
    ["Orders", join(entry.orders)],
    ["Source", clean(entry.source)],
  ],
  sections: [textSection("Description", entry.entries)].filter(Boolean),
});

const encounterDetails = (entry) => ({
  fields: [
    ["Tables", String((entry.tables || []).length)],
    ["Source", clean(entry.source)],
  ],
  sections: [
    ...(entry.tables || []).map((t) => tableBlock(t)).filter(Boolean),
    textSection("Description", entry.entries),
  ].filter(Boolean),
});

const lootDetails = (entry) => ({
  fields: [
    ["CR Range", [entry.crMin, entry.crMax].filter((v) => v != null).join(" – ")],
    ["Coins", clean(entry.coins)],
    ["Source", clean(entry.source)],
  ],
  sections: [tableBlock(entry.table), textSection("Description", entry.entries)].filter(Boolean),
});

const recipeDetails = (entry) => ({
  fields: [
    ["Type", clean(entry.type)],
    ["Makes", clean(entry.makes)],
    ["Diet", join(entry.diet)],
    ["Allergens", join(entry.allergenGroups)],
    ["Source", clean(entry.source)],
  ],
  sections: [
    textSection("Ingredients", entry.ingredients),
    textSection("Instructions", entry.instructions),
    textSection("Notes", entry.noteCook || entry.notes),
  ].filter(Boolean),
});

const ruleDetails = (entry) => ({
  fields: [
    ["Type", clean(entry.ruleType)],
    ["Source", clean(entry.source)],
  ],
  sections: [textSection("Description", entry.entries)].filter(Boolean),
});

const skillDetails = (entry) => ({
  fields: [
    ["Ability", clean(entry.ability)],
    ["Source", clean(entry.source)],
  ],
  sections: [textSection("Description", entry.entries)].filter(Boolean),
});

const magicVariantDetails = (entry) => ({
  fields: [
    ["Type", clean(entry.type)],
    ["Requires", clean(entry.requires)],
    ["Inherits", clean(entry.inherits)],
    ["Source", clean(entry.source)],
  ],
  sections: [],
});

const genericDetails = (entry) => ({
  fields: [
    ["Type", clean(entry.type || entry.objectType || entry.vehicleType || entry.facilityType)],
    ["Rarity", clean(entry.rarity)],
    ["Prerequisite", prerequisite(entry.prerequisite)],
    ["Source", clean(entry.source)],
  ],
  sections: [
    textSection("Description", entry.entries || entry.description || entry.text),
    textSection("Additional", entry.additionalEntries),
  ].filter(Boolean),
});

const DETAILERS = {
  bestiary: monsterDetails,
  spells: spellDetails,
  feats: featDetails,
  backgrounds: backgroundDetails,
  species: speciesDetails,
  charOptions: optionDetails,
  optionalFeatures: optionDetails,
  items: itemDetails,
  conditions: (e) => conditionDetails(e, "Condition, disease or status"),
  tables: tableDetails,
  deities: deityDetails,
  vehicles: vehicleDetails,
  objects: objectDetails,
  traps: trapDetails,
  gifts: rewardDetails,
  cults: rewardDetails,
  psionics: psionicDetails,
  decks: deckDetails,
  actions: actionDetails,
  languages: languageDetails,
  bastions: bastionDetails,
  encounterGen: encounterDetails,
  lootGen: lootDetails,
  rulesGlossary: ruleDetails,
  statGen: (e) => ruleDetails(e),
  life: (e) => ruleDetails(e),
  names: (e) => ruleDetails(e),
  adventures: (e) => bookDetails(e, true),
  books: (e) => bookDetails(e, false),
  variants: ruleDetails,
  senses: skillDetails,
  skills: skillDetails,
  magicVariants: magicVariantDetails,
};

export function entryDetails(categoryId, entry, raw, context = {}) {
  if (!entry) return null;
  const detailer =
    categoryId === "classes"
      ? (e) => classDetails(e, raw, !!e.shortName || !!e.subclassShortName)
      : DETAILERS[categoryId] || genericDetails;
  const body =
    (categoryId === "spells"
      ? spellDetails(entry, context)
      : detailer(entry)) || { fields: [], sections: [] };
  const image = entryImage(entry);
  return {
    name: entryName(entry),
    source: clean(entry.source || entry.classSource || entry.id),
    page: entry.page,
    edition: clean(entry.edition),
    image,
    fields: (body.fields || [])
      .map(([label, value]) => [label, CleanField(value)])
      .filter(([, value]) => value),
    sections: (body.sections || []).filter(
      (s) => (s.text && clean(s.text)) || s.list?.length || s.columns?.length
    ),
  };
}

// Defensive coercion: preview values are occasionally objects (e.g. a 5eTools
// description object); never let one reach JSX as a React child.
function CleanField(value) {
  if (value == null) return "";
  if (typeof value === "string") return clean(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => clean(v)).filter(Boolean).join(", ");
  if (typeof value === "object") {
    if (value.name && value.description) return `${clean(value.name)}: ${clean(value.description)}`;
    if (value.name) return clean(value.name);
    if (value.description) return clean(value.description);
    return clean(value);
  }
  return String(value);
}
