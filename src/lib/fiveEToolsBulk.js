// Bulk-import helpers for the 5eTools remote catalogs. A full homebrew import
// can touch thousands of files, so this module mutates one working library
// draft instead of triggering a state update per entry.
import {
  actionToLibrary,
  conditionToStatus,
  entriesFromRaw,
  entryName,
  featuresForClassBundle,
  featuresForEntry,
  itemToLibrary,
  languageToLibrary,
  senseToLibrary,
  skillToLibrary,
  spellToLibrary,
  tableToRollTable,
  vehicleToLibrary,
} from "@/lib/fiveETools";
import { normalizeImportedMonster } from "@/lib/monsterImport";
import { entryImage } from "@/lib/fiveEToolsView";
import { bookToRulebook } from "@/lib/fiveEToolsRulebook";

const nameKey = (value) =>
  String(typeof value === "string" ? value : value?.name || "").toLowerCase();

const sourceOf = (entry) =>
  String(
    entry?.source ||
      entry?.classSource ||
      entry?.subclassSource ||
      entry?.bookSource ||
      entry?.monster?.source ||
      ""
  );

const isSubclass = (entry) => !!entry?.shortName || !!entry?.subclassShortName;

const imageUrl = (kind, entry) => {
  const raw = entryImage(entry);
  if (!raw) return "";
  if (/^(https?:|data:|\/images\/)/i.test(raw)) return raw;
  return `/api/5etools/brew-image?kind=${encodeURIComponent(kind)}&path=${encodeURIComponent(
    raw.replace(/^\/+/, "")
  )}`;
};

// A mutable working copy of the Reference Library with name indexes, so bulk
// imports don't perform an O(n) lookup for every entry.
export class BulkLibrary {
  constructor(library = {}) {
    this.library = { ...library };
    this.cache = new Map();
    this.rawCache = new Map();
  }

  arr(key) {
    if (!this.cache.has(key)) {
      const arr = Array.isArray(this.library[key]) ? [...this.library[key]] : [];
      const index = new Map(arr.map((entry, i) => [nameKey(entry), i]));
      this.cache.set(key, { arr, index });
      this.library[key] = arr;
    }
    return this.cache.get(key);
  }

  upsert(key, value) {
    if (!value?.name) return;
    const { arr, index } = this.arr(key);
    const k = nameKey(value);
    const i = index.get(k);
    if (i != null) arr[i] = { ...arr[i], ...value };
    else {
      index.set(k, arr.length);
      arr.push(value);
    }
  }

  lists() {
    if (!this.listsDraft) {
      this.listsDraft = { ...(this.library.lists || {}) };
      this.library.lists = this.listsDraft;
    }
    return this.listsDraft;
  }

  listArray(key) {
    const lists = this.lists();
    if (!Array.isArray(lists[key])) lists[key] = [...(lists[key] || [])];
    return lists[key];
  }

  addString(key, value) {
    if (!value) return;
    const arr = this.listArray(key);
    if (!arr.some((x) => nameKey(x) === String(value).toLowerCase())) arr.push(value);
  }

  upsertList(key, value) {
    if (!value?.name) return;
    const arr = this.listArray(key);
    const i = arr.findIndex((x) => nameKey(x) === nameKey(value));
    if (i >= 0) arr[i] = { ...(typeof arr[i] === "object" ? arr[i] : { name: arr[i] }), ...value };
    else arr.push(value);
  }

  raw(catId) {
    if (!this.rawDraft) {
      this.rawDraft = { ...(this.library.fiveETools || {}) };
      this.library.fiveETools = this.rawDraft;
    }
    if (!this.rawCache.has(catId)) {
      const arr = Array.isArray(this.rawDraft[catId]) ? [...this.rawDraft[catId]] : [];
      const index = new Map(arr.map((entry, i) => [`${entryName(entry)}|${sourceOf(entry)}`, i]));
      this.rawCache.set(catId, { arr, index });
      this.rawDraft[catId] = arr;
    }
    return this.rawCache.get(catId);
  }

  upsertRaw(catId, entry) {
    if (!entry || !catId) return;
    const { arr, index } = this.raw(catId);
    const key = `${entryName(entry)}|${sourceOf(entry)}`;
    const i = index.get(key);
    if (i != null) arr[i] = entry;
    else {
      index.set(key, arr.length);
      arr.push(entry);
    }
  }

