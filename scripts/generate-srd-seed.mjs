// Build the bundled SRD reference seed from a local 5eTools data folder.
//
// Only entries flagged `srd` (SRD 5.1) or `srd52` (SRD 5.2) are included, so
// the shipped default library stays inside the CC-BY 4.0 SRD documents. The
// generated file is committed; 5eTools itself is never required at runtime.
//
// Usage: npm run srd:build [-- "E:/path/to/5etools/data"]
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "vite";

const root = "E:/5etools/data";
const configured = process.argv[2] || process.env.FIVETOOLS_DATA || root;
if (!existsSync(configured)) {
  console.error(`5eTools data folder not found: ${configured}`);
  process.exit(1);
}

const dataDir = configured;
const read = (relative) => JSON.parse(readFileSync(join(dataDir, relative), "utf8"));
const lower = (value) => String(value || "").trim().toLowerCase();
const srdEntries = (list) => (list || []).filter((entry) => entry && (entry.srd || entry.srd52));
const editionOf = (entry) => (entry?.srd52 ? "5.2" : entry?.srd ? "5.1" : "");

// Keep artwork out of the seed: the SRD licence covers the text, and a user's
// own imported art should not be redistributed by the app.
const withoutArt = (entry) => {
  if (!entry || typeof entry !== "object") return entry;
  const out = { ...entry };
  delete out.image;
  delete out.images;
  delete out.token;
  delete out.fluffImages;
  return out;
};

// One entry per name, preferring the 2024 (SRD 5.2) version when both editions
// contain it. Entries unique to SRD 5.1 are still included.
const preferred = (entries) => {
  const byName = new Map();
  for (const entry of entries.filter((e) => e.srd)) byName.set(lower(entry.name), { entry, edition: "5.1" });
  for (const entry of entries.filter((e) => e.srd52)) byName.set(lower(entry.name), { entry, edition: "5.2" });
  return [...byName.values()];
};

const byNameKey = (list, entry, edition) => {
  if (!list.some((item) => lower(item.name) === lower(entry.name))) {
    list.push({ ...withoutArt(entry), srdEdition: edition });
  }
};

const readBestiary = () => {
  const dir = join(dataDir, "bestiary");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.startsWith("bestiary-") && file.endsWith(".json"))
    .flatMap((file) => read(join("bestiary", file)).monster || []);
};

const readSpells = () => {
  const dir = join(dataDir, "spells");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.startsWith("spells-") && file.endsWith(".json"))
    .flatMap((file) => read(join("spells", file)).spell || []);
};

const readItems = () => {
  const out = [];
  for (const file of ["items.json", "items-base.json"]) {
    if (!existsSync(join(dataDir, file))) continue;
    const json = read(file);
    out.push(...(json.item || []), ...(json.baseitem || []));
  }
  return out;
};

