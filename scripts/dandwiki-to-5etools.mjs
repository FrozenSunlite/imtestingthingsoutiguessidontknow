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
  races: { key: "race", seeds: ["Alphabetical_5e_Races", "5e_Subraces"] },
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
  other: { key: "optionalfeature", seeds: ["5e_Other"] },
  builds: { key: "optionalfeature", seeds: ["5e_Optimized_Character_Builds"] },
};

const SUFFIX_KEYS = [
  ["5e Spell", "spell"],
  ["5e Creature", "monster"],
  ["5e Class", "class"],
  ["5e Subclass", "subclass"],
  ["5e Race", "race"],
  // The app's Species tab reads `race`; keeping subraces there makes them
  // visible without a second normaliser. `subrace` data lives in `raceName`.
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
  ["5e Other", "optionalfeature"],
];

// 5eTools keeps classes, subclasses and their features in the same files.
// These are the Reference Index file names a split export should use.
const SPLIT_FILES = {
  spell: "spell.json",
  monster: "monster.json",
  class: "class.json",
  subclass: "class.json",
  race: "races.json",
  subrace: "races.json",
  background: "backgrounds.json",
  item: "items.json",
  feat: "feats.json",
  deity: "deities.json",
  trap: "trapshazards.json",
  hazard: "trapshazards.json",
  disease: "conditionsdiseases.json",
  condition: "conditionsdiseases.json",
  reward: "rewards.json",
  variantrule: "variantrules.json",
  optionalfeature: "optionalfeatures.json",
  vehicle: "vehicles.json",
  object: "objects.json",
  encounter: "encounters.json",
  book: "book.json",
  adventure: "adventure.json",
};

const args = process.argv.slice(2);
const arg = (name, fallback = "") => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
};
const has = (name) => args.includes(`--${name}`);
const limit = Math.max(0, Number(arg("limit", "0")) || 0);
const delay = Math.max(100, Number(arg("delay", "300")) || 300);
const concurrency = Math.max(1, Number(arg("concurrency", "4")) || 4);
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

// ---------------------------------------------------------------------------
// Text and DOM helpers
// ---------------------------------------------------------------------------