  upsertRulebook(book) {
    if (!book?.id) return;
    if (!this.rulebookDraft) {
      this.rulebookDraft = Array.isArray(this.library.fiveEToolsBooks)
        ? [...this.library.fiveEToolsBooks]
        : [];
      this.library.fiveEToolsBooks = this.rulebookDraft;
      this.rulebookIndex = new Map(this.rulebookDraft.map((b, i) => [b.id, i]));
    }
    const i = this.rulebookIndex.get(book.id);
    if (i != null) this.rulebookDraft[i] = { ...this.rulebookDraft[i], ...book };
    else {
      this.rulebookIndex.set(book.id, this.rulebookDraft.length);
      this.rulebookDraft.push(book);
    }
  }
}

export function applyEntryToLibrary(bulk, category, entry, { kind, fallbackTitle } = {}) {
  if (!entry || !category) return;
  if (category.id === "books") {
    const book = bookToRulebook(entry, fallbackTitle);
    if (book) bulk.upsertRulebook(book);
    return;
  }
  switch (category.kind) {
    case "monsters": {
      const m = normalizeImportedMonster(entry);
      if (m?.name) {
        const img = imageUrl(kind, entry);
        if (img) m.image = img;
        bulk.upsert("monsters", m);
      }
      return;
    }
    case "spells": {
      const spell = spellToLibrary(entry);
      if (spell.name) bulk.upsert("spells", spell);
      return;
    }
    case "items": {
      const mapped = itemToLibrary(entry);
      if (mapped) bulk.upsert(mapped.key, mapped.value);
      return;
    }
    case "conditions": {
      const status = conditionToStatus(entry);
      if (status) bulk.upsert("statusEffects", status);
      return;
    }
    case "actions": {
      const action = actionToLibrary(entry);
      if (action) bulk.upsert("actions", action);
      return;
    }
    case "languages":
      bulk.addString("languages", languageToLibrary(entry));
      return;
    case "skills": {
      const skill = skillToLibrary(entry);
      if (skill) bulk.upsertList("skills", skill);
      return;
    }
    case "senses": {
      const sense = senseToLibrary(entry);
      if (sense) bulk.upsert("senses", sense);
      return;
    }
    case "tables": {
      const table = tableToRollTable(entry);
      if (table) bulk.upsert("rollTables", table);
      return;
    }
    case "vehicles": {
      const vehicle = vehicleToLibrary(entry);
      if (vehicle) bulk.upsert("vehicles", vehicle);
      return;
    }
    default:
      bulk.upsertRaw(category.id, entry);
  }
}

// Turn a brew file's entries into tree-tab specifications. One class file
// becomes one tab per class (with its subclasses branching); a feat/option
// file becomes one combined feature tab.
export function tabsForBrewFile(category, entries, raw, info) {
  if (!category) return [];
  if (category.kind === "classes") {
    const bases = entries.filter((e) => !isSubclass(e));
    const subs = entries.filter(isSubclass);
    const used = new Set();
    const tabs = [];
    bases.forEach((base) => {
      const matching = subs.filter((s) => {
        if (s.className !== base.name) return false;
        if (s.classSource && base.source && s.classSource !== base.source) return false;
        return true;
      });
      matching.forEach((s) => used.add(s));
      const features = featuresForClassBundle(base, matching, raw);
      if (features.length) {
        tabs.push({
          name: `Class: ${entryName(base)}`,
          features,
          meta: { category: category.label, layout: "class", className: base.name },
        });
      }
    });
    subs
      .filter((s) => !used.has(s))
      .forEach((sub) => {
        const features = featuresForEntry(category.id, sub, raw);
        if (features.length) {
          tabs.push({
            name: `Subclass: ${entryName(sub)}`,
            features,
            meta: { category: category.label, layout: "class", className: sub.className },
          });
        }
      });
    return tabs;
  }
  if (category.kind === "feats" || category.kind === "options") {
    const features = entries.flatMap((entry) => featuresForEntry(category.id, entry, raw));
    if (!features.length) return [];
    return [
      {
        name: `${category.label.replace(/^Other /, "")}: ${info?.name || "Imported"}`,
        features,
        meta: { category: category.label },
      },
    ];
  }
  return [];
}

export function importBrewIntoDraft(bulk, info, category, raw, { makeTabs = true, kind } = {}) {
  const entries = entriesFromRaw(raw, info?.props?.[0]);
  if (!entries.length) return { entries: 0, tabs: [] };
  entries.forEach((entry) =>
    applyEntryToLibrary(bulk, category, entry, { kind, fallbackTitle: info?.name })
  );
  return {
    entries: entries.length,
    tabs: makeTabs ? tabsForBrewFile(category, entries, raw, info) : [],
  };
}
