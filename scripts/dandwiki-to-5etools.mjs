// Private-use D&D Wiki (dandwiki.com) 5e homebrew converter.
//
// The output is a 5eTools-shaped JSON file for the Reference Index. Generated
// content is GNU FDL 1.3 and must stay private; do not redistribute it. This
// script is intentionally rate-limited and caches every page under Saves/.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";

const BASE = "https://dandwiki.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 TalentTreePersonalArchive/1.0";
const CACHE = join("Saves", "dandwiki-cache");
const DEFAULT_OUT = join("Saves", "dandwiki-5e.json");

const PRESETS = {
  spells: {
    key: "spell",
    seeds: ["5e_All_Spells"],
  },
  monsters: {
    key: "monster",
    seeds: ["5e_Monsters", "5e_Miscellaneous_Creatures", "5e_NPCs", "5e_Templates"],
  },
  classes: { key: "class", seeds: ["Full_List_of_5e_Classes"] },
  races: { key: "race", seeds: ["Alphabetical_5e_Races"] },
  backgrounds: { key: "background", seeds: ["5e_Backgrounds"] },
  equipment: {
    key: "item",
    seeds: ["5e_Equipment", "5e_Weapons", "5e_Armor", "5e_Adventuring_Gear", "5e_Magic_Items"],
  },
  characterOptions: {
    key: "optionalfeature",
    seeds: ["5e_Character_Options", "5e_Feats", "5e_Subclasses"],
  },
  deities: { key: "deity", seeds: ["5e_Deities"] },
  traps: { key: "trap", seeds: ["5e_Traps"] },
  hazards: { key: "hazard", seeds: ["5e_Hazards"] },
  diseases: { key: "disease", seeds: ["5e_Diseases"] },
  rewards: { key: "reward", seeds: ["5e_Rewards"] },
  rules: { key: "variantrule", seeds: ["5e_Rules"] },
  sourcebooks: { key: "book", seeds: ["5e_Sourcebooks"] },
  campaigns: { key: "book", seeds: ["5e_Campaign_Settings"] },
  quests: { key: "adventure", seeds: ["5e_Quests"] },
  environments: { key: "adventure", seeds: ["5e_Environments"] },
  encounters: { key: "encounter", seeds: ["5e_Encounters"] },
  maps: { key: "object", seeds: ["Maps"] },
  builds: { key: "optionalfeature", seeds: ["5e_Optimized_Character_Builds"] },
};

const SUFFIX_KEYS = [
  ["5e Spell", "spell"],
  ["5e Creature", "monster"],
  ["5e Class", "class"],
  ["5e Subclass", "subclass"],
  ["5e Race", "race"],
  ["5e Subrace", "race"],
  ["5e Background", "background"],
  ["5e Equipment", "item"],
  ["5e Magic Item", "item"],
  ["5e Weapon", "item"],
  ["5e Armor", "item"],
  ["5e Vehicle", "vehicle"],
  ["5e Feat", "feat"],
  ["5e Class Feature", "optionalfeature"],
  ["5e Character Option", "optionalfeature"],
  ["5e Invocation", "optionalfeature"],
  ["5e Maneuver", "optionalfeature"],
  ["5e Fighting Style", "optionalfeature"],
  ["5e Deity", "deity"],
  ["5e Trap", "trap"],
  ["5e Hazard", "hazard"],
  ["5e Disease", "disease"],
  ["5e Condition", "condition"],
  ["5e Reward", "reward"],
  ["5e Variant Rule", "variantrule"],
  ["5e Sourcebook", "book"],
  ["5e Campaign Setting", "book"],
  ["5e Quest", "adventure"],
  ["5e Environment", "adventure"],
  ["5e Encounter", "encounter"],
  ["5e Optimized Character Build", "optionalfeature"],
];

const args = process.argv.slice(2);
const arg = (name, fallback = "") => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
};
const has = (name) => args.includes(`--${name}`);
const limit = Math.max(0, Number(arg("limit", "0")) || 0);
const delay = Math.max(100, Number(arg("delay", "300")) || 300);
const outFile = arg("out", DEFAULT_OUT);
const presetName = arg("preset", "spells");
const presetNames =
  presetName === "all"
    ? Object.keys(PRESETS)
    : presetName.split(",").map((value) => value.trim()).filter(Boolean);
const presets = presetNames.map((name) => PRESETS[name]).filter(Boolean);
const customSeeds = arg("seeds", "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const seeds = customSeeds.length ? customSeeds : presets.flatMap((item) => item.seeds);
const defaultKey = presets[0]?.key || "optionalfeature";

if (!presets.length && !customSeeds.length) {
  console.error(`Unknown preset "${presetName}". Use --preset spells or --seeds Page_Name,...`);
  process.exit(1);
}
if (!seeds.length) {
  console.error(`Preset "${presetName}" has no seed pages.`);
  process.exit(1);
}

mkdirSync(CACHE, { recursive: true });
mkdirSync(join(outFile, ".."), { recursive: true });

const clean = (value) =>
  String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\[\s*edit\s*\]/gi, "")
    .replace(/\[\s*citation needed\s*\]/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(path) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const hash = createHash("sha1").update(url).digest("hex");
  const file = join(CACHE, `${hash}.html`);
  if (existsSync(file)) return { url, html: readFileSync(file, "utf8") };
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const html = await response.text();
      writeFileSync(file, html);
      await sleep(delay);
      return { url, html };
    } catch (error) {
      lastError = error;
      await sleep(delay * attempt);
    }
  }
  throw new Error(`Could not fetch ${url}: ${lastError?.message || lastError}`);
}