const clean = (value) =>
  String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\{\{\{[^}]*\}\}\}/g, " ")
    .replace(/\{\{[^{}]*\}\}/g, " ")
    .replace(/\[\s*edit\s*\]/gi, "")
    .replace(/\[\s*citation needed\s*\]/gi, "")
    .replace(/<vote\b[^>]*\/?>/gi, " ")
    .replace(/<!--|-->/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const NOISE_SELECTOR = [
  "script",
  "style",
  ".mw-editsection",
  ".reference",
  "sup.reference",
  ".mw-cite-backlink",
  ".noprint",
  ".navbox",
  ".catlinks",
  ".printfooter",
  ".toc",
  "#toc",
  ".thumb",
  ".mw-collapsible-toggle",
  "vote",
  ".vote",
].join(",");

const NOISE_TEXT = [
  /^This is a (?:featured|quality) article!?$/i,
  /^This article is a stub/i,
  /^The primary contributor has requested no further edits/i,
  /^This page may resemble content endorsed/i,
  /^This is very comprehensive/i,
  /^Back to Main Page/i,
  /^Retrieved from/i,
  /^From D&D Wiki$/i,
];

function isNoiseText(text) {
  const value = clean(text);
  if (!value) return true;
  return NOISE_TEXT.some((re) => re.test(value));
}

function textOf($, element) {
  const copy = $(element).clone();
  copy.find(NOISE_SELECTOR).remove();
  copy.find("br").replaceWith("\n");
  return clean(copy.text());
}

function cellText($, element) {
  return textOf($, element).replace(/\n+/g, " ").trim();
}

function directRows($, table) {
  const rows = [];
  $(table)
    .children("thead,tbody,tfoot")
    .children("tr")
    .each((_, row) => rows.push(row));
  $(table)
    .children("tr")
    .each((_, row) => rows.push(row));
  return rows;
}

function directCells($, row) {
  const cells = [];
  $(row)
    .children("th,td")
    .each((_, cell) => cells.push(cell));
  return cells;
}

function parseTable($, table) {
  const rows = [];
  let colLabels = [];
  for (const row of directRows($, table)) {
    const cells = directCells($, row);
    if (!cells.length) continue;
    const texts = cells.map((cell) => cellText($, cell));
    const allHeaders = cells.every((cell) => cell.tagName?.toLowerCase() === "th");
    if (allHeaders && !rows.length && !colLabels.length) {
      colLabels = texts;
      continue;
    }
    if (allHeaders && !rows.length) continue;
    if (texts.every((text) => !text)) continue;
    rows.push(texts);
  }
  return { type: "table", colLabels, rows };
}

function isQuoteTable($, table) {
  return $(table).is(".cquote") || $(table).hasClass("cquote");
}

function isNoticeTable($, table) {
  const text = cellText($, table);
  return (
    $(table).is(".messagebox,.ambox,.navbox,.protected") ||
    /requested no further edits|rating guidelines|may resemble content endorsed|This page is considered complete/i.test(
      text
    )
  );
}

function isLayoutTable($, table) {
  const rows = directRows($, table);
  if (rows.length > 1) return false;
  const cells = rows.length ? directCells($, rows[0]) : [];
  if (cells.length > 2) return false;
  // A one-cell wrapper around block content is a layout table, not data.
  return cells.some(
    (cell) =>
      $(cell).children("p,div,table,ul,ol,dl,blockquote,h1,h2,h3,h4").length > 0
  );
}

function collectBlocks($, container, title = "") {
  const blocks = [];
  const titleKey = normName(title);
  const walk = (node) => {
    $(node)
      .children()
      .each((_, element) => {
        const tag = element.tagName?.toLowerCase();
        if (!tag) return;
        if (/^h[1-6]$/.test(tag)) {
          const name = clean($(element).text());
          if (!name) return;
          if (titleKey && normName(name) === titleKey) return;
          if (isNoiseText(name)) return;
          blocks.push({ type: "heading", level: Number(tag[1]), name });
          return;
        }
        if (tag === "p") {
          const text = textOf($, element);
          if (text && !isNoiseText(text)) blocks.push({ type: "p", text });
          return;
        }
        if (tag === "ul" || tag === "ol") {
          const items = [];
          $(element)
            .children("li")
            .each((_, li) => {
              const text = textOf($, li);
              if (text && !isNoiseText(text)) items.push(text);
            });
          if (items.length) blocks.push({ type: "list", items });
          return;
        }
        if (tag === "dl") {
          const items = [];
          let current = null;
          $(element)
            .children("dt,dd")
            .each((_, child) => {
              const text = textOf($, child);
              if (!text) return;
              if (child.tagName?.toLowerCase() === "dt") {
                current = { term: text, def: "" };
                items.push(current);
              } else if (current && !current.def) {
                current.def = text;
              } else {
                current = { term: "", def: text };
                items.push(current);
              }
            });
          if (items.length) blocks.push({ type: "dl", items });
          return;
        }
        if (tag === "blockquote") {
          const text = textOf($, element);
          if (text) blocks.push({ type: "quote", text });
          return;
        }
        if (tag === "hr") return;
        if (tag === "table") {
          if (isNoticeTable($, element)) return;
          if (isQuoteTable($, element)) {
            const text = textOf($, element).replace(/[“”"]/g, "").trim();
            if (text) blocks.push({ type: "quote", text });
            return;
          }
          if (isLayoutTable($, element)) {
            walk(element);
            return;
          }
          const table = parseTable($, element);
          const single =
            !table.colLabels.length &&
            table.rows.length === 1 &&
            table.rows[0].length === 1;
          if (single) {
            // Image captions and credit boxes are one-cell tables. Keep a long
            // block of prose, drop the short caption.
            const text = clean(table.rows[0][0]);
            if (text.length > 200) blocks.push({ type: "p", text });
            return;
          }
          if (table.rows.length || table.colLabels.length) blocks.push(table);
          return;
        }
        if (tag === "div" || tag === "section" || tag === "figure") {
          const text = textOf($, element);
          if (isNoiseText(text)) return;
          const hasBlocks = $(element).children(
            "p,div,section,table,ul,ol,dl,blockquote,h1,h2,h3,h4,h5,h6,figure"
          ).length;
          if (hasBlocks) {
            walk(element);
          } else if (text) {
            blocks.push({ type: "p", text });
          }
          return;
        }
        // Layout wrappers (tbody/tr/td) only appear when walking a table cell.
        if (["tbody", "thead", "tfoot", "tr", "td", "th"].includes(tag)) {
          walk(element);
        }
      });
  };
  walk(container);
  return blocks;
}

function blockText(block) {
  if (!block) return "";
  if (block.type === "p") return block.text;
  if (block.type === "quote") return block.text;
  if (block.type === "list") return block.items.join("\n");
  if (block.type === "dl")
    return block.items.map((item) => [item.term, item.def].filter(Boolean).join(": ")).join("\n");
  if (block.type === "table")
    return [block.colLabels || [], ...(block.rows || [])]
      .flat()
      .map((cell) => String(cell || ""))
      .join(" ");
  if (block.type === "heading") return block.name;
  return "";
}

function blocksText(blocks) {
  return blocks.map(blockText).filter(Boolean).join("\n");
}

function blockToEntry(block) {
  if (block.type === "p" || block.type === "quote") return block.text;
  if (block.type === "list") return { type: "list", items: block.items };
  if (block.type === "dl") {
    return {
      type: "list",
      items: block.items
        .map((item) => [item.term, item.def].filter(Boolean).join(": "))
        .filter(Boolean),
    };
  }
  if (block.type === "table") return block;
  return null;
}

function blocksToEntries(blocks) {
  const root = [];
  const stack = [{ level: 0, entries: root }];
  for (const block of blocks) {
    if (block.type === "heading") {
      while (stack.length > 1 && stack[stack.length - 1].level >= block.level) {
        stack.pop();
      }
      const section = { type: "entries", name: block.name, entries: [] };
      stack[stack.length - 1].entries.push(section);
      stack.push({ level: block.level, entries: section.entries });
    } else {
      const entry = blockToEntry(block);
      if (entry) stack[stack.length - 1].entries.push(entry);
    }
  }
  return pruneEntries(root);
}

function pruneEntries(entries) {
  const out = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (entry == null) continue;
    if (typeof entry === "string") {
      const text = clean(entry);
      if (text && !isNoiseText(text)) out.push(text);
      continue;
    }
    if (entry.type === "entries") {
      const children = pruneEntries(entry.entries);
      if (children.length) out.push({ ...entry, entries: children });
      continue;
    }
    if (entry.type === "list") {
      const items = (entry.items || []).map(clean).filter((item) => item && !isNoiseText(item));
      if (items.length) out.push({ ...entry, items });
      continue;
    }
    if (entry.type === "table") {
      const rows = (entry.rows || []).filter((row) => row.some((cell) => clean(cell)));
      if (rows.length) out.push({ ...entry, rows });
      continue;
    }
    out.push(entry);
  }
  return out;
}

function sectionContent(blocks, index) {
  const heading = blocks[index];
  const level = heading.level;
  let end = blocks.length;
  for (let i = index + 1; i < blocks.length; i += 1) {
    if (blocks[i].type === "heading" && blocks[i].level <= level) {
      end = i;
      break;
    }
  }
  return blocks.slice(index + 1, end);
}

function normName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(feature|features)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferLevel(text) {
  const value = String(text || "");
  const patterns = [
    /(?:starting at|beginning at|at|when you reach|upon reaching|when you reach the)\s+(?:the\s+)?(\d+)(?:st|nd|rd|th)?\s+level/i,
    /(\d+)(?:st|nd|rd|th)[- ]level/i,
  ];
  for (const re of patterns) {
    const m = value.match(re);
    if (m) {
      const level = Number(m[1]);
      if (level >= 1 && level <= 30) return level;
    }
  }
  return 0;
}

function parseLevelCell(text) {
  const m = String(text || "").match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

// ---------------------------------------------------------------------------
// Category-specific parsers
// ---------------------------------------------------------------------------

const SCHOOL_CODES = {
  abjuration: "A",
  conjuration: "C",
  divination: "D",
  enchantment: "E",
  evocation: "V",
  illusion: "I",
  necromancy: "N",
  transmutation: "T",
};

const SIZE_CODES = {
  tiny: "T",
  small: "S",
  medium: "M",
  large: "L",
  huge: "H",
  gargantuan: "G",
};

const ABILITY_KEYS = {
  str: "str",
  strength: "str",
  dex: "dex",
  dexterity: "dex",
  con: "con",
  constitution: "con",
  int: "int",
  intelligence: "int",
  wis: "wis",
  wisdom: "wis",
  cha: "cha",
  charisma: "cha",
};

function parseSpellTime(text) {
  const raw = clean(text);
  if (!raw) return undefined;
  const units = {
    action: "action",
    "bonus action": "bonus",
    reaction: "reaction",
    round: "round",
    minute: "minute",
    hour: "hour",
    day: "day",
  };
  const out = [];
  for (const piece of raw.split(/,|\bor\b/i)) {
    const part = piece.trim();
    if (!part) continue;
    const m = part.match(/^(\d+)\s*(action|bonus action|reaction|round|minute|hour|day)s?\b/i);
    if (m) {
      const value = { number: Number(m[1]) || 1, unit: units[m[2].toLowerCase()] || m[2].toLowerCase() };
      const condition = part.slice(m[0].length).replace(/^[\s,]+/, "").trim();
      if (condition) value.condition = condition;
      out.push(value);
    } else {
      out.push({ number: 1, unit: "special", condition: part });
    }
  }
  return out.length ? out : undefined;
}

function parseSpellRange(text) {
  const value = clean(text);
  if (!value) return undefined;
  if (/^self\b/i.test(value)) return value;
  const m = value.match(/^(\d+)\s*(feet|foot|miles?|meters?)\b/i);
  if (m) {
    return {
      type: "point",
      distance: {
        type: m[2].toLowerCase().startsWith("mile") ? "miles" : "feet",
        amount: Number(m[1]),
      },
    };
  }
  if (/^touch$/i.test(value)) return { type: "touch" };
  if (/^special$/i.test(value)) return { type: "special" };
  if (/^sight$|^unlimited$/i.test(value)) return { type: "special" };
  return value;
}

function cpFromCost(amount, unit) {
  const n = Number(String(amount).replace(/,/g, ""));
  if (!Number.isFinite(n)) return undefined;
  const factor = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }[String(unit).toLowerCase()] || 1;
  return n * factor;
}

function parseSpellComponents(text) {
  const value = clean(text);
  const out = { v: /\bV\b/.test(value), s: /\bS\b/.test(value), m: false };
  const m = value.match(/\bM\s*(?:\(([^)]*)\))?/i);
  if (m) {
    const material = clean(m[1] || "");
    out.m = { text: material || "material component" };
    const cost = material.match(/([\d,.]+)\s*(cp|sp|ep|gp|pp)/i);
    if (cost) out.m.cost = cpFromCost(cost[1], cost[2]);
    if (/consum|destroy/i.test(material)) out.m.consume = true;
  }
  return out;
}

function parseSpellDuration(text) {
  const value = clean(text);
  if (!value) return undefined;
  const concentration = /concentration/i.test(value);
  if (/instant/i.test(value)) {
    return concentration
      ? [{ type: "timed", duration: { type: "instant", amount: 0 }, concentration: true }]
      : [{ type: "instant" }];
  }
  if (/permanent/i.test(value)) return [{ type: "permanent" }];
  const m = value.match(/(\d+)\s*(round|minute|hour|day|year)s?/i);
  if (m) {
    const duration = { type: "timed", duration: { type: m[2].toLowerCase(), amount: Number(m[1]) } };
    if (concentration) duration.concentration = true;
    return [duration];
  }
  if (/until dispelled|special/i.test(value)) return [{ type: "special", note: value }];
  return [value];
}

function parseSpellTable($, root) {
  const table = root
    .find("table")
    .toArray()
    .find(
      (element) =>
        /Casting time/i.test($(element).text()) &&
        /Duration/i.test($(element).text()) &&
        /Range/i.test($(element).text())
    );
  if (!table) return null;
  const data = {};
  for (const row of directRows($, table)) {
    const cells = directCells($, row);
    if (!cells.length) continue;
    if (cells.length === 1) {
      const line = cellText($, cells[0]);
      const level = line.match(/(\d+)(?:st|nd|rd|th)-level\s+([A-Za-z]+)/i);
      const cantrip = line.match(/\b([A-Za-z]+)\s+cantrip\b/i) || line.match(/\bcantrip\b/i);
      if (level) {
        data.level = Number(level[1]);
        data.school = level[2].toLowerCase();
      } else if (cantrip) {
        data.level = 0;
        data.school = (cantrip[1] || "").toLowerCase();
      }
      continue;
    }
    const label = cellText($, cells[0]).replace(/:$/, "").toLowerCase();
    const value = cellText($, cells[1]);
    if (/casting time/.test(label)) data.timeText = value;
    else if (/^range/.test(label)) data.rangeText = value;
    else if (/components?/.test(label)) data.componentsText = value;
    else if (/duration/.test(label)) data.durationText = value;
  }
  $(table).remove();
  return data;
}

function finalizeSpell(entry, blocks) {
  const text = blocksText(blocks);
  if (entry.timeText == null) {
    const value = text.match(/Casting time\s*:\s*([^\n]+)/i);
    if (value) entry.timeText = clean(value[1]);
  }
  if (entry.rangeText == null) {
    const value = text.match(/Range\s*:\s*([^\n]+)/i);
    if (value) entry.rangeText = clean(value[1]);
  }
  if (entry.componentsText == null) {
    const value = text.match(/Components?\s*:\s*([^\n]+)/i);
    if (value) entry.componentsText = clean(value[1]);
  }
  if (entry.durationText == null) {
    const value = text.match(/Duration\s*:\s*([^\n]+)/i);
    if (value) entry.durationText = clean(value[1]);
  }
  if (entry.level == null) {
    const level = text.match(/(\d+)(?:st|nd|rd|th)-level\s+([A-Za-z]+)/i);
    if (level) {
      entry.level = Number(level[1]);
      entry.school = level[2].toLowerCase();
    } else if (/\bcantrip\b/i.test(text)) {
      entry.level = 0;
      const cantrip = text.match(/\b([A-Za-z]+)\s+cantrip\b/i);
      entry.school = (cantrip?.[1] || "").toLowerCase();
    }
  }

  entry.schoolCode = SCHOOL_CODES[String(entry.school || "").toLowerCase()] || entry.school;
  entry.time = parseSpellTime(entry.timeText);
  entry.range = parseSpellRange(entry.rangeText);
  entry.components = parseSpellComponents(entry.componentsText || "");
  entry.duration = parseSpellDuration(entry.durationText);
  delete entry.timeText;
  delete entry.rangeText;
  delete entry.componentsText;
  delete entry.durationText;
  entry.school = SCHOOL_CODES[String(entry.school || "").toLowerCase()] || entry.school;

  const entries = blocksToEntries(blocks);
  const higher = [];
  const kept = [];
  for (const item of entries) {
    if (typeof item === "string" && /^At Higher Levels?\b/i.test(item)) {
      higher.push(item.replace(/^At Higher Levels?\.?\s*/i, ""));
      continue;
    }
    if (
      item &&
      typeof item === "object" &&
      item.type === "entries" &&
      /^At Higher Levels?$/i.test(item.name)
    ) {
      higher.push(...item.entries);
      continue;
    }
    kept.push(item);
  }
  entry.entries = pruneEntries(kept);
  if (higher.length) entry.higherLevel = pruneEntries(higher);
}

function parseAbilityTable($, table) {
  const rows = directRows($, table);
  if (rows.length < 2) return {};
  const labels = directCells($, rows[0]).map((cell) => cellText($, cell).toLowerCase());
  const values = directCells($, rows[1]).map((cell) => cellText($, cell));
  const out = {};
  labels.forEach((label, index) => {
    const key = ABILITY_KEYS[label.replace(/[^a-z]/g, "")];
    const m = String(values[index] || "").match(/(-?\d+)/);
    if (key && m) out[key] = Number(m[1]);
  });
  return out;
}

function parseMods(text) {
  const out = {};
  for (const part of String(text || "").split(/[,;]/)) {
    const m = part.trim().match(/^([A-Za-z]+)\s*([+-]\s*\d+)/);
    if (!m) continue;
    const key = ABILITY_KEYS[m[1].toLowerCase()];
    if (key) out[key] = Number(m[2].replace(/\s+/g, ""));
  }
  return out;
}

function parseNamedMods(text) {
  const out = {};
  for (const part of String(text || "").split(/[,;]/)) {
    const m = part.trim().match(/^([A-Za-z][A-Za-z' ]*?)\s*([+-]\s*\d+)/);
    if (!m) continue;
    const key = m[1].toLowerCase().replace(/[^a-z]/g, "");
    if (key) out[key] = Number(m[2].replace(/\s+/g, ""));
  }
  return out;
}

function parseSpeed(text) {
  const out = {};
  for (const part of String(text || "").split(/,\s*/)) {
    const value = part.trim();
    if (!value) continue;
    const m = value.match(/^([A-Za-z]+(?:\s*\([^)]*\))?)?\s*(\d+)\s*(?:ft\.?|feet|foot)/i);
    if (!m) continue;
    const label = (m[1] || "walk").toLowerCase().replace(/\s*\(.*$/, "").trim();
    const amount = Number(m[2]);
    if (!amount) continue;
    if (/fly|swim|climb|burrow|walk/.test(label)) out[label] = amount;
    else out.walk = amount;
  }
  return out;
}

function parseMonsterType(line) {
  const value = clean(line);
  const m = value.match(
    /^((?:Tiny|Small|Medium|Large|Huge|Gargantuan)(?:\s+or\s+(?:Tiny|Small|Medium|Large|Huge|Gargantuan))?)\s+([A-Za-z ]+?)(?:\s*\(([^)]*)\))?(?:\s*,\s*(.+))?$/i
  );
  if (!m) return {};
  const sizes = m[1]
    .split(/\s+or\s+/i)
    .map((size) => SIZE_CODES[size.trim().toLowerCase()] || size.trim());
  const type = m[2].trim().toLowerCase();
  const tags = m[3] ? m[3].split(/[,;]/).map((tag) => tag.trim()).filter(Boolean) : [];
  return {
    size: sizes,
    type: tags.length ? { type, tags } : { type },
    alignment: m[4] ? m[4].split(/,\s*/).filter(Boolean) : undefined,
  };
}

function parseFeatureLine(text) {
  const value = clean(text);
  const m =
    value.match(/^([^.:]{1,100}?)[.:]\s*(.+)$/s) ||
    value.match(/^([^.]{1,100}?)\.\s*(.+)$/s);
  if (!m) return null;
  const name = clean(m[1]);
  const body = clean(m[2]);
  if (!name || !body) return null;
  if (/^(Armor Class|Hit Points|Speed|Saving Throws|Skills|Senses|Languages|Challenge|Proficiency Bonus|Damage|Condition)/i.test(name)) {
    return null;
  }
  return { name, entries: [body] };
}

function parseMonster($, root, entry) {
  const table = root
    .find("table")
    .toArray()
    .find(
      (element) =>
        /Armor Class/i.test($(element).text()) &&
        /Hit Points/i.test($(element).text()) &&
        $(element).find("table").length
    );
  if (!table) return;
  const statCell = $(table).find("td").first();
  const sections = {
    trait: [],
    action: [],
    bonus: [],
    reaction: [],
    legendary: [],
    lair: [],
    mythic: [],
  };
  let current = sections.trait;
  let typeLine = "";

  $(statCell)
    .children()
    .each((_, element) => {
      const tag = element.tagName?.toLowerCase();
      if (tag === "table") {
        const abilities = parseAbilityTable($, element);
        Object.assign(entry, abilities);
        return;
      }
      if (/^h[3-6]$/.test(tag)) {
        const heading = clean($(element).text()).toLowerCase();
        if (/bonus action/.test(heading)) current = sections.bonus;
        else if (/reaction/.test(heading)) current = sections.reaction;
        else if (/legendary action/.test(heading)) current = sections.legendary;
        else if (/lair action/.test(heading)) current = sections.lair;
        else if (/mythic action/.test(heading)) current = sections.mythic;
        else if (/action/.test(heading)) current = sections.action;
        else current = sections.trait;
        return;
      }
      if (tag !== "p") return;
      const lines = textOf($, element)
        .split(/\n+/)
        .map(clean)
        .filter(Boolean);
      for (const line of lines) {
        if (/^Armor Class\b/i.test(line)) {
          const value = line.match(/Armor Class\s*(\d+)\s*(?:\(([^)]*)\))?/i);
          if (value) {
            entry.ac = [{ ac: Number(value[1]) }];
            if (value[2]) entry.ac[0].from = [clean(value[2])];
          }
        } else if (/^Hit Points\b/i.test(line)) {
          const value = line.match(/Hit Points\s*(\d+)\s*(?:\(([^)]*)\))?/i);
          if (value) {
            entry.hp = { average: Number(value[1]) };
            if (value[2]) entry.hp.formula = clean(value[2]);
          }
        } else if (/^Speed\b/i.test(line)) {
          entry.speed = parseSpeed(line.replace(/^Speed\s*/i, ""));
        } else if (/^Saving Throws\b/i.test(line)) {
          entry.saves = parseMods(line.replace(/^Saving Throws\s*/i, ""));
        } else if (/^Skills\b/i.test(line)) {
          entry.skills = parseNamedMods(line.replace(/^Skills\s*/i, ""));
        } else if (/^Senses\b/i.test(line)) {
          const text = line.replace(/^Senses\s*/i, "");
          entry.senses = text.split(/,\s*/).map(clean).filter(Boolean);
          const passive = text.match(/passive\s+Perception\s+(\d+)/i);
          if (passive) entry.passive = Number(passive[1]);
        } else if (/^Languages\b/i.test(line)) {
          const text = line.replace(/^Languages\s*/i, "");
          entry.languages = /^(—|-|none)$/i.test(text)
            ? []
            : text.split(/,\s*/).map(clean).filter(Boolean);
        } else if (/^Challenge\b/i.test(line)) {
          const value = line.match(/Challenge\s*([\d/]+)\s*(?:\(([^)]*)\))?/i);
          if (value) {
            entry.cr = value[1];
            if (value[2]) {
              const xp = value[2].match(/([\d,]+)\s*XP/i);
              if (xp) entry.xp = xp[1].replace(/,/g, "");
            }
          }
        } else if (/^Proficiency Bonus\b/i.test(line)) {
          const value = line.match(/([+-]\d+)/);
          if (value) entry.pb = value[1].replace("+", "");
        } else if (/^Damage Vulnerabilities\b/i.test(line)) {
          entry.damageVuln = line
            .replace(/^Damage Vulnerabilities\s*/i, "")
            .split(/,\s*/)
            .map(clean)
            .filter(Boolean);
        } else if (/^Damage Resistances\b/i.test(line)) {
          entry.damageResist = line
            .replace(/^Damage Resistances\s*/i, "")
            .split(/,\s*/)
            .map(clean)
            .filter(Boolean);
        } else if (/^Damage Immunities\b/i.test(line)) {
          entry.damageImmune = line
            .replace(/^Damage Immunities\s*/i, "")
            .split(/,\s*/)
            .map(clean)
            .filter(Boolean);
        } else if (/^Condition Immunities\b/i.test(line)) {
          entry.conditionImmune = line
            .replace(/^Condition Immunities\s*/i, "")
            .split(/,\s*/)
            .map(clean)
            .filter(Boolean);
        } else if (!typeLine && /^[A-Z][A-Za-z]+ .+,\s*(lawful|neutral|chaotic|any|unaligned|good|evil)/i.test(line)) {
          typeLine = line;
          Object.assign(entry, parseMonsterType(line));
        } else {
          const feature = parseFeatureLine(line);
          if (feature) current.push(feature);
          else if (line) current.push({ name: "", entries: [line] });
        }
      }
    });

  if (!typeLine) {
    const first = $(statCell).find("p").first().text();
    const match = clean(first).match(/^([A-Z][A-Za-z]+ [^,]+,\s*.+)$/);
    if (match) Object.assign(entry, parseMonsterType(match[1]));
  }

  for (const [key, list] of Object.entries(sections)) {
    const cleaned = list.filter((item) => item.name || item.entries?.length);
    if (cleaned.length) entry[key] = cleaned;
  }

  // The right-hand column is lore/flavor, not mechanics.
  const cells = $(table).find("> tbody > tr > td, > tr > td");
  if (cells.length > 1) {
    const right = $(cells[1]).clone();
    right.find(NOISE_SELECTOR).remove();
    right.find("table.cquote, .thumb, .navbox, .messagebox").remove();
    const paragraphs = [];
    right.find("p").each((_, element) => {
      const text = textOf($, element);
      if (text && !isNoiseText(text)) paragraphs.push(text);
    });
    const description = clean(paragraphs.join("\n\n"));
    if (description) {
      entry.description = description;
      entry.entries = [description];
    }
  }

  $(table).remove();
}