const server = await createServer({
  configFile: "vite.standalone.config.js",
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const five = await server.ssrLoadModule("/src/lib/fiveETools.js");
  const monstersModule = await server.ssrLoadModule("/src/lib/monsterImport.js");

  const monsters = srdEntries(readBestiary());
  const spells = srdEntries(readSpells());
  const items = srdEntries(readItems());
  const conditions = srdEntries(read("conditionsdiseases.json").condition || []);
  const actions = srdEntries(read("actions.json").action || []);
  const languages = srdEntries(read("languages.json").language || []);
  const senses = srdEntries(read("senses.json").sense || []);
  const tables = srdEntries(read("tables.json").table || []);
  const vehicles = srdEntries(read("vehicles.json").vehicle || []);
  const backgrounds = srdEntries(read("backgrounds.json").background || []);
  const species = srdEntries(read("races.json").race || []);
  const feats = srdEntries(read("feats.json").feat || []);
  const deities = srdEntries(read("deities.json").deity || []);
  const objects = srdEntries(read("objects.json").object || []);
  const traps = srdEntries(read("trapshazards.json").trap || []);
  const classes = [];

  const library = {
    monsters: [],
    spells: [],
    actions: [],
    statusEffects: [],
    weapons: [],
    armor: [],
    adventuringGear: [],
    ammo: [],
    wondrousItems: [],
    poisons: [],
    explosives: [],
    trinkets: [],
    tradeGoods: [],
    siege: [],
    vehicles: [],
    rollTables: [],
    senses: [],
    lists: { languages: [], skills: [] },
    fiveETools: {
      backgrounds: [],
      species: [],
      feats: [],
      deities: [],
      objects: [],
      traps: [],
    },
  };

  preferred(monsters).forEach(({ entry, edition }) => {
    const mapped = monstersModule.normalizeImportedMonster(entry);
    if (mapped?.name) byNameKey(library.monsters, { ...mapped, srdEdition: edition }, edition);
  });

  preferred(spells).forEach(({ entry, edition }) => {
    const mapped = five.spellToLibrary(entry);
    if (mapped?.name) byNameKey(library.spells, { ...mapped, srdEdition: edition }, edition);
  });

  preferred(items).forEach(({ entry, edition }) => {
    const mapped = five.itemToLibrary(entry);
    if (!mapped?.value?.name) return;
    if (!Array.isArray(library[mapped.key])) library[mapped.key] = [];
    byNameKey(library[mapped.key], { ...mapped.value, srdEdition: edition }, edition);
  });

  preferred(conditions).forEach(({ entry, edition }) => {
    const mapped = five.conditionToStatus(entry);
    if (mapped?.name) byNameKey(library.statusEffects, { ...mapped, srdEdition: edition }, edition);
  });

  preferred(actions).forEach(({ entry, edition }) => {
    const mapped = five.actionToLibrary(entry);
    if (mapped?.name) byNameKey(library.actions, { ...mapped, srdEdition: edition }, edition);
  });

  const languageNames = new Set();
  for (const entry of languages) {
    const name = five.languageToLibrary(entry);
    if (name && !languageNames.has(lower(name))) {
      languageNames.add(lower(name));
      library.lists.languages.push(name);
    }
  }

  const skillNames = new Set();
  for (const entry of [...srdEntries(read("skills.json").skill || [])]) {
    const skill = five.skillToLibrary(entry);
    if (skill?.name && !skillNames.has(lower(skill.name))) {
      skillNames.add(lower(skill.name));
      library.lists.skills.push(skill);
    }
  }

  preferred(senses).forEach(({ entry, edition }) => {
    const mapped = five.senseToLibrary(entry);
    if (mapped?.name) byNameKey(library.senses, { ...mapped, srdEdition: edition }, edition);
  });

  for (const entry of tables) {
    const mapped = five.tableToRollTable(entry);
    if (mapped?.name) byNameKey(library.rollTables, mapped, editionOf(entry));
  }

  for (const entry of vehicles) {
    const mapped = five.vehicleToLibrary(entry);
    if (mapped?.name) byNameKey(library.vehicles, mapped, editionOf(entry));
  }

  // Raw 5eTools categories without a dedicated editable list. Keeping both
  // editions here means SRD 5.1 text remains available beside SRD 5.2.
  const rawCategory = (target, entries) => {
    const seen = new Set();
    for (const entry of entries) {
      if (!entry?.name) continue;
      const key = `${lower(entry.name)}|${lower(entry.source)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      target.push(withoutArt({ ...entry, srdEdition: editionOf(entry) }));
    }
  };
  rawCategory(library.fiveETools.backgrounds, backgrounds);
  rawCategory(library.fiveETools.species, species);
  rawCategory(library.fiveETools.feats, feats);
  rawCategory(library.fiveETools.deities, deities);
  rawCategory(library.fiveETools.objects, objects);
  rawCategory(library.fiveETools.traps, traps);

  // Class entries are included for reference; their individual features still
  // come from the optional Reference Index import.
  const classDir = join(dataDir, "class");
  if (existsSync(classDir)) {
    for (const file of readdirSync(classDir).filter((name) => name.startsWith("class-") && name.endsWith(".json"))) {
      const json = read(join("class", file));
      rawCategory(library.fiveETools.classes || (library.fiveETools.classes = []), srdEntries(json.class || []));
    }
  }

  const attribution = {
    srd51:
      'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.',
    srd52:
      'This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.',
  };

  const seed = {
    version: 1,
    generatedAt: new Date().toISOString(),
    attribution,
    library,
  };

  const outDir = "public/srd";
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "srd-seed.json");
  writeFileSync(outFile, JSON.stringify(seed));
  const bytes = statSync(outFile).size;
  const count = Object.fromEntries(
    Object.entries(library)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => [key, value.length])
  );
  console.log(`wrote ${outFile} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
  console.log(count);
  console.log(
    "raw categories",
    Object.fromEntries(
      Object.entries(library.fiveETools).map(([key, value]) => [key, value.length])
    )
  );
} finally {
  await server.close();
}