function pageLinks(html) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const links = [];
  $("#mw-content-text .mw-parser-output a[href^='/wiki/']").each((_, element) => {
    const href = $(element).attr("href") || "";
    const title = clean($(element).attr("title") || $(element).text());
    if (!href || /^(Talk|Special|Category|File|Template|Help|User|MediaWiki|Module|D&D_Wiki):/i.test(href.slice(7))) {
      return;
    }
    if (seen.has(href)) return;
    seen.add(href);
    links.push({ href, title });
  });
  return links;
}

function keyForTitle(title) {
  for (const [suffix, key] of SUFFIX_KEYS) {
    if (title.includes(`(${suffix})`)) return key;
  }
  return "";
}

function textOf($, element) {
  const copy = $(element).clone();
  copy.find("script,style,.mw-editsection,.reference,sup.reference,.mw-cite-backlink,.noprint,.navbox,.catlinks,.printfooter,.vote").remove();
  return clean(copy.text());
}

function entryPlainText(entry) {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object") return "";
  if (entry.type === "table") {
    return [entry.colLabels || [], ...(entry.rows || [])]
      .flat()
      .map((cell) => String(cell || ""))
      .join(" ");
  }
  if (entry.type === "list") return (entry.items || []).join(" ");
  if (entry.type === "section") {
    return [entry.name, ...(entry.entries || []).map(entryPlainText)].join(" ");
  }
  return "";
}

function parseTable($, element) {
  const rows = [];
  let columns = [];
  $(element)
    .find("tr")
    .each((rowIndex, row) => {
      const cells = [];
      $(row)
        .find("th,td")
        .each((_, cell) => cells.push(clean($(cell).text())));
      if (!cells.length) return;
      if (rowIndex === 0 && $(row).find("th").length) {
        columns = cells;
      } else {
        rows.push(cells);
      }
    });
  return { type: "table", colLabels: columns, rows };
}

function parseBlocks($) {
  const root = $("#mw-content-text .mw-parser-output").first();
  root
    .find("script,style,.mw-editsection,.reference,sup.reference,.mw-cite-backlink,.noprint,.navbox,.catlinks,.printfooter,.vote")
    .remove();
  const entries = [];
  let section = null;
  const append = (value) => {
    if (!value) return;
    if (section) section.entries.push(value);
    else entries.push(value);
  };
  root.children().each((_, element) => {
    const tag = element.tagName?.toLowerCase();
    const heading = $(element).is(".mw-heading") ? $(element).find("h2,h3,h4,h5").first() : null;
    if (heading?.length) {
      const name = clean(heading.text());
      if (!name || /^(navigation menu|contents|references|external links)$/i.test(name)) return;
      section = { type: "section", name, entries: [] };
      entries.push(section);
      return;
    }
    if (/^h[2-6]$/.test(tag)) {
      const name = clean($(element).text());
      if (!name || /^(navigation menu|contents|references|external links)$/i.test(name)) return;
      section = { type: "section", name, entries: [] };
      entries.push(section);
      return;
    }
    if (tag === "p") {
      append(textOf($, element));
      return;
    }
    if (tag === "ul" || tag === "ol") {
      const items = [];
      $(element).find("> li").each((_, li) => {
        const text = textOf($, li);
        if (text) items.push(text);
      });
      if (items.length) append({ type: "list", items });
      return;
    }
    if (tag === "dl") {
      const items = [];
      $(element).children("dt,dd").each((_, child) => {
        const text = textOf($, child);
        if (text) items.push(text);
      });
      if (items.length) append({ type: "list", items });
      return;
    }
    if (tag === "table") {
      const table = parseTable($, element);
      if (table.rows.length) append(table);
      return;
    }
    if (tag === "blockquote" || tag === "pre") {
      append(textOf($, element));
      return;
    }
    if (tag === "div") {
      if ($(element).is(".mw-heading")) return;
      const text = textOf($, element);
      if (text) append(text);
    }
  });
  return entries;
}