function parseClassTable($, root) {
  const table = root
    .find("table")
    .toArray()
    .find((element) => {
      const text = $(element).text();
      return /(^|\n)\s*Level\b/i.test(text) && /\bFeatures\b/i.test(text) && directRows($, element).length > 4;
    });
  if (!table) return { table: null, levels: new Map() };
  const rows = directRows($, table);
  const levels = new Map();
  let featureIndex = -1;
  for (const row of rows) {
    const cells = directCells($, row);
    const texts = cells.map((cell) => cellText($, cell));
    if (featureIndex < 0) {
      const index = texts.findIndex((text) => /^features?$/i.test(text));
      if (index >= 0) featureIndex = index;
      continue;
    }
    const level = parseLevelCell(texts[0]);
    if (!level || !cells[featureIndex]) continue;
    const cell = cells[featureIndex];
    const names = [];
    $(cell)
      .find("a")
      .each((_, link) => {
        const text = clean($(link).text());
        if (text && !/^\d+$/.test(text)) names.push(text);
      });
    if (!names.length) {
      const text = texts[featureIndex];
      if (text && !/^(—|-)$/.test(text)) {
        names.push(...text.split(/,\s*/).map(clean).filter(Boolean));
      }
    }
    for (const name of names) {
      const key = normName(name);
      if (key && !levels.has(key)) levels.set(key, level);
    }
  }
  return { table, levels };
}

