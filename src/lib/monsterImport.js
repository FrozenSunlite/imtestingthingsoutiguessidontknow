// Normalise common monster JSON shapes (our export, 5e.tools, dnd5e-api)
// into the Reference Library's monster fields. This is deliberately tolerant:
// missing sections stay blank rather than failing the import.
import { feetToSpacesText } from "@/lib/resources";
import { speedEntries, speedTextFromEntries } from "@/lib/monsterSpeeds";

const textOf = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join("\n");
  if (typeof value === "object") {
    if (value.entries) return textOf(value.entries);
    if (value.items) return Object.values(value.items).map(textOf).filter(Boolean).join("\n");
    if (value.name && (value.description || value.desc)) {
      return `${value.name}: ${textOf(value.description ?? value.desc)}`;
    }
    if (value.text) return textOf(value.text);
    if (value.desc) return textOf(value.desc);
    if (value.description) return textOf(value.description);
    if (value.name) return String(value.name);
    return "";
  }
  return String(value);
};

const listOf = (value) => {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .map((x) => {
      if (typeof x === "string") return { name: "", text: x };
      return {
        name: x?.name || "",
        text: textOf(x?.entries ?? x?.text ?? x?.desc ?? x),
      };
    })
    .filter((x) => x.name || x.text);
};

const join = (value) =>
  Array.isArray(value) ? value.filter(Boolean).join(", ") : textOf(value);

const mods = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return Object.entries(value)
    .map(([key, v]) => `${key.toUpperCase()} ${Number(v) >= 0 ? "+" : ""}${v}`)
    .join(", ");
};

const num = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const sourceTag = (raw) => {
  const type = typeof raw?.type === "object" ? raw.type?.type : raw?.type;
  const typeTags = typeof raw?.type === "object" ? raw.type?.tags || [] : [];
  return [...new Set([type, ...typeTags, ...(raw?.tags || [])].filter(Boolean).map(String))];
};

export function normalizeImportedMonster(raw) {
  if (!raw || typeof raw !== "object") return null;
  const abil = raw.abilities || {};
  const score = (k) => Number(abil[k]?.score ?? abil[k] ?? raw[k] ?? 10) || 10;
  const acRaw = raw.ac ?? raw.armorClass ?? raw.armor_class;
  const ac = Array.isArray(acRaw)
    ? acRaw[0]?.ac ?? acRaw[0]?.value ?? acRaw[0]
    : typeof acRaw === "object"
      ? acRaw.ac ?? acRaw.value
      : acRaw;
  const hpRaw = raw.hp ?? raw.hitPoints ?? raw.hit_points;
  const hp = typeof hpRaw === "object" ? hpRaw.average ?? hpRaw.value : hpRaw;
  const cr = typeof raw.cr === "object" ? raw.cr?.cr ?? raw.cr?.value : raw.cr;
  const speed = raw.speed ?? raw.movement;
  const type = typeof raw.type === "object" ? raw.type?.type : raw.type;
  const tags = sourceTag(raw);
  const sizeMap = { T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan" };
  const sizeText = (Array.isArray(raw.size) ? raw.size : [raw.size])
    .filter(Boolean)
    .map((s) => sizeMap[s] || s)
    .join(", ");
  const speeds = speedEntries(speed);
  return {
    name: textOf(raw.name) || "",
    image: typeof (raw.image || raw.img) === "string" ? raw.image || raw.img : "",
    unique: !!raw.unique,
    dungeonExempt: !!(raw.dungeonExempt ?? raw.exemptFromDungeon ?? raw.dungeonBlacklisted),
    size: sizeText,
    type: textOf(type),
    category: textOf(raw.category),
    tags,
    source: textOf(raw.source),
    alignment: join(raw.alignment),
    cr: cr == null ? "" : String(cr),
    description: textOf(raw.description ?? raw.flavor ?? ""),
    flavor: textOf(raw.flavor ?? ""),
    ac: ac == null ? "" : String(ac),
    hp: hp == null ? "" : String(hp),
    speed: speedTextFromEntries(speeds) || feetToSpacesText(typeof speed === "string" ? speed : ""),
    speeds,
    abilities: ["STR", "DEX", "CON", "INT", "WIS", "CHA"]
      .map((k) => `${k} ${score(k.toLowerCase())}`)
      .join(", "),
    senses: feetToSpacesText(join(raw.senses)),
    languages: join(raw.languages),
    saves: mods(raw.saves),
    skills: mods(raw.skills),
    damageVulnerabilities: join(raw.damageVuln ?? raw.vulnerabilities),
    damageResistances: join(raw.damageResist ?? raw.resistances),
    damageImmunities: join(raw.damageImmune ?? raw.immunities),
    conditionImmunities: join(raw.conditionImmune ?? raw.conditionImmunities),
    initiative: raw.initiative?.mod != null ? String(raw.initiative.mod) : raw.initiative ?? "",
    proficiencyBonus: raw.pb ?? raw.proficiencyBonus ?? "",
    xp: raw.xp ?? raw.cr?.xp ?? "",
    gear: Array.isArray(raw.gear)
      ? raw.gear.map((g) => (typeof g === "string" ? g : g?.name)).filter(Boolean).join(", ")
      : textOf(raw.gear),
    spellcasting: textOf(raw.spellcasting),
    traits: listOf(raw.traits ?? raw.trait),
    actions: listOf(raw.actions ?? raw.action),
    bonusActions: listOf(raw.bonus ?? raw.bonusActions),
    reactions: listOf(raw.reactions ?? raw.reaction),
    legendaryActions: listOf(raw.legendary ?? raw.legendaryActions),
    lairActions: listOf(raw.lair ?? raw.lairActions),
    mythicActions: listOf(raw.mythic ?? raw.mythicActions),
    proficiencies: listOf(raw.proficiencies),
    inventory: listOf(raw.inventory),
    templates: Array.isArray(raw.templates) ? [...raw.templates] : [],
  };
}

export function importMonsterPayload(data) {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.monsters)
      ? data.monsters
      : Array.isArray(data?.monster)
        ? data.monster
        : data && typeof data === "object"
          ? [data]
          : [];
  return list.map(normalizeImportedMonster).filter((m) => m?.name);
}