function spellFields(text) {
  const fields = {};
  const level = text.match(/(\d+)(?:st|nd|rd|th)-level\s+([A-Za-z]+)/i);
  const cantrip = /\bcantrip\b/i.test(text);
  if (level) {
    fields.level = Number(level[1]);
    fields.school = level[2];
  } else if (cantrip) {
    fields.level = 0;
    fields.school = "Cantrip";
  }
  const time = text.match(/Casting time\s*:\s*([^:]+?)(?=\s+(?:Range|Components|Duration)\s*:|$)/i);
  const range = text.match(/Range\s*:\s*([^:]+?)(?=\s+(?:Components|Duration)\s*:|$)/i);
  const components = text.match(/Components\s*:\s*([^:]+?)(?=\s+Duration\s*:|$)/i);
  const duration = text.match(/Duration\s*:\s*([^:]+?)(?=\s+(?:At Higher Levels|Back to|$))/i);
  if (time) fields.timeText = clean(time[1]);
  if (range) fields.rangeText = clean(range[1]);
  if (components) fields.componentsText = clean(components[1]);
  if (duration) fields.durationText = clean(duration[1]);
  return fields;
}

async function parsePage(html, url, fallbackKey) {
  const $ = cheerio.load(html);
  const fullTitle = clean($("#firstHeading").text());
  if (!fullTitle) return null;
  const key = keyForTitle(fullTitle) || fallbackKey;
  const name = clean(fullTitle.replace(/\s*\(5e [^)]+\)\s*$/, "")) || fullTitle;
  const categories = [];
  $("#catlinks a").each((_, element) => {
    const text = clean($(element).text());
    if (text && text !== "Categories" && !categories.includes(text)) categories.push(text);
  });
  const entries = parseBlocks($);
  const plain = entries.map(entryPlainText).join("\n");
  const spell = key === "spell" ? spellFields(plain) : {};
  return {
    key,
    name,
    source: "DANDWIKI",
    page: fullTitle,
    url,
    categories,
    ...spell,
    entries,
  };
}

function loadManifest(categoryKey, pages) {
  return {
    _meta: {
      sources: [
        {
          json: "DandWiki",
          abbreviation: "DANDWIKI",
          full: "D&D Wiki 5e Homebrew",
          url: `${BASE}/wiki/5e_Homebrew`,
          license: "GNU Free Documentation License 1.3",
          licenseUrl: `${BASE}/wiki/GNU_Free_Documentation_License_1.3`,
          privateUseOnly: true,
        },
      ],
      dateConverted: new Date().toISOString(),
      note: "Private single-user conversion. Do not redistribute.",
    },
    [categoryKey]: pages,
  };
}

console.log(`[dandwiki] preset=${presetName} seeds=${seeds.join(", ")} limit=${limit || "all"} delay=${delay}ms`);
const entryLinks = [];
const seen = new Set();
for (const seed of seeds) {
  try {
    const { url, html } = await fetchPage(`/wiki/${seed}`);
    console.log(`[dandwiki] index ${seed} (${(html.length / 1024).toFixed(0)} KB)`);
    for (const link of pageLinks(html)) {
      if (seen.has(link.href)) continue;
      if (!/\(5e [^)]+\)/.test(link.title)) continue;
      const key = keyForTitle(link.title);
      if (!key) continue;
      seen.add(link.href);
      entryLinks.push({ href: link.href, title: link.title, key });
    }
  } catch (error) {
    console.warn(`[dandwiki] seed ${seed} failed: ${error.message}`);
  }
}
if (!entryLinks.length) {
  console.error("No 5e entry links found in the seed pages. Check the seed page names.");
  process.exit(1);
}
const chosen = limit ? entryLinks.slice(0, limit) : entryLinks;
console.log(`[dandwiki] ${chosen.length} page(s) to convert`);

if (has("dry-run")) {
  const counts = {};
  for (const link of chosen) counts[link.key] = (counts[link.key] || 0) + 1;
  console.log(`[dandwiki] dry run by category: ${JSON.stringify(counts)}`);
  process.exit(0);
}

const byKey = {};
let done = 0;
for (const link of chosen) {
  try {
    const { url, html } = await fetchPage(link.href);
    const entry = await parsePage(html, url, link.key);
    if (entry) {
      const key = entry.key || link.key;
      delete entry.key;
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push(entry);
    }
  } catch (error) {
    console.warn(`[dandwiki] skip ${link.title}: ${error.message}`);
  }
  done += 1;
  if (done % 25 === 0) console.log(`[dandwiki] ${done}/${chosen.length}`);
}

const manifest = {
  _meta: loadManifest(defaultKey, [])._meta,
};
for (const [key, entries] of Object.entries(byKey)) {
  manifest[key] = entries;
}
writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[dandwiki] wrote ${outFile} (${Object.values(byKey).flat().length} entries)`);

if (has("split")) {
  const splitDir = join(outFile, "..", "dandwiki-5e");
  mkdirSync(splitDir, { recursive: true });
  for (const [key, entries] of Object.entries(byKey)) {
    writeFileSync(
      join(splitDir, `${key}.json`),
      `${JSON.stringify({ _meta: manifest._meta, [key]: entries }, null, 2)}\n`
    );
  }
  console.log(`[dandwiki] split files -> ${splitDir}`);
}