function matchFeatureLevel(name, levels, contentText) {
  const key = normName(name);
  if (key && levels.has(key)) return levels.get(key);
  for (const [tableName, level] of levels.entries()) {
    if (tableName && (tableName.includes(key) || key.includes(tableName))) return level;
  }
  return inferLevel(contentText);
}

function extractSubclassFeatures(blocks, className, subName) {
  const features = [];
  const intro = [];
  let pending = null;
  const flush = () => {
    if (!pending) return;
    const text = blocksText(pending.blocks);
    const level = inferLevel(text);
    if (level) {
      features.push({
        name: pending.name,
        level,
        className,
        classSource: "DANDWIKI",
        subclassShortName: subName,
        source: "DANDWIKI",
        entries: blocksToEntries(pending.blocks),
      });
    } else {
      intro.push(pending.name);
      intro.push(...pending.blocks);
    }
    pending = null;
  };
  for (let k = 0; k < blocks.length; k += 1) {
    const block = blocks[k];
    if (block.type === "heading" && block.level >= 4) {
      flush();
      const content = sectionContent(blocks, k);
      const level = inferLevel(blocksText(content));
      if (level) {
        features.push({
          name: block.name,
          level,
          className,
          classSource: "DANDWIKI",
          subclassShortName: subName,
          source: "DANDWIKI",
          entries: blocksToEntries(content),
        });
      } else {
        intro.push(block, ...content);
      }
      // sectionContent already consumed the nested blocks; skip them.
      let end = blocks.length;
      for (let j = k + 1; j < blocks.length; j += 1) {
        if (blocks[j].type === "heading" && blocks[j].level <= block.level) {
          end = j;
          break;
        }
      }
      k = end - 1;
      continue;
    }
    if (block.type === "dl") {
      const term = block.items.find((item) => item.term && !item.def);
      if (term) {
        flush();
        pending = { name: term.term, blocks: [] };
      } else {
        intro.push(block);
      }
      continue;
    }
    if (block.type === "p" && pending) {
      pending.blocks.push(block);
      continue;
    }
    if (!pending) intro.push(block);
  }
  flush();
  return { features, intro };
}

