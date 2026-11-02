// Character creation helpers: turn the imported 5eTools lists into the
// options a new character can pick, and read backgrounds/classes back out.
import { entryName, fiveText } from "@/lib/fiveETools";
import { entryDetails } from "@/lib/fiveEToolsView";

export const COIN_TYPES = [
  { id: "cp", label: "Copper (cp)" },
  { id: "sp", label: "Silver (sp)" },
  { id: "ep", label: "Electrum (ep)" },
  { id: "gp", label: "Gold (gp)" },
  { id: "pp", label: "Platinum (pp)" },
];

export const CREATION_MODES = [
  {
    id: "tree",
    label: "Talent tree only",
    hint: "Use the current tree without a race or class.",
  },
  {
    id: "tree-race",
    label: "Talent tree + race",
    hint: "Add a race on top of the tree.",
  },
  {
    id: "tree-class",
    label: "Talent tree + class",
    hint: "Add a class (and its subclass) on top of the tree.",
  },
  {
    id: "all",
    label: "Talent tree + race + class",
    hint: "Everything: tree, race, class and subclass.",
  },
];

const listFor = (settings, category) =>
  Array.isArray(settings?.library?.fiveETools?.[category])
    ? settings.library.fiveETools[category]
    : [];

export const isSubclassEntry = (entry) =>
  !!entry?.shortName || !!entry?.subclassShortName;

const keyOf = (entry) =>
  `${entryName(entry)}|${entry?.source || entry?.classSource || ""}`;

