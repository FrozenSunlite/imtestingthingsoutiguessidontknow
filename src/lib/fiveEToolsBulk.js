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
import { importImageFromUrl, importImagesInText } from "@/lib/imageStore";
import { tagImported } from "@/lib/importHistory";

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
  if (/^(https?:|data:|\/images\/|\/api\/)/i.test(raw)) return raw;
  if (!kind || kind === "data") {
    const rel = /^img\//i.test(raw)
      ? raw.replace(/^\/+/, "")
      : `img/${raw.replace(/^\/+/, "")}`;
    return `/api/5etools/image?path=${encodeURIComponent(rel)}`;
  }
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
    if (i != null) {
      const merged = { ...arr[i], ...value };
      if (JSON.stringify(merged) === JSON.stringify(arr[i])) return;
      arr[i] = merged;
    } else {
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
    if (i != null) {
      if (JSON.stringify(arr[i]) === JSON.stringify(entry)) return;
      arr[i] = entry;
    } else {
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

export function applyEntryToLibrary(
  bulk,
  category,
  entry,
  { kind, fallbackTitle, importId } = {}
) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry) || !category) return;
  const img = imageUrl(kind, entry);
  const tag = (value) =>
    importId
      ? tagImported(value, importId, {
          label: fallbackTitle || category.label,
          root: kind || "",
        })
      : value;
  const withImage = (value) => {
    if (!value || typeof value === "string") return value;
    const next = img && !value.image ? { ...value, image: img } : value;
    return tag(next);
  };
  if (category.id === "books") {
    const book = bookToRulebook(entry, fallbackTitle);
    if (book) bulk.upsertRulebook(tag(img ? { ...book, cover: img } : book));
    return;
  }
  switch (category.kind) {
    case "monsters": {
      const m = normalizeImportedMonster(entry);
      if (m?.name) {
        if (img) m.image = img;
        bulk.upsert("monsters", tag(m));
      }
      return;
    }
    case "spells": {
      const spell = withImage(spellToLibrary(entry));
      if (spell?.name) bulk.upsert("spells", spell);
      return;
    }
    case "items": {
      const mapped = itemToLibrary(entry);
      if (mapped) bulk.upsert(mapped.key, withImage(mapped.value));
      return;
    }
    case "conditions": {
      const status = withImage(conditionToStatus(entry));
      if (status) bulk.upsert("statusEffects", status);
      return;
    }
    case "actions": {
      const action = withImage(actionToLibrary(entry));
      if (action) bulk.upsert("actions", action);
      return;
    }
    case "languages":
      bulk.addString("languages", languageToLibrary(entry));
      return;
    case "skills": {
      const skill = withImage(skillToLibrary(entry));
      if (skill) bulk.upsertList("skills", skill);
      return;
    }
    case "senses": {
      const sense = withImage(senseToLibrary(entry));
      if (sense) bulk.upsert("senses", sense);
      return;
    }
    case "tables": {
      const table = withImage(tableToRollTable(entry));
      if (table) bulk.upsert("rollTables", table);
      return;
    }
    case "vehicles": {
      const vehicle = withImage(vehicleToLibrary(entry));
      if (vehicle) bulk.upsert("vehicles", vehicle);
      return;
    }
    default:
      bulk.upsertRaw(category.id, withImage(entry));
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

export function importBrewIntoDraft(
  bulk,
  info,
  category,
  raw,
  { makeTabs = true, kind, importId } = {}
) {
  const entries = entriesFromRaw(raw, info?.props?.[0]).filter(
    (entry) => entry && typeof entry === "object" && !Array.isArray(entry)
  );
  if (!entries.length) return { entries: 0, tabs: [] };
  entries.forEach((entry) =>
    applyEntryToLibrary(bulk, category, entry, {
      kind,
      fallbackTitle: info?.name,
      importId,
    })
  );
  return {
    entries: entries.length,
    tabs: makeTabs ? tabsForBrewFile(category, entries, raw, info) : [],
  };
}

// Import only the entries whose source/book abbreviation matches, across any
// number of files. This is the "import everything from XPHB" path.
export function importSourceIntoDraft(
  bulk,
  info,
  category,
  raw,
  source,
  { makeTabs = true, kind, importId } = {}
) {
  const wanted = String(source || "").trim().toLowerCase();
  if (!wanted) return { entries: 0, tabs: [] };
  const entries = entriesFromRaw(raw, info?.props?.[0]).filter(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      sourceOf(entry).toLowerCase() === wanted
  );
  if (!entries.length) return { entries: 0, tabs: [] };
  entries.forEach((entry) =>
    applyEntryToLibrary(bulk, category, entry, {
      kind,
      fallbackTitle: info?.name,
      importId,
    })
  );
  return {
    entries: entries.length,
    tabs: makeTabs ? tabsForBrewFile(category, entries, raw, info) : [],
  };
}

// Bulk imports keep short proxy URLs while they run. This pass walks the
// imported library, downloads those pictures and stores them in the project's
// image folder, so the artwork survives after the 5eTools data is removed.
// `limit` keeps a giant homebrew import from stalling for minutes; the rest
// stay readable through the proxy and can be saved by re-importing later.
export async function localizeBulkImages(library, kind, { limit = 400 } = {}) {
  if (!library) return { saved: 0, skipped: 0 };
  const local = (url) => !url || /^(data:|\/images\/)/i.test(url);
  const resolveUrl = async (url) => {
    if (!url || local(url)) return url;
    if (/^https?:/i.test(url) || url.startsWith("/api/")) return importImageFromUrl(url);
    return importImageFromUrl(imageUrl(kind, { img: url }));
  };

  const targets = [];
  Object.values(library).forEach((value) => {
    if (!Array.isArray(value)) return;
    value.forEach((entry) => {
      if (
        entry &&
        typeof entry === "object" &&
        typeof entry.image === "string" &&
        !local(entry.image)
      ) {
        targets.push(entry);
      }
    });
  });
  Object.values(library.fiveETools || {}).forEach((value) => {
    if (!Array.isArray(value)) return;
    value.forEach((entry) => {
      if (
        entry &&
        typeof entry === "object" &&
        typeof entry.image === "string" &&
        !local(entry.image)
      ) {
        targets.push(entry);
      }
    });
  });

  const chosen = targets.slice(0, Math.max(0, limit));
  const queue = [...chosen];
  let saved = 0;
  const worker = async () => {
    while (queue.length) {
      const entry = queue.shift();
      const url = entry.image;
      try {
        const stored = await resolveUrl(url);
        if (stored && stored !== url) {
          entry.image = stored;
          saved += 1;
        }
      } catch {
        /* keep the proxy URL */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, worker));

  // Books: cover plus inline chapter illustrations.
  let booksSaved = 0;
  for (const book of library.fiveEToolsBooks || []) {
    if (book?.cover && !local(book.cover)) {
      const stored = await resolveUrl(book.cover);
      if (stored && stored !== book.cover) {
        book.cover = stored;
        booksSaved += 1;
      }
    }
    if (!Array.isArray(book?.chapters)) continue;
    for (const chapter of book.chapters) {
      if (!String(chapter.content || "").includes("![")) continue;
      const next = await importImagesInText(chapter.content, resolveUrl);
      if (next !== chapter.content) {
        chapter.content = next;
        booksSaved += 1;
      }
    }
  }

  return {
    saved: saved + booksSaved,
    skipped: Math.max(0, targets.length - chosen.length),
  };
}