function parseClass($, root, entry) {
  const { table, levels } = parseClassTable($, root);
  if (table) $(table).remove();
  const blocks = collectBlocks($, root, entry.name);
  const features = [];

  const classIndex = blocks.findIndex(
    (block) => block.type === "heading" && /^class features$/i.test(block.name)
  );
  let classEnd = blocks.length;
  let featureLevel = 0;
  if (classIndex >= 0) {
    const featureStartIndex = (() => {
      for (let i = classIndex + 1; i < blocks.length; i += 1) {
        if (blocks[i].type === "heading") return i;
      }
      return -1;
    })();
    if (featureStartIndex >= 0) {
      const parentLevel = blocks[classIndex].level;
      featureLevel = blocks[featureStartIndex].level;
      for (let i = featureStartIndex; i < blocks.length; i += 1) {
        if (blocks[i].type === "heading" && blocks[i].level <= parentLevel) {
          classEnd = i;
          break;
        }
      }
      if (featureLevel <= parentLevel) featureLevel = parentLevel + 1;
    }
  }

  if (classIndex >= 0 && featureLevel) {
    for (let i = classIndex + 1; i < classEnd; i += 1) {
      const block = blocks[i];
      if (block.type !== "heading" || block.level !== featureLevel) continue;
      const content = sectionContent(blocks, i);
      const level = matchFeatureLevel(block.name, levels, blocksText(content));
      if (!level) continue;
      features.push({
        name: block.name,
        level,
        className: entry.name,
        classSource: "DANDWIKI",
        source: "DANDWIKI",
        entries: blocksToEntries(content),
      });
    }
  }

  // Fallback for pages that describe features without a "Class Features"
  // heading: trust the class table's feature -> level mapping.
  if (!features.length) {
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      if (block.type !== "heading" || block.level < 3) continue;
      const content = sectionContent(blocks, i);
      const level = matchFeatureLevel(block.name, levels, "");
      if (!level) continue;
      features.push({
        name: block.name,
        level,
        className: entry.name,
        classSource: "DANDWIKI",
        source: "DANDWIKI",
        entries: blocksToEntries(content),
      });
    }
  }

  const introEnd = classIndex >= 0 ? classIndex : features.length ? 0 : blocks.length;
  entry.entries = blocksToEntries(blocks.slice(0, introEnd));

  const hitDice = blocksText(blocks).match(/Hit Dice:\s*(\d+)d(\d+)/i);
  if (hitDice) entry.hd = { number: Number(hitDice[1]), faces: Number(hitDice[2]) };
  const quick = blocksText(blocks).match(/Quick Build[\s\S]{0,400}/i);
  if (quick) entry.quickBuild = clean(quick[0]);

  const subclasses = [];
  const subclassFeatures = [];
  const isSubclassName = (name) => {
    if (/multiclass|spell list|references|treasures|equipment|creating|adventure|class features/i.test(name)) {
      return false;
    }
    const key = normName(name);
    for (const tableName of levels.keys()) {
      if (!tableName) continue;
      if (key === tableName || key.includes(tableName) || tableName.includes(key)) return false;
    }
    return true;
  };

  for (let i = classEnd; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (block.type !== "heading" || block.level !== 3) continue;
    if (!isSubclassName(block.name)) continue;
    let end = blocks.length;
    for (let k = i + 1; k < blocks.length; k += 1) {
      if (blocks[k].type === "heading" && blocks[k].level <= 3) {
        end = k;
        break;
      }
    }
    const extracted = extractSubclassFeatures(blocks.slice(i + 1, end), entry.name, block.name);
    if (!extracted.features.length) continue;
    subclasses.push({
      name: block.name,
      shortName: block.name,
      className: entry.name,
      classSource: "DANDWIKI",
      source: "DANDWIKI",
      entries: blocksToEntries(extracted.intro),
    });
    subclassFeatures.push(...extracted.features);
    i = end - 1;
  }

  return { features, subclasses, subclassFeatures };
}