const uniqueEntries = (entries) => {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = keyOf(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Classes deliberately keep both editions: "Fighter (PHB)" and "Fighter
// (XPHB)" are separate choices, never merged.
export function classChoices(settings) {
  return listFor(settings, "classes")
    .filter((entry) => entry?.name && !isSubclassEntry(entry))
    .map((entry) => ({
      id: keyOf(entry),
      name: entry.name,
      source: entry.source || "",
      entry,
      label: `${entry.name}${entry.source ? ` (${entry.source})` : ""}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// A subclass is shared by every class with the same name, including the 2014
// and 2024 duplicates, so it is listed under each owning class.
export function subclassChoices(settings, className, classSource) {
  const entries = listFor(settings, "classes").filter(
    (entry) =>
      isSubclassEntry(entry) &&
      entry.className === className &&
      (!classSource || !entry.classSource || entry.classSource === classSource)
  );
  return uniqueEntries(entries)
    .map((entry) => ({
      id: `${keyOf(entry)}|${entry.classSource || ""}`,
      name: entryName(entry),
      source: entry.source || "",
      entry,
      label: `${entryName(entry)}${entry.source ? ` (${entry.source})` : ""}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function raceChoices(settings) {
  return uniqueEntries(listFor(settings, "species").filter((entry) => entry?.name))
    .map((entry) => ({
      id: keyOf(entry),
      name: entry.name,
      source: entry.source || "",
      entry,
      label: `${entry.name}${entry.source ? ` (${entry.source})` : ""}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function backgroundChoices(settings) {
  return uniqueEntries(
    listFor(settings, "backgrounds").filter((entry) => entry?.name)
  )
    .map((entry) => ({
      id: keyOf(entry),
      name: entry.name,
      source: entry.source || "",
      entry,
      label: `${entry.name}${entry.source ? ` (${entry.source})` : ""}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function featChoices(settings) {
  return uniqueEntries(listFor(settings, "feats").filter((entry) => entry?.name))
    .map((entry) => ({
      id: keyOf(entry),
      name: entry.name,
      source: entry.source || "",
      entry,
      label: `${entry.name}${entry.source ? ` (${entry.source})` : ""}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function findBackground(settings, name, source) {
  return (
    listFor(settings, "backgrounds").find(
      (entry) =>
        entryName(entry) === name && (!source || entry.source === source)
    ) || null
  );
}

// Backgrounds only put features carrying a "Feature:" tag (or isFeature flag)
// on the front of the sheet. Everything else stays in the Fluff tab.
export function backgroundFeatureLines(entry) {
  const out = [];
  const walk = (nodes) => {
    if (nodes == null) return;
    if (Array.isArray(nodes)) {
      nodes.forEach(walk);
      return;
    }
    if (typeof nodes !== "object") return;
    const name = String(nodes.name || "");
    if (
      nodes.data?.isFeature ||
      /^feature\s*:/i.test(name) ||
      nodes.type === "feature"
    ) {
      const text = fiveText(nodes.entries || nodes.items || nodes);
      out.push({ name: name || "Feature", text });
      return;
    }
    if (Array.isArray(nodes.entries)) walk(nodes.entries);
    if (Array.isArray(nodes.items)) walk(nodes.items);
  };
  walk(entry?.entries);
  return out;
}

export function backgroundInfo(settings, character) {
  const creation = character?.creation?.background;
  const name = character?.background || creation?.name || "";
  const source =
    creation?.name === name ? creation?.source || "" : "";
  const entry =
    name ? findBackground(settings, name, source) : null;
  if (!entry) return null;
  const details = entryDetails("backgrounds", entry);
  return {
    name: entryName(entry),
    source: entry.source || "",
    entry,
    details,
    features: backgroundFeatureLines(entry),
    optionGroups: backgroundOptionGroups(entry),
  };
}

const equipmentSummary = (nodes) => {
  if (!Array.isArray(nodes)) return "";
  return nodes
    .map((item) => {
      if (typeof item === "string") return item;
      if (item?.item) return item.displayName || item.item;
      if (item?.special) return item.special;
      return "";
    })
    .filter(Boolean)
    .join(", ");
};

// Backgrounds that make the player choose something. Two common shapes:
// A/B starting equipment packages, and explicit `options` blocks (homebrew or
// custom backgrounds). The creator requires a pick when a group is found.
export function backgroundOptionGroups(entry) {
  const groups = [];
  if (!entry) return groups;
  const equipment = Array.isArray(entry.startingEquipment)
    ? entry.startingEquipment
    : [];
  equipment.forEach((block) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) return;
    const keys = ["a", "b", "c", "d"].filter((key) => Array.isArray(block[key]));
    if (keys.length > 1) {
      groups.push({
        id: "equipment",
        label: "Starting equipment",
        choices: keys.map((key) => ({
          id: key,
          label: `Option ${key.toUpperCase()} — ${equipmentSummary(block[key]) || "equipment package"}`,
        })),
      });
    }
  });

  const walk = (nodes) => {
    if (nodes == null) return;
    if (Array.isArray(nodes)) {
      nodes.forEach(walk);
      return;
    }
    if (typeof nodes !== "object") return;
    if (nodes.type === "options" && Array.isArray(nodes.entries)) {
      const choices = nodes.entries
        .map((option, index) => ({
          id: `${index}`,
          label: entryName(option) || `Option ${index + 1}`,
        }))
        .filter((choice) => choice.label);
      if (choices.length > 1) {
        groups.push({
          id: `options-${groups.length}`,
          label: nodes.name || "Background option",
          choices,
        });
      }
      return;
    }
    if (Array.isArray(nodes.entries)) walk(nodes.entries);
    if (Array.isArray(nodes.items)) walk(nodes.items);
  };
  walk(entry.entries);
  return groups;
}

// Level-up benefits come from the class tab the Reference Index built. A class
// and its subclasses are one tab, so the chosen subclass filters the branches.
export function classBenefitsFor(tree, { className, classSource, subclassName, level }) {
  if (!className) return [];
  const wanted = String(level);
  const tabs = [tree, ...(tree?.tabs || [])].filter(Boolean);
  const matches = tabs.filter((tab) => {
    if (tab.className) return tab.className === className;
    const name = String(tab?.name || "");
    return (
      name === `Class: ${className}` ||
      name.startsWith(`Class: ${className} (`) ||
      name.startsWith(`Class: ${className} ·`)
    );
  });
  const preferred =
    matches.find(
      (tab) =>
        classSource &&
        (tab.classSource === classSource ||
          String(tab.name).includes(`(${classSource})`))
    ) || matches[0];
  if (!preferred) return [];
  return (preferred.nodes || [])
    .filter((node) => Number(node.levelReq) === Number(wanted))
    .filter((node) => {
      const group = node.featureGroup || "Class";
      if (group === "Class") return true;
      if (!subclassName) return false;
      return group === subclassName;
    })
    .filter((node) => node.name)
    .map((node) => ({
      name: node.name,
      text: node.description || "",
      group: node.featureGroup || "Class",
    }));
}