function parseSubclass($, root, entry) {
  const blocks = collectBlocks($, root, entry.name);
  const classNameBlock = blocks.find(
    (block) => block.type === "p" && /^[A-Za-z][A-Za-z ]{1,30}\s+Subclass\b/i.test(block.text)
  );
  const className =
    (classNameBlock
      ? clean(classNameBlock.text.match(/^([A-Za-z][A-Za-z ]{1,30}?)\s+Subclass\b/i)?.[1] || "")
      : "") || "Unknown";
  const features = [];
  const intro = [];
  let pending = null;
  const flush = () => {
    if (!pending) return;
    const level = inferLevel(blocksText(pending.blocks));
    if (level) {
      features.push({
        name: pending.name,
        level,
        className,
        classSource: "DANDWIKI",
        subclassShortName: entry.name,
        source: "DANDWIKI",
        entries: blocksToEntries(pending.blocks),
      });
    } else {
      intro.push(pending.name, ...pending.blocks);
    }
    pending = null;
  };

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (block.type === "heading" && block.level >= 3) {
      const headingKey = normName(block.name);
      const entryKey = normName(entry.name);
      if (headingKey === entryKey || (headingKey && entryKey.includes(headingKey))) continue;
      flush();
      const content = sectionContent(blocks, i);
      const level = inferLevel(blocksText(content));
      if (level) {
        features.push({
          name: block.name,
          level,
          className,
          classSource: "DANDWIKI",
          subclassShortName: entry.name,
          source: "DANDWIKI",
          entries: blocksToEntries(content),
        });
      } else {
        intro.push(block, ...content);
      }
      // sectionContent already consumed the nested blocks; skip them.
      let end = i + 1;
      for (let k = i + 1; k < blocks.length; k += 1) {
        if (blocks[k].type === "heading" && blocks[k].level <= block.level) {
          end = k;
          break;
        }
        if (k === blocks.length - 1) end = blocks.length;
      }
      i = end - 1;
      continue;
    }
    if (block.type === "dl") {
      const term = block.items.find((item) => item.term && !item.def);
      if (term) {
        flush();
        pending = { name: term.term, blocks: [] };
      } else {
        flush();
        intro.push(block);
      }
      continue;
    }
    if (block.type === "p" && pending) {
      pending.blocks.push(block);
      continue;
    }
    if (block.type === "p" && classNameBlock && block.text === classNameBlock.text) {
      continue;
    }
    if (!pending) intro.push(block);
  }
  flush();
  entry.className = className;
  entry.shortName = entry.name;
  entry.entries = blocksToEntries(intro);
  return features;
}

function parseRaceTraits($, root) {
  const table = root
    .find("table")
    .toArray()
    .find((element) => {
      if (isQuoteTable($, element) || isNoticeTable($, element)) return false;
      const text = $(element).text();
      // Full race pages also list Age/Size/Speed/Languages; subrace pages
      // often only list the Ability Score Increase and their own traits.
      return (
        /Ability Score Increase/i.test(text) &&
        (/(Age|Size|Speed|Languages)/i.test(text) || directRows($, element).length >= 2)
      );
    });
  if (!table) return [];
  const entries = [];
  for (const row of directRows($, table)) {
    const cells = directCells($, row);
    for (const cell of cells) {
      const copy = $(cell).clone();
      copy.find(NOISE_SELECTOR).remove();
      copy.find("br").replaceWith("\n");
      for (const raw of copy.text().split(/\n+/)) {
        const text = clean(raw);
        if (!text || isNoiseText(text)) continue;
        const m = text.match(/^([A-Za-z][^.]{1,70})\.\s*(.+)$/s);
        if (m && !/^Your (size|base walking speed)/i.test(m[1])) {
          entries.push({ type: "entries", name: clean(m[1]), entries: [clean(m[2])] });
        } else {
          entries.push(text);
        }
      }
    }
  }
  if (table) $(table).remove();
  return entries;
}

const ITEM_KINDS = [
  /^wondrous item/i,
  /^weapon\b/i,
  /^armor\b/i,
  /^shield\b/i,
  /^potion\b/i,
  /^ring\b/i,
  /^rod\b/i,
  /^scroll\b/i,
  /^staff\b/i,
  /^wand\b/i,
  /^ammunition\b/i,
  /^vehicle\b/i,
  /^trade good\b/i,
  /^poison\b/i,
  /^magic item\b/i,
];

function parseRarity(text) {
  const value = clean(text);
  const m = value.match(/\b(common|uncommon|rare|very rare|legendary|artifact|varies)\b/i);
  return m ? m[1].toLowerCase() : "none";
}

function itemCode(kind, text) {
  const value = `${kind} ${text}`.toLowerCase();
  if (/^wondrous|^magic item/.test(kind.toLowerCase())) return { wondrous: true };
  if (/^weapon/.test(kind.toLowerCase())) return { type: /\branged\b/i.test(value) ? "R" : "M" };
  if (/^armor|^shield/.test(kind.toLowerCase())) {
    if (/shield/.test(value)) return { type: "S" };
    if (/light/.test(value)) return { type: "LA" };
    if (/heavy/.test(value)) return { type: "HA" };
    return { type: "MA" };
  }
  if (/^potion/.test(kind.toLowerCase())) return { type: "P" };
  if (/^ring/.test(kind.toLowerCase())) return { type: "RG" };
  if (/^rod/.test(kind.toLowerCase())) return { type: "RD" };
  if (/^scroll/.test(kind.toLowerCase())) return { type: "SC" };
  if (/^staff/.test(kind.toLowerCase())) return { type: "ST" };
  if (/^wand/.test(kind.toLowerCase())) return { type: "WD" };
  if (/^ammunition/.test(kind.toLowerCase())) return { type: "A" };
  if (/^vehicle/.test(kind.toLowerCase())) return { type: "VEH" };
  if (/^trade good/.test(kind.toLowerCase())) return { type: "TG" };
  return { wondrous: true };
}

function parseItem($, root, entry) {
  const tables = root.find("table").toArray();
  const table = tables.find((element) => {
    if ($(element).find("table").length) return false;
    if (isQuoteTable($, element) || isNoticeTable($, element)) return false;
    const first = directRows($, element)
      .slice(0, 2)
      .map((row) => directCells($, row).map((cell) => cellText($, cell)).join(" "))
      .join(" ")
      .trim();
    return ITEM_KINDS.some((re) => re.test(first)) && /,\s*(common|uncommon|rare|very rare|legendary|artifact|varies|none)/i.test(first);
  });
  if (!table) return;
  const rows = directRows($, table);
  let typeLine = "";
  const entries = [];
  for (const row of rows) {
    const cells = directCells($, row);
    if (!cells.length) continue;
    const text = cellText($, cells[0]);
    if (!typeLine && ITEM_KINDS.some((re) => re.test(text)) && /,/i.test(text)) {
      typeLine = text;
      continue;
    }
    // Hidden template rows are not real content.
    if (/display\s*:\s*none/i.test($(row).attr("style") || "")) continue;
    const cell = cells[0];
    // Flavor text often sits directly in the cell rather than inside a <p>.
    // Keep the whole inline run (including link text) so sentences stay intact.
    const inline = $(cell).clone();
    inline
      .find("p,ul,ol,dl,table,div,section,figure,blockquote,h1,h2,h3,h4,h5,h6")
      .remove();
    const inlineText = textOf($, inline);
    const blocks = collectBlocks($, cell, "");
    const cellEntries = blocksToEntries(blocks);
    if (!cellEntries.length) {
      const plain = textOf($, cell);
      if (plain && !isNoiseText(plain)) entries.push(plain);
    } else {
      if (inlineText && !isNoiseText(inlineText)) entries.push(inlineText);
      entries.push(...cellEntries);
    }
  }
  $(table).remove();

  const parsed = clean(typeLine).match(/^(.+?),\s*(.+)$/);
  const kind = clean(parsed ? parsed[1] : typeLine) || "Wondrous item";
  const rarity = parseRarity(parsed ? parsed[2] : typeLine);
  const code = itemCode(kind, kind);
  Object.assign(entry, code);
  entry.rarity = rarity;
  entry.itemKind = kind;
  const base = kind.match(/\(([^)]+)\)/);
  if (base) entry.baseItem = clean(base[1]);
  const text = cellText($, table);
  const weight = text.match(/Weight\s*[:.]?\s*([\d.]+)\s*lb/i);
  if (weight) entry.weight = Number(weight[1]);
  const cost = text.match(/(?:Cost|Price|Value)\s*[:.]?\s*([\d,.]+)\s*(cp|sp|ep|gp|pp)/i);
  if (cost) entry.value = cpFromCost(cost[1], cost[2]);
  const damage = text.match(/(\d+d\d+)\s+(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)/i);
  if (damage && entry.type === "M") {
    entry.dmg1 = damage[1];
    entry.dmgType = damage[2][0].toUpperCase();
  }
  const ac = text.match(/\bAC\s*(\d+)|\bArmor Class\s*(\d+)/i);
  if (ac) entry.ac = Number(ac[1] || ac[2]);
  entry.entries = pruneEntries(entries);
}

function parseDeity($, root, entry, blocks) {
  const lines = blocks.map(blockText).filter(Boolean).join("\n");
  const alignment = lines.match(/Alignment\.?\s*([A-Za-z ]+?)(?=\s+(?:Domains?|Divine Rank|Pantheon|Symbol)\.|$)/i);
  const domains = lines.match(/Domains?\.?\s*([A-Za-z ,]+?)(?=\s+(?:Divine Rank|Pantheon|Symbol)\.|$)/i);
  const rank = lines.match(/Divine Rank\.?\s*([^\n]+?)(?=\s+(?:Pantheon|Symbol)\.|\n|$)/i);
  const symbol = lines.match(/Symbol:\s*([^\n]+)/i);
  const pantheon = lines.match(/Pantheon\.?\s*([^\n.]+)/i);
  if (alignment) entry.alignment = clean(alignment[1]);
  if (domains) entry.domains = domains[1].split(/,|\band\b/i).map(clean).filter(Boolean);
  if (rank) entry.rank = clean(rank[1]);
  if (symbol) entry.symbol = clean(symbol[1]);
  if (pantheon) entry.pantheon = clean(pantheon[1]);
  entry.entries = blocksToEntries(
    blocks.filter(
      (block) =>
        !(
          block.type === "p" &&
          /^(Symbol:|Alignment|Domains?|Divine Rank|Pantheon)\.?/i.test(block.text)
        )
    )
  );
}

function parseGeneric(entry, blocks) {
  entry.entries = blocksToEntries(blocks);
}

// ---------------------------------------------------------------------------
// Page loading and assembly
// ---------------------------------------------------------------------------

function pruneNoise($, root) {
  root.find(NOISE_SELECTOR).remove();
  root.find("tr").each((_, row) => {
    if (/display\s*:\s*none/i.test($(row).attr("style") || "")) $(row).remove();
  });
  root.find("table").each((_, table) => {
    if (isNoticeTable($, table)) $(table).remove();
  });
  root.find("div").each((_, div) => {
    const text = cellText($, div);
    if (NOISE_TEXT.slice(0, 5).some((re) => re.test(text))) $(div).remove();
  });
}

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

  const root = $("#mw-content-text .mw-parser-output").first();
  if (!root.length) return null;
  pruneNoise($, root);

  const entry = {
    name,
    source: "DANDWIKI",
    // `page` is a 5eTools page number, so keep the wiki title separate.
    wikiPage: fullTitle,
    wikiUrl: url,
    categories,
  };
  const extras = {};
  let blocks = [];

  try {
    if (key === "spell") {
      const data = parseSpellTable($, root);
      if (data) Object.assign(entry, data);
      blocks = collectBlocks($, root, name);
      finalizeSpell(entry, blocks);
    } else if (key === "monster") {
      parseMonster($, root, entry);
      blocks = collectBlocks($, root, name);
      if (!entry.entries?.length) parseGeneric(entry, blocks);
    } else if (key === "class") {
      const parsed = parseClass($, root, entry);
      extras.classFeature = parsed.features;
      extras.subclass = parsed.subclasses;
      extras.subclassFeature = parsed.subclassFeatures;
      // parseClass needs the blocks; collect any remaining content is already in entry.entries.
    } else if (key === "subclass") {
      const features = parseSubclass($, root, entry);
      extras.subclassFeature = features;
    } else if (key === "race") {
      const traits = parseRaceTraits($, root);
      blocks = collectBlocks($, root, name);
      entry.entries = pruneEntries([...traits, ...blocksToEntries(blocks)]);
    } else if (key === "item") {
      parseItem($, root, entry);
      if (!entry.entries?.length) {
        blocks = collectBlocks($, root, name);
        parseGeneric(entry, blocks);
      }
    } else if (key === "deity") {
      blocks = collectBlocks($, root, name);
      parseDeity($, root, entry, blocks);
    } else {
      blocks = collectBlocks($, root, name);
      parseGeneric(entry, blocks);
    }
  } catch {
    // Malformed homebrew pages should still yield readable reference text.
    blocks = collectBlocks($, root, name);
    if (!entry.entries?.length) parseGeneric(entry, blocks);
  }

  if (key === "class" && !entry.entries?.length) {
    blocks = collectBlocks($, root, name);
    parseGeneric(entry, blocks);
  }

  if (!entry.entries?.length && !entry.trait && !entry.action && !entry.description) {
    blocks = blocks.length ? blocks : collectBlocks($, root, name);
    entry.entries = blocksToEntries(blocks);
  }

  entry.entries = pruneEntries(entry.entries || []);
  return { entry, extras: Object.fromEntries(Object.entries(extras).filter(([, list]) => list?.length)) };
}

function loadManifest(pagesByKey, extras) {
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
    ...pagesByKey,
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// Crawl
// ---------------------------------------------------------------------------

console.log(
  `[dandwiki] preset=${presetName} seeds=${seeds.join(", ")} limit=${limit || "all"} delay=${delay}ms concurrency=${concurrency}`
);
const entryLinks = [];
const seen = new Set();
for (const seed of seeds) {
  try {
    const { html } = await fetchPage(`/wiki/${seed}`);
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
const extras = { classFeature: [], subclass: [], subclassFeature: [] };
let done = 0;
let cursor = 0;
const failures = [];
const worker = async () => {
  while (true) {
    const index = cursor;
    cursor += 1;
    if (index >= chosen.length) return;
    const link = chosen[index];
    try {
      const { url, html } = await fetchPage(link.href);
      const parsed = await parsePage(html, url, link.key);
      if (parsed?.entry) {
        const key = keyForTitle(parsed.entry.wikiPage) || link.key;
        if (!byKey[key]) byKey[key] = [];
        byKey[key].push(parsed.entry);
        for (const [extraKey, list] of Object.entries(parsed.extras || {})) {
          if (!extras[extraKey]) extras[extraKey] = [];
          extras[extraKey].push(...list);
        }
      }
    } catch (error) {
      failures.push({ title: link.title, error: error.message });
      console.warn(`[dandwiki] skip ${link.title}: ${error.message}`);
    }
    done += 1;
    if (done % 25 === 0) console.log(`[dandwiki] ${done}/${chosen.length}`);
  }
};
await Promise.all(
  Array.from({ length: Math.min(concurrency, chosen.length) }, () => worker())
);

// Stable output: pages are fetched concurrently, so sort entries by name and
// class features by class/level/name.
for (const entries of Object.values(byKey)) {
  entries.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}
if (extras.classFeature?.length) {
  extras.classFeature.sort(
    (a, b) =>
      String(a.className || "").localeCompare(String(b.className || "")) ||
      (a.level || 0) - (b.level || 0) ||
      String(a.name || "").localeCompare(String(b.name || ""))
  );
}
if (extras.subclassFeature?.length) {
  extras.subclassFeature.sort(
    (a, b) =>
      String(a.className || "").localeCompare(String(b.className || "")) ||
      String(a.subclassShortName || "").localeCompare(String(b.subclassShortName || "")) ||
      (a.level || 0) - (b.level || 0) ||
      String(a.name || "").localeCompare(String(b.name || ""))
  );
}

// Classes and subclasses live in the same Reference Index file.
if (extras.subclass.length) {
  byKey.subclass = [...(byKey.subclass || []), ...extras.subclass];
  delete extras.subclass;
}
for (const key of Object.keys(extras)) {
  if (!extras[key]?.length) delete extras[key];
}
if (byKey.subclass) {
  byKey.subclass.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

const manifest = loadManifest(byKey, extras);
writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`);
const total = Object.values(byKey).flat().length;
console.log(`[dandwiki] wrote ${outFile} (${total} entries)`);
if (failures.length) {
  writeFileSync(join(outFile, "..", "dandwiki-failures.json"), `${JSON.stringify(failures, null, 2)}\n`);
  console.log(`[dandwiki] ${failures.length} failure(s) -> Saves/dandwiki-failures.json`);
}

if (has("split")) {
  const splitDir = join(outFile, "..", "dandwiki-5e");
  mkdirSync(splitDir, { recursive: true });
  const groups = new Map();
  const add = (file, key, value) => {
    if (!groups.has(file)) groups.set(file, {});
    const group = groups.get(file);
    if (!group[key]) group[key] = [];
    group[key].push(...value);
  };
  for (const [key, entries] of Object.entries(byKey)) {
    if (!entries.length) continue;
    // The app's Traps & Hazards tab reads one array; fold hazards in so they
    // are not hidden behind `entriesFromRaw`'s first-array preference.
    const splitKey = key === "hazard" ? "trap" : key;
    add(SPLIT_FILES[key] || `${key}.json`, splitKey, entries);
  }
  const classFile = groups.get("class.json");
  if (classFile) {
    if (extras.classFeature) classFile.classFeature = extras.classFeature;
    if (extras.subclassFeature) classFile.subclassFeature = extras.subclassFeature;
  }
  for (const [file, pages] of groups.entries()) {
    writeFileSync(
      join(splitDir, file),
      `${JSON.stringify({ _meta: manifest._meta, ...pages }, null, 2)}\n`
    );
  }
  console.log(`[dandwiki] split files -> ${splitDir}`);
}
