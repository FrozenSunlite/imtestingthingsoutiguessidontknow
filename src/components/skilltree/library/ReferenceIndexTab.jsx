import { useEffect, useMemo, useRef, useState } from "react";
import { useTree } from "@/lib/treeStore";
import {
  FIVE_CATEGORIES,
  entriesFromRaw,
  entryMeta,
  entryName,
  entryPreview,
  actionToLibrary,
  conditionToStatus,
  featuresForClassBundle,
  featuresForEntry,
  filesForCategory,
  isSourceFile,
  itemToLibrary,
  languageToLibrary,
  senseToLibrary,
  skillToLibrary,
  spellToLibrary,
  tableToRollTable,
  vehicleToLibrary,
} from "@/lib/fiveETools";
import { entryDetails, entryImage } from "@/lib/fiveEToolsView";
import { BulkLibrary, importBrewIntoDraft, localizeBulkImages } from "@/lib/fiveEToolsBulk";
import { bookToRulebook } from "@/lib/fiveEToolsRulebook";
import { authorsFromBrew } from "@/lib/fiveEToolsCredits";
import { addCreditNames, setRulebookActiveBookId } from "@/lib/rulebookStore";
import {
  newImportId,
  recordImport,
  removeImportFromLibrary,
  tagImported,
} from "@/lib/importHistory";
import { loadSpellLookup } from "@/lib/fiveEToolsLookup";
import { ReferenceEntryPreview } from "./ReferenceEntryPreview";
import { VirtualList } from "./VirtualList";
import { normalizeImportedMonster } from "@/lib/monsterImport";
import { cacheFiveEToolsSource, cachedFiveEToolsSource } from "@/lib/fiveEToolsCache";
import { importImageFromUrl, importImagesInText } from "@/lib/imageStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOTS = [
  ["data", "Official & Partnered"],
  ["homebrew", "Homebrew"],
  ["prerelease", "Prerelease"],
];

// Which 5eTools data properties (and therefore which catalog files) belong to
// each Reference Index category.
const CATALOG_PROPS = {
  rulesGlossary: ["variantrule"],
  tables: ["table"],
  books: ["book", "bookData"],
  classes: ["class", "subclass"],
  backgrounds: ["background"],
  feats: ["feat"],
  species: ["race", "subrace"],
  charOptions: ["charoption"],
  optionalFeatures: ["optionalfeature"],
  adventures: ["adventure", "adventureData"],
  cults: ["cult", "boon"],
  objects: ["object"],
  traps: ["trap", "hazard"],
  encounterGen: ["encounter"],
  lootGen: ["individual", "hoard", "dragon"],
  actions: ["action"],
  bastions: ["facility"],
  bestiary: ["monster"],
  conditions: ["condition", "disease", "status"],
  senses: ["sense"],
  skills: ["skill"],
  decks: ["deck", "card"],
  deities: ["deity"],
  items: ["item", "baseitem", "itemGroup", "magicvariant"],
  languages: ["language"],
  gifts: ["reward"],
  psionics: ["psionic"],
  spells: ["spell"],
  vehicles: ["vehicle"],
};

const isRemoteRoot = (root) => root === "homebrew" || root === "prerelease";

// Index and brew catalogs change only when the user downloads an update, so a
// short session cache keeps category switches instant and survives tab changes.
const INDEX_CACHE_TTL = 30 * 60 * 1000;
const readIndexCache = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - parsed.at > INDEX_CACHE_TTL) return null;
    return parsed.data;
  } catch {
    return null;
  }
};
const writeIndexCache = (key, data) => {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full or unavailable: caching is optional */
  }
};

// A remote file's catalog property tells us what kind of entry it contains,
// even when the user is browsing "All files".
const categoryForProps = (props = []) => {
  const prop = props[0];
  const hit = Object.entries(CATALOG_PROPS).find(([, list]) => list.includes(prop));
  return hit ? hit[0] : "";
};

const isSubclassEntry = (entry) => !!entry?.shortName || !!entry?.subclassShortName;

// Which Reference Index category owns a data file. Used when browsing "All
// files", where the catalog property is not available for local files.
const categoryIdForPath = (path) => {
  const p = String(path || "");
  if (!p) return "";
  const match = FIVE_CATEGORIES.find((c) => {
    const names = new Set(c.files || []);
    if (names.has(p) || names.has(p.slice(p.lastIndexOf("/") + 1))) return true;
    return (c.dirs || []).some((d) => p === d || p.startsWith(`${d}/`));
  });
  return match?.id || "";
};

const sourceOf = (entry) =>
  String(
    entry?.source ||
      entry?.classSource ||
      entry?.subclassSource ||
      entry?.bookSource ||
      entry?.monster?.source ||
      ""
  );

const imageFor = (entry, root, filePath) => {
  const raw = entry?.img || entry?.image || entry?.portrait || entry?.cover;
  if (!raw || typeof raw !== "string") return "";
  if (/^(data:|\/images\/)/i.test(raw)) return raw;
  if (isRemoteRoot(root)) {
    const hb = raw.match(
      /^https?:\/\/raw\.githubusercontent\.com\/TheGiddyLimit\/homebrew-img\/main\/(.+)$/i
    );
    if (hb) {
      return `/api/5etools/brew-image?kind=homebrew&path=${encodeURIComponent(hb[1])}`;
    }
    const pre = raw.match(
      /^https?:\/\/raw\.githubusercontent\.com\/5etools-mirror-3\/5etools-src\/main\/(.+)$/i
    );
    if (pre) {
      return `/api/5etools/brew-image?kind=prerelease&path=${encodeURIComponent(pre[1])}`;
    }
    if (/^https?:/i.test(raw)) return raw;
    const cleaned = raw.replace(/^\/+/, "");
    return `/api/5etools/brew-image?kind=${root}&path=${encodeURIComponent(cleaned)}`;
  }
  if (/^https?:/i.test(raw)) return raw;
  const cleaned = raw.replace(/^\/+/, "");
  const dir = filePath?.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : "";
  const candidate = cleaned.startsWith(`${root}/`) || cleaned.startsWith("img/")
    ? cleaned
    : `${root}/${dir}/${cleaned}`.replace(/\/+/g, "/");
  return `/api/5etools/image?path=${encodeURIComponent(candidate)}`;
};

// Reference Index: a local, read-only view of the 5eTools folders. Files are
// fetched on demand, grouped by source, previewed before import, and imported
// at a chosen rate. Imported data becomes part of the project library; raw
// source files stay in the on-disk 5eTools folder.
export function ReferenceIndexTab() {
  const { tree, settings, setSettings, addImportedTab, addImportedTabs, deleteTab } = useTree();
  const [status, setStatus] = useState(null);
  const [root, setRoot] = useState("data");
  const [index, setIndex] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [catalogSelected, setCatalogSelected] = useState(() => new Set());
  const [fileQuery, setFileQuery] = useState("");
  const [partneredOnly, setPartneredOnly] = useState(false);
  const [bulk, setBulk] = useState(null);
  const [bulkMakeTabs, setBulkMakeTabs] = useState(true);
  const bulkCancelRef = useRef(false);
  const [allMode, setAllMode] = useState(false);
  const [allProgress, setAllProgress] = useState(null);
  const allCancelRef = useRef(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const activeImportRef = useRef("");
  const importTabIdsRef = useRef([]);
  const rawByPath = useRef(new Map());
  const [categoryId, setCategoryId] = useState("bestiary");
  const [activeCategoryId, setActiveCategoryId] = useState("bestiary");
  const [filePath, setFilePath] = useState("");
  const [raw, setRaw] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [preview, setPreview] = useState(null);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("__all__");
  const [delay, setDelay] = useState(120);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [spellLookup, setSpellLookup] = useState(null);
  const [bookTitles, setBookTitles] = useState(() => new Map());

  const isRemote = isRemoteRoot(root);
  const category =
    categoryId === "__all__"
      ? { id: "__all__", label: "All files" }
      : FIVE_CATEGORIES.find((c) => c.id === categoryId) || FIVE_CATEGORIES[0];
  const activeCategory =
    activeCategoryId === "__all__"
      ? { id: "__all__", label: "All files" }
      : FIVE_CATEGORIES.find((c) => c.id === activeCategoryId) || category;
  const files = useMemo(() => {
    if (isRemote) {
      let list = catalog;
      if (categoryId !== "__all__") {
        const props = CATALOG_PROPS[categoryId];
        if (props) list = list.filter((f) => (f.props || []).some((p) => props.includes(p)));
      }
      if (root === "homebrew" && partneredOnly) list = list.filter((f) => f.partnered);
      const q = fileQuery.trim().toLowerCase();
      if (q) {
        list = list.filter((f) =>
          `${f.name} ${f.author} ${f.path}`.toLowerCase().includes(q)
        );
      }
      return [...list].sort(
        (a, b) => String(a.name || a.path).localeCompare(String(b.name || b.path))
      );
    }
    const list =
      root === "data"
        ? category.id === "__all__"
          ? index.filter((f) => isSourceFile(f.path))
          : filesForCategory(category, index)
        : index.filter((f) => isSourceFile(f.path));
    const q = fileQuery.trim().toLowerCase();
    const filtered = q
      ? list.filter((f) => `${f.path} ${f.name || ""}`.toLowerCase().includes(q))
      : list;
    return [...filtered].sort((a, b) => a.path.localeCompare(b.path));
  }, [category, categoryId, catalog, fileQuery, index, isRemote, partneredOnly, root]);
  const sourceOptions = useMemo(
    () => [...new Set(entries.map(sourceOf).filter(Boolean))].sort(),
    [entries]
  );
  const sourceCounts = useMemo(() => {
    const counts = new Map();
    entries.forEach((entry) => {
      const source = sourceOf(entry) || "Unknown source";
      counts.set(source, (counts.get(source) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);
  const shown = entries
    .filter((e) => {
      const q = query.trim().toLowerCase();
      if (q && !`${entryName(e)} ${entryMeta(e)} ${sourceOf(e)}`.toLowerCase().includes(q)) {
        return false;
      }
      if (sourceFilter !== "__all__" && sourceOf(e) !== sourceFilter) return false;
      return true;
    })
    .sort(
      (a, b) =>
        sourceOf(a).localeCompare(sourceOf(b)) ||
        String(entryName(a)).localeCompare(String(entryName(b)))
    );
  const imported = settings?.library?.fiveETools || {};
  const rawForEntry = (entry) =>
    (entry?.__filePath && rawByPath.current.get(entry.__filePath)) || raw;
  const previewCategoryId = useMemo(() => {
    const path = preview?.__filePath || (filePath && filePath !== "__all__" ? filePath : "");
    return (path && categoryIdForPath(path)) || activeCategory.id;
  }, [preview, filePath, activeCategory.id]);
  const previewDetails = useMemo(
    () =>
      preview
        ? entryDetails(previewCategoryId, preview, rawForEntry(preview), {
            spellLookup,
            bookTitles,
          })
        : null,
    [preview, previewCategoryId, raw, spellLookup, bookTitles]
  );

  const refresh = async (force = false) => {
    try {
      const s = await fetch("/api/5etools/status").then((r) => r.json());
      setStatus(s);
      if (isRemote) {
        const key = `5e-catalog:${root}`;
        let cached = force ? null : readIndexCache(key);
        if (!cached) {
          const c = await fetch(`/api/5etools/catalog?kind=${encodeURIComponent(root)}`).then((r) =>
            r.json()
          );
          cached = Array.isArray(c.entries) ? c.entries : [];
          writeIndexCache(key, cached);
        }
        setCatalog(cached);
        setIndex([]);
      } else {
        const key = `5e-index:${root}`;
        let cached = force ? null : readIndexCache(key);
        if (!cached) {
          const i = await fetch(`/api/5etools/index?root=${encodeURIComponent(root)}`).then((r) =>
            r.json()
          );
          cached = Array.isArray(i.files) ? i.files : [];
          writeIndexCache(key, cached);
        }
        setIndex(cached);
        setCatalog([]);
      }
    } catch {
      if (!isRemote) {
        setStatus({
          available: false,
          roots: {},
          apiError: true,
          error: "The local API did not respond.",
        });
      } else {
        toast.error("Could not load the remote 5eTools catalog. Check your connection.");
      }
      setIndex([]);
      setCatalog([]);
    }
  };

  const updateData = async () => {
    if (updating) return;
    setUpdating(true);
    toast("Downloading the latest 5eTools release from GitHub…");
    try {
      const r = await fetch("/api/5etools/update", { method: "POST" });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Update failed");
      toast.success(`5eTools ${data.version || "data"} downloaded.`);
      setRoot("data");
      await refresh(true);
    } catch (err) {
      toast.error(`Could not update 5eTools data: ${err.message || err}`);
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    loadSpellLookup().then(setSpellLookup);
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root]);

  useEffect(() => {
    setFilePath(files[0]?.path || "");
    setActiveCategoryId(categoryId);
    setEntries([]);
    setPreview(null);
    setSelected(new Set());
    setCatalogSelected(new Set());
    setAllMode(false);
    setAllProgress(null);
    allCancelRef.current = false;
    // Load the first source file so the entry list and preview are populated
    // immediately; later file clicks replace it.
    if (files[0]) loadFile(files[0].path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, root, index.length, catalog.length, partneredOnly]);

  const fetchFiveFile = async (path, { force = false } = {}) => {
    const key = `${root}/${path}`;
    if (!isRemote && !force) {
      const cached = cachedFiveEToolsSource(key);
      if (cached) return cached;
    }
    const data = await fetch(
      isRemote
        ? `/api/5etools/remote?kind=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`
        : `/api/5etools/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`
    ).then((r) => {
      if (!r.ok) throw new Error("Could not read file");
      return r.json();
    });
    if (!isRemote) cacheFiveEToolsSource(key, data);
    return data;
  };

  // Book and adventure files only carry an id (PHB, AAG…). Load the matching
  // catalog once so the preview can show the human-readable title.
  useEffect(() => {
    if (isRemote) return;
    if (activeCategoryId !== "books" && activeCategoryId !== "adventures") return;
    let cancelled = false;
    const metaFile = activeCategoryId === "books" ? "books.json" : "adventures.json";
    fetchFiveFile(metaFile)
      .then((data) => {
        if (cancelled) return;
        const list =
          activeCategoryId === "books" ? data?.book : data?.adventure;
        const map = new Map();
        (Array.isArray(list) ? list : []).forEach((item) => {
          if (item?.id) map.set(item.id, item.name || item.id);
        });
        setBookTitles(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategoryId, root, isRemote]);

  const loadFile = async (path) => {
    if (!path) return;
    setLoading(true);
    setAllMode(false);
    setAllProgress(null);
    try {
      const data = await fetchFiveFile(path);
      cacheFiveEToolsSource(`${root}/${path}`, data);
      if (path && (activeCategory.id === "classes" || category.kind === "classes")) {
        rawByPath.current.set(path, data);
      }
      const info = isRemote ? catalog.find((f) => f.path === path) : null;
      const list = entriesFromRaw(data, info?.props?.[0]).map((e) => ({ ...e }));
      setRaw(data);
      setEntries(list);
      setPreview(list[0] || null);
      setSelected(new Set());
      setSourceFilter("__all__");
      setFilePath(path);
      if (info) {
        const inferred = categoryForProps(info.props || []);
        setActiveCategoryId(inferred || categoryIdForPath(path) || categoryId);
      } else {
        setActiveCategoryId(categoryIdForPath(path) || categoryId);
      }
      if (!list.length) toast("That file has no importable entries.");
    } catch {
      toast.error("Could not read that 5eTools file.");
    } finally {
      setLoading(false);
    }
  };

  const loadAllFiles = async () => {
    if (!files.length || allProgress) return;
    const targets = [...files];
    const totalBytes = targets.reduce((n, f) => n + (Number(f.size) || 0), 0);
    const sizeText =
      totalBytes > 1024 * 1024 ? ` (~${Math.round(totalBytes / (1024 * 1024))} MB)` : "";
    if (
      targets.length > 50 &&
      !window.confirm(
        `Display all ${targets.length} files${sizeText} at once? This can take a while and may produce a very large entry list.`
      )
    ) {
      return;
    }
    allCancelRef.current = false;
    setAllMode(true);
    setAllProgress({ done: 0, total: targets.length });
    setLoading(true);
    const combined = [];
    const seen = new Set();
    try {
      const batchSize = 6;
      for (let start = 0; start < targets.length; start += batchSize) {
        if (allCancelRef.current) break;
        const batch = targets.slice(start, start + batchSize);
        const results = await Promise.all(
          batch.map(async (file) => {
            try {
              return { file, data: await fetchFiveFile(file.path) };
            } catch {
              return null;
            }
          })
        );
        results.filter(Boolean).forEach(({ file, data }) => {
          const info = isRemote ? catalog.find((f) => f.path === file.path) : null;
          const inferredId = categoryForProps(info?.props || []);
          const rawCategory = inferredId || (categoryId !== "__all__" ? categoryId : "");
          if (
            rawCategory === "classes" ||
            rawCategory === "books" ||
            /(^|\/)class\//.test(file.path) ||
            /(^|\/)book\//.test(file.path)
          ) {
            rawByPath.current.set(file.path, data);
          }
          const list = entriesFromRaw(data, info?.props?.[0]);
          list.forEach((entry) => {
            const key = `${rawCategory}|${entryName(entry)}|${sourceOf(entry)}`;
            if (seen.has(key)) return;
            seen.add(key);
            combined.push({ ...entry, __filePath: file.path });
          });
        });
        setAllProgress({ done: Math.min(targets.length, start + batch.length), total: targets.length });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      setEntries(combined);
      setPreview(combined[0] || null);
      setSelected(new Set());
      setSourceFilter("__all__");
      setFilePath("__all__");
      toast.success(`Displaying ${combined.length} entries from ${targets.length} files.`);
    } catch {
      toast.error("Could not display all files.");
    } finally {
      setLoading(false);
      setAllProgress(null);
    }
  };

  const toggle = (i) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const entryIndex = useMemo(
    () => new Map(entries.map((entry, index) => [entry, index])),
    [entries]
  );
  const allShownSelected =
    shown.length > 0 && shown.every((e) => selected.has(entryIndex.get(e)));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShownSelected) shown.forEach((e) => next.delete(entryIndex.get(e)));
      else shown.forEach((e) => next.add(entryIndex.get(e)));
      return next;
    });
  };

  const mergeMonster = (entry) => {
    const m = normalizeImportedMonster(entry);
    if (!m?.name) return false;
    setSettings((s) => {
      const list = Array.isArray(s.library.monsters) ? [...s.library.monsters] : [];
      const i = list.findIndex((x) => String(x.name || "").toLowerCase() === m.name.toLowerCase());
      if (i >= 0) list[i] = { ...list[i], ...m };
      else list.push(m);
      return { ...s, library: { ...s.library, monsters: list } };
    });
    return true;
  };

  const mergeSpell = (sp) => {
    if (!sp?.name) return false;
    setSettings((s) => {
      const list = Array.isArray(s.library.spells) ? [...s.library.spells] : [];
      const i = list.findIndex((x) => String(x.name || "").toLowerCase() === sp.name.toLowerCase());
      if (i >= 0) list[i] = { ...list[i], ...sp };
      else list.push(sp);
      return { ...s, library: { ...s.library, spells: list } };
    });
    return true;
  };

  const mergeNamed = (key, value) => {
    if (!value?.name && typeof value !== "string") return false;
    setSettings((s) => {
      const list = Array.isArray(s.library[key]) ? [...s.library[key]] : [];
      const name = String(typeof value === "string" ? value : value.name || "").toLowerCase();
      const i = list.findIndex(
        (x) => String(typeof x === "string" ? x : x?.name || "").toLowerCase() === name
      );
      if (typeof value === "string") {
        if (i < 0) list.push(value);
      } else if (i >= 0) {
        list[i] = { ...list[i], ...value };
      } else {
        list.push(value);
      }
      return { ...s, library: { ...s.library, [key]: list } };
    });
    return true;
  };

  const mergeNamedList = (listKey, value) => {
    if (!value?.name) return false;
    setSettings((s) => {
      const lists = { ...(s.library.lists || {}) };
      const list = Array.isArray(lists[listKey]) ? [...lists[listKey]] : [];
      const i = list.findIndex(
        (x) => String(typeof x === "string" ? x : x?.name || "").toLowerCase() === value.name.toLowerCase()
      );
      if (i >= 0) list[i] = { ...(typeof list[i] === "object" ? list[i] : { name: list[i] }), ...value };
      else list.push(value);
      lists[listKey] = list;
      return { ...s, library: { ...s.library, lists } };
    });
    return true;
  };

  const addLanguage = (name) => {
    if (!name) return false;
    setSettings((s) => {
      const lists = { ...(s.library.lists || {}) };
      const list = Array.isArray(lists.languages) ? [...lists.languages] : [];
      if (!list.some((x) => String(typeof x === "string" ? x : x?.name || "").toLowerCase() === name.toLowerCase())) {
        list.push(name);
      }
      lists.languages = list;
      return { ...s, library: { ...s.library, lists } };
    });
    return true;
  };

  const storeRaw = (catId, rawEntry) => {
    const entry = { ...rawEntry };
    delete entry.__filePath;
    setSettings((s) => {
      const map = { ...(s.library.fiveETools || {}) };
      const list = Array.isArray(map[catId]) ? [...map[catId]] : [];
      const key = `${entryName(entry)}|${sourceOf(entry)}`;
      const i = list.findIndex((x) => `${entryName(x)}|${sourceOf(x)}` === key);
      if (i >= 0) list[i] = entry;
      else list.push(entry);
      map[catId] = list;
      return { ...s, library: { ...s.library, fiveETools: map } };
    });
  };

  const tagForImport = (value) => {
    const importId = activeImportRef.current;
    return importId
      ? tagImported(value, importId, {
          label: `${root} · ${activeCategory.label}`,
          root,
        })
      : value;
  };

  const recordSession = (id, { count = 0, tabIds = [], label = "" } = {}) => {
    if (!id) return;
    setSettings((s) => ({
      ...s,
      library: recordImport(s.library, {
        id,
        label: label || `${root} · ${activeCategory.label}`,
        root,
        category: activeCategory.id,
        count,
        tabIds,
        tabs: tabIds.map((tabId) => (tree?.tabs || []).find((t) => t.id === tabId)?.name || ""),
      }),
    }));
  };

  const addImportedRulebook = (book) => {
    if (!book) return false;
    setSettings((s) => {
      const list = Array.isArray(s.library.fiveEToolsBooks)
        ? [...s.library.fiveEToolsBooks]
        : [];
      const i = list.findIndex((b) => b.id === book.id || b.title === book.title);
      if (i >= 0) list[i] = { ...list[i], ...book };
      else list.push(book);
      return { ...s, library: { ...s.library, fiveEToolsBooks: list } };
    });
    try {
      setRulebookActiveBookId(book.id);
      window.dispatchEvent(
        new CustomEvent("skilltree:rulebook-import", { detail: { bookId: book.id } })
      );
    } catch {
      /* the Rulebook will pick it up on its next open */
    }
    return true;
  };

  // Save one entry's artwork into the project's image folder. Returns the
  // stored `/images/...` reference (or the original data/project URL).
  const importEntryImage = async (entry) => {
    const url = imageFor(
      { ...entry, img: entryImage(entry) },
      root,
      entry?.__filePath || filePath
    );
    if (!url) return "";
    if (/^(data:|\/images\/)/i.test(url)) return url;
    try {
      return await importImageFromUrl(url);
    } catch {
      return "";
    }
  };

  // Rewrite the markdown images inside an imported book so every illustration
  // is stored with the project, not left pointing at 5eTools or a brew repo.
  const localizeBookImages = async (book, entry, cover) => {
    const cache = new Map();
    const resolve = async (url) => {
      if (!url || /^(data:|\/images\/)/i.test(url)) return url;
      if (cache.has(url)) return cache.get(url);
      let next = url;
      try {
        if (/^https?:/i.test(url) || url.startsWith("/api/")) {
          next = await importImageFromUrl(url);
        } else {
          next = await importImageFromUrl(
            imageFor({ img: url, cover: url }, root, entry?.__filePath || filePath)
          );
        }
      } catch {
        /* keep the original reference */
      }
      cache.set(url, next);
      return next;
    };
    const chapters = [];
    for (const chapter of book.chapters || []) {
      chapters.push({
        ...chapter,
        content: await importImagesInText(chapter.content, resolve),
      });
    }
    return { ...book, cover: cover || book.cover || "", chapters };
  };

  const importEntry = async (cat, entry) => {
    const image = await importEntryImage(entry);
    const withImage = (value) => {
      if (!value || typeof value === "string") return value;
      const next = image && !value.image ? { ...value, image } : value;
      return tagForImport(next);
    };
    const tag = (value) => tagForImport(value);

    if (cat.id === "books") {
      const entryRaw = rawForEntry(entry);
      const remoteInfo = isRemote
        ? catalog.find((f) => f.path === (entry.__filePath || filePath))
        : null;
      const fallbackTitle = entryRaw?.book?.[0]?.name || remoteInfo?.name || "";
      const book = bookToRulebook(entry, fallbackTitle);
      if (book) {
        const localized = await localizeBookImages(book, entry, image);
        addImportedRulebook(tag(localized));
        toast.success(`“${localized.title}” added to the Rulebook.`);
        return true;
      }
    }
    if (cat.kind === "items") {
      const mapped = itemToLibrary(entry);
      return mapped ? mergeNamed(mapped.key, withImage(mapped.value)) : false;
    }
    if (cat.kind === "conditions") {
      const status = conditionToStatus(entry);
      return status ? mergeNamed("statusEffects", withImage(status)) : false;
    }
    if (cat.kind === "actions") {
      const action = actionToLibrary(entry);
      return action ? mergeNamed("actions", withImage(action)) : false;
    }
    if (cat.kind === "languages") return addLanguage(languageToLibrary(entry));
    if (cat.kind === "skills") {
      const skill = skillToLibrary(entry);
      return skill ? mergeNamedList("skills", withImage(skill)) : false;
    }
    if (cat.kind === "senses") {
      const sense = senseToLibrary(entry);
      return sense ? mergeNamed("senses", withImage(sense)) : false;
    }
    if (cat.kind === "tables") {
      const table = tableToRollTable(entry);
      return table ? mergeNamed("rollTables", withImage(table)) : false;
    }
    if (cat.kind === "vehicles") {
      const vehicle = vehicleToLibrary(entry);
      return vehicle ? mergeNamed("vehicles", withImage(vehicle)) : false;
    }
    if (cat.kind === "monsters") {
      return mergeMonster(tag(image ? { ...entry, image } : entry));
    }
    if (cat.kind === "spells") return mergeSpell(withImage(spellToLibrary(entry)));
    if (cat.kind === "classes") {
      storeRaw(cat.id, tag({ ...entry, image: image || entry.image || "" }));
      const features = featuresForEntry(cat.id, entry, rawForEntry(entry));
      if (features.length) {
        const subclass = !!entry.shortName || !!entry.subclassShortName;
        const tabId = addImportedTab(
          `${subclass ? "Subclass" : "Class"}: ${entryName(entry)}`,
          features,
          {
            category: cat.label,
            layout: "class",
            className: subclass ? entry.className : entry.name,
          }
        );
        if (tabId) importTabIdsRef.current.push(tabId);
      }
      return true;
    }
    if (cat.kind === "feats" || cat.kind === "options") {
      storeRaw(cat.id, tag({ ...entry, image: image || entry.image || "" }));
      const features = featuresForEntry(cat.id, entry, rawForEntry(entry));
      if (features.length) {
        const tabId = addImportedTab(
          `${cat.label.replace(/^Other /, "")}: ${entryName(entry)}`,
          features,
          { category: cat.label }
        );
        if (tabId) importTabIdsRef.current.push(tabId);
      }
      return true;
    }
    storeRaw(cat.id, tag({ ...entry, image: image || entry.image || "" }));
    return true;
  };

  const creditAuthorsFor = (list) => {
    const info = isRemote ? catalog.find((f) => f.path === filePath) : null;
    const names = new Set();
    (list || []).forEach((entry) => {
      authorsFromBrew(raw, entry, info).forEach((name) => names.add(name));
    });
    return addCreditNames([...names]);
  };

  // Match a local source file to the Reference Index category that owns it.
  // Used by "Import all data", where each file may belong to a different tab.
  const categoryForLocalFile = (path) => {
    const file = { path, name: path.split("/").pop() };
    return (
      FIVE_CATEGORIES.find(
        (cat) => cat.id !== "life" && filesForCategory(cat, [file]).length > 0
      ) || null
    );
  };

  const importSelected = async () => {    const picked = [...selected].map((i) => entries[i]).filter(Boolean);
    if (!picked.length) {
      toast("Select one or more entries first.");
      return;
    }
    const importId = newImportId();
    activeImportRef.current = importId;
    importTabIdsRef.current = [];
    setImporting(picked.length);
    let done = 0;

    // Class bundles bypass importEntry(), so save their artwork first and
    // attach it when each base/subclass is stored.
    const classImages = new Map();
    if (activeCategory.kind === "classes") {
      for (const entry of picked) {
        classImages.set(entry, await importEntryImage(entry));
      }
    }

    // A class and the subclasses selected with it become one level-aligned
    // tab: base features in the main ladder, each subclass branching from the
    // level where it is gained.
    if (activeCategory.kind === "classes") {
      const bases = picked.filter((e) => !isSubclassEntry(e));
      const subs = picked.filter(isSubclassEntry);
      const bundles = bases.map((base) => ({ base, subs: [] }));
      subs.forEach((s) => {
        const bundle =
          bundles.find(
            (b) =>
              b.base.name === s.className &&
              (!s.classSource || !b.base.source || b.base.source === s.classSource)
          ) || bundles.find((b) => b.base.name === s.className);
        if (bundle) bundle.subs.push(s);
        else {
          storeRaw(activeCategory.id, tagForImport({
            ...s,
            image: classImages.get(s) || s.image || "",
          }));
          const features = featuresForEntry(activeCategory.id, s, rawForEntry(s));
          if (features.length) {
            const tabId = addImportedTab(`Subclass: ${entryName(s)}`, features, {
              category: activeCategory.label,
              layout: "class",
              className: s.className,
            });
            if (tabId) importTabIdsRef.current.push(tabId);
            done += 1;
          }
        }
      });
      for (const { base, subs: selectedSubs } of bundles) {
        storeRaw(activeCategory.id, tagForImport({
          ...base,
          image: classImages.get(base) || base.image || "",
        }));
        selectedSubs.forEach((s) =>
          storeRaw(activeCategory.id, tagForImport({
            ...s,
            image: classImages.get(s) || s.image || "",
          }))
        );
        const features = featuresForClassBundle(
          base,
          selectedSubs,
          rawForEntry(base) || rawForEntry(selectedSubs[0])
        );
        if (features.length) {
          const tabId = addImportedTab(`Class: ${entryName(base)}`, features, {
            category: activeCategory.label,
            layout: "class",
            className: base.name,
          });
          if (tabId) importTabIdsRef.current.push(tabId);
          done += 1;
        }
        setImporting(Math.max(0, picked.length - done));
        await sleep(Math.max(0, Math.min(5000, Number(delay) || 0)));
      }
    } else {
      for (const entry of picked) {
        await importEntry(activeCategory, entry);
        done += 1;
        setImporting(picked.length - done);
        await sleep(Math.max(0, Math.min(5000, Number(delay) || 0)));
      }
    }

    setImporting(0);
    setSelected(new Set());
    creditAuthorsFor(picked);
    recordSession(importId, { count: done, tabIds: importTabIdsRef.current });
    activeImportRef.current = "";
    toast.success(
      activeCategory.kind === "classes"
        ? `Imported ${done} class tab${done === 1 ? "" : "s"}.`
        : `Imported ${done} ${activeCategory.label.toLowerCase()} entr${done === 1 ? "y" : "ies"}.`
    );
  };

  const importPreview = async () => {
    if (!preview) return;
    const importId = newImportId();
    activeImportRef.current = importId;
    importTabIdsRef.current = [];
    await importEntry(activeCategory, preview);
    recordSession(importId, { count: 1, tabIds: importTabIdsRef.current });
    activeImportRef.current = "";
    creditAuthorsFor([preview]);
    toast.success(`Imported ${entryName(preview)}.`);
  };

  const categoryForBrew = (info) => {
    const id = categoryForProps(info?.props || []);
    return (
      FIVE_CATEGORIES.find((c) => c.id === id) || {
        id: id || info?.props?.[0] || "imported",
        label: id || info?.props?.[0] || "Imported",
      }
    );
  };

  const toggleCatalogFile = (path) => {
    setCatalogSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const allCatalogSelected =
    files.length > 0 && files.every((f) => catalogSelected.has(f.path));
  const selectAllCatalog = () => {
    setCatalogSelected((prev) => {
      const next = new Set(prev);
      if (allCatalogSelected) files.forEach((f) => next.delete(f.path));
      else files.forEach((f) => next.add(f.path));
      return next;
    });
  };

  // Batch import of whole source files. Files are fetched a few at a time and
  // applied to one working library draft per batch, so importing hundreds of
  // files does not trigger a state update per entity. `local` imports the
  // current category from the on-disk 5eTools data; otherwise it imports the
  // selected remote brew files.
  const importCatalogFiles = async (paths, { local = false, category = null } = {}) => {
    if (bulk) return;
    const chosen = (Array.isArray(paths) ? paths : []).filter(Boolean);
    if (!chosen.length) {
      toast("Select one or more files first.");
      return;
    }
    const effectiveCategory = local ? category || activeCategory : null;
    const warning = local
      ? `Import all ${chosen.length} files in “${effectiveCategory?.label || categoryId}”?\n\n` +
        `This reads every file in that category and can create a very large project.` +
        (bulkMakeTabs ? "\n\nClass and feat tabs will be created." : "")
      : `Import ${chosen.length} brew file${chosen.length === 1 ? "" : "s"} from GitHub?\n\n` +
        `This downloads each selected file. Importing the whole catalog can take several minutes and create a very large project.` +
        (bulkMakeTabs ? "\n\nClass and feat tabs will be created." : "");
    if (!window.confirm(warning)) return;
    const importId = newImportId();
    activeImportRef.current = importId;
    importTabIdsRef.current = [];
    bulkCancelRef.current = false;
    const bulkLib = new BulkLibrary(settings.library);
    const tabNames = new Set((tree?.tabs || []).map((t) => t.name));
    const creditNames = new Set();
    let done = 0;
    let entryTotal = 0;
    let tabTotal = 0;
    let errors = 0;
    const total = chosen.length;
    setBulk({ total, done: 0, entries: 0, tabs: 0, errors: 0, current: "" });
    try {
      const batchSize = 8;
      for (let start = 0; start < chosen.length; start += batchSize) {
        if (bulkCancelRef.current) break;
        const batch = chosen.slice(start, start + batchSize);
        const results = await Promise.all(
          batch.map(async (path) => {
            if (local) {
              try {
                const data = await fetchFiveFile(path);
                return {
                  path,
                  info: { name: path.split("/").pop(), props: [] },
                  data,
                  category: categoryForLocalFile(path) || effectiveCategory,
                };
              } catch {
                return { path, info: null, error: true };
              }
            }
            const info = catalog.find((f) => f.path === path);
            if (!info) return { path, error: true };
            try {
              const res = await fetch(
                `/api/5etools/remote?kind=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`
              );
              if (!res.ok) throw new Error("download failed");
              const data = await res.json();
              return { path, info, data, category: categoryForBrew(info) };
            } catch {
              return { path, info, error: true };
            }
          })
        );
        const newTabs = [];
        results.forEach((r) => {
          done += 1;
          if (r.error) {
            errors += 1;
            return;
          }
          try {
            authorsFromBrew(r.data, null, r.info).forEach((name) => creditNames.add(name));
            const applied = importBrewIntoDraft(bulkLib, r.info, r.category, r.data, {
              makeTabs: bulkMakeTabs,
              kind: local ? "data" : root,
              importId,
            });
            entryTotal += applied.entries;
            applied.tabs.forEach((tab) => {
              if (tabNames.has(tab.name)) return;
              tabNames.add(tab.name);
              newTabs.push(tab);
              tabTotal += 1;
            });
          } catch {
            errors += 1;
          }
        });
        if (newTabs.length) {
          const ids = addImportedTabs(newTabs, { activate: false });
          importTabIdsRef.current.push(...(ids || []));
        }
        setSettings((s) => ({ ...s, library: bulkLib.library }));
        setBulk({
          total,
          done,
          entries: entryTotal,
          tabs: tabTotal,
          errors,
          current: batch[batch.length - 1] || "",
        });
        // Yield so progress/cancel stay responsive between batches.
        await new Promise((r) => setTimeout(r, 0));
      }
      setBulk((b) => (b ? { ...b, current: "Saving artwork…" } : b));
      const images = await localizeBulkImages(bulkLib.library, local ? "data" : root, {
        limit: 400,
      });
      setSettings((s) => ({ ...s, library: bulkLib.library }));
      recordSession(importId, {
        count: entryTotal,
        tabIds: importTabIdsRef.current,
        label: local
          ? `${effectiveCategory?.label || categoryId} · local data`
          : `${root} · brew files`,
      });
      if (creditNames.size) addCreditNames([...creditNames]);
      if (bulkCancelRef.current) {
        toast(`Stopped after ${done} of ${total} files. Imported data is kept.`);
      } else {
        toast.success(
          `Imported ${entryTotal} entries from ${done} files${tabTotal ? ` and created ${tabTotal} tabs` : ""}${
            images.saved ? ` · saved ${images.saved} pictures` : ""
          }${errors ? ` · ${errors} failed` : ""}.`
        );
        if (images.skipped) {
          toast(
            `${images.skipped} extra pictures still use the source link. Re-import that file to save them, or import individual entries.`
          );
        }
      }
    } catch (err) {
      toast.error(`Bulk import stopped: ${err.message || err}`);
    } finally {
      activeImportRef.current = "";
      setBulk(null);
      bulkCancelRef.current = false;
    }
  };

  const importAllFiles = (everything = false) => {
    if (bulk) return;
    const source = everything
      ? isRemote
        ? catalog
        : index.filter((f) => isSourceFile(f.path))
      : files;
    const paths = source.map((f) => f.path);
    if (!paths.length) {
      toast("No files to import.");
      return;
    }
    importCatalogFiles(paths, {
      local: !isRemote,
      category: everything ? { id: "__all__", label: "All categories" } : activeCategory,
    });
  };

  const undoImport = (record) => {
    if (!record) return;
    if (activeImportRef.current === record.id) {
      toast("Wait for this import to finish first.");
      return;
    }
    if (
      !window.confirm(
        `Remove ${record.count || ""} entries and ${record.tabIds?.length || 0} tab(s) from “${
          record.label || "this import"
        }”?`
      )
    ) {
      return;
    }
    const result = removeImportFromLibrary(settings.library, record.id);
    setSettings((s) => ({
      ...s,
      library: removeImportFromLibrary(s.library, record.id).library,
    }));
    (record.tabIds || result.tabIds || []).forEach((id) => deleteTab(id));
    toast.success(`Removed “${record.label || "import"}”.`);
  };

  if (!isRemote && status && !status.available) {
    const devPort = typeof window !== "undefined" ? window.location.port : "";
    const apiMissing = status.apiError && devPort && devPort !== "4173";
    return (
      <div className="space-y-2 rounded-md border border-dashed p-4 text-xs">
        <p className="font-medium">
          {apiMissing ? "Local server API not reachable." : "5eTools data not found."}
        </p>
        <p className="text-muted-foreground">
          {apiMissing
            ? `This page is running on the Vite dev server (port ${devPort}), which does not host the PowerShell API. Use the launcher at http://localhost:4173, or restart the dev server so its /api proxy can reach the local server.`
            : "Download the latest 5eTools release, or place a 5eTools folder at E:\\5etools. Downloaded data stays in the app's own user data folder."}
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={updateData} disabled={updating}>
            {updating ? "Downloading…" : "Download 5eTools"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => refresh(true)}>Retry</Button>
        </div>
      </div>
    );
  }

  const previewImage = preview
    ? imageFor(
        { ...preview, img: previewDetails?.image || preview?.img },
        root,
        preview.__filePath || filePath
      )
    : "";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium">Reference Index</p>
        <div className="flex items-center gap-1">
          <Label className="text-[10px] text-muted-foreground">Source</Label>
          <Select
            value={root}
            onValueChange={(v) => {
              setRoot(v);
              setCategoryId((cur) =>
                isRemoteRoot(v) ? "__all__" : cur === "__all__" ? "bestiary" : cur
              );
              setFileQuery("");
              setPartneredOnly(false);
            }}
          >
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROOTS.map(([id, label]) => (
                <SelectItem
                  key={id}
                  value={id}
                  disabled={id === "data" && !status?.roots?.data}
                >
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="min-w-0 text-[10px] text-muted-foreground">
          {isRemote
            ? `${root === "homebrew" ? "TheGiddyLimit/homebrew" : "TheGiddyLimit/unearthed-arcana"} · ${catalog.length} files`
            : status?.base
              ? `${status.base}\\${root}`
              : "Reading local 5eTools data…"}
          {!isRemote && status?.version ? ` · ${status.version}` : ""}
          {!isRemote && (status?.managed ? " · downloaded" : status?.base ? " · local folder" : "")}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {!isRemote && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={updateData}
              disabled={updating}
              title="Download the newest 5eTools release from GitHub into this app's data folder"
            >
              {updating ? "Downloading…" : "Update from GitHub"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => importAllFiles(true)}
            disabled={
              !!bulk ||
              (isRemote ? catalog.length === 0 : index.filter((f) => isSourceFile(f.path)).length === 0)
            }
            title="Import every source file in this data set (all categories)"
          >
            Import all data
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => refresh(true)}>
            {isRemote ? "Refresh catalog" : "Refresh index"}
          </Button>
        </div>
      </div>

      {bulk && (
        <div className="space-y-1 rounded-md border bg-muted/30 p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              Importing {bulk.done}/{bulk.total} files · {bulk.entries} entries
              {bulk.tabs ? ` · ${bulk.tabs} tabs` : ""}
              {bulk.errors ? ` · ${bulk.errors} failed` : ""}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                bulkCancelRef.current = true;
              }}
            >
              Stop
            </Button>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${bulk.total ? (bulk.done / bulk.total) * 100 : 0}%` }}
            />
          </div>
          {bulk.current && (
            <p className="truncate text-[10px] text-muted-foreground">{bulk.current}</p>
          )}
        </div>
      )}

      <div className="grid h-[64vh] min-h-[430px] grid-cols-[150px_200px_minmax(0,1fr)_minmax(260px,1.1fr)] gap-2">
        <aside className="overflow-y-auto rounded-md border p-1">
          <button
            type="button"
            onClick={() => setCategoryId("__all__")}
            className={`w-full truncate rounded px-2 py-1 text-left text-[11px] ${
              categoryId === "__all__"
                ? "bg-primary/10 font-semibold text-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
            title="Show every file in this 5eTools repository"
          >
            All files
          </button>
          {FIVE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`w-full truncate rounded px-2 py-1 text-left text-[11px] ${
                c.id === categoryId ? "bg-primary/10 font-semibold text-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
              title={c.label}
            >
              {c.label}
            </button>
          ))}
          {sourceCounts.length > 0 && (
            <div className="mt-2 border-t pt-1">
              <p className="px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                Sources
              </p>
              <button
                type="button"
                onClick={() => setSourceFilter("__all__")}
                className={`w-full truncate rounded px-2 py-1 text-left text-[10px] ${
                  sourceFilter === "__all__"
                    ? "bg-primary/10 font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                All sources ({entries.length})
              </button>
              {sourceCounts.map(([source, count]) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setSourceFilter(source)}
                  className={`w-full truncate rounded px-2 py-1 text-left text-[10px] ${
                    sourceFilter === source
                      ? "bg-primary/10 font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                  title={`${source} (${count} entries)`}
                >
                  {source} ({count})
                </button>
              ))}
            </div>
          )}
        </aside>

        <aside className="flex min-h-0 flex-col rounded-md border">
          <div className="flex items-center justify-between gap-1 border-b px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <span>Files ({files.length})</span>
            <div className="flex items-center gap-1">
              {allMode ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-1 text-[9px]"
                  onClick={() => {
                    setAllMode(false);
                    if (files[0]) loadFile(files[0].path);
                  }}
                >
                  Single file
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-1 text-[9px]"
                  onClick={loadAllFiles}
                  disabled={!files.length || !!loading}
                  title="Load entries from every file in this category/source"
                >
                  Display all
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-1 text-[9px]"
                onClick={() => importAllFiles(false)}
                disabled={!files.length || !!bulk}
                title="Import every file currently listed in this category"
              >
                Import all
              </Button>
            </div>
          </div>
          {allProgress && (
            <div className="space-y-1 border-b px-2 py-1">
              <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                <span>
                  Loading all files · {allProgress.done}/{allProgress.total}
                </span>
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    allCancelRef.current = true;
                  }}
                >
                  Stop
                </button>
              </div>
              <div className="h-1 rounded bg-muted">
                <div
                  className="h-full rounded bg-primary"
                  style={{ width: `${(allProgress.done / allProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          <div className="space-y-1 border-b p-1">
            <Input
              className="h-7 text-xs"
              placeholder={isRemote ? "Find a brew…" : "Find a file…"}
              value={fileQuery}
              onChange={(e) => setFileQuery(e.target.value)}
            />
            {isRemote && (
              <>
                {root === "homebrew" && (
                  <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Switch checked={partneredOnly} onCheckedChange={setPartneredOnly} />
                    Partnered only
                  </label>
                )}
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Switch checked={bulkMakeTabs} onCheckedChange={setBulkMakeTabs} />
                  Create feature tabs
                </label>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1 text-[10px]"
                    onClick={selectAllCatalog}
                  >
                    {allCatalogSelected ? "Clear files" : "Select all files"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-1 text-[10px]"
                    disabled={!catalogSelected.size || !!bulk}
                    onClick={() => importCatalogFiles([...catalogSelected])}
                  >
                    Import files ({catalogSelected.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-1 text-[10px]"
                    disabled={!files.length || !!bulk}
                    onClick={() => importCatalogFiles(files.map((f) => f.path))}
                  >
                    Import all shown ({files.length})
                  </Button>
                </div>
              </>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {files.map((f) => (
              <div key={f.path} className="flex items-start gap-1 rounded px-0.5 hover:bg-accent/40">
                {isRemote && (
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={catalogSelected.has(f.path)}
                    onChange={() => toggleCatalogFile(f.path)}
                    title="Select this brew for batch import"
                  />
                )}
                <button
                  type="button"
                  onClick={() => loadFile(f.path)}
                  className={`min-w-0 flex-1 rounded px-1 py-1 text-left text-[10px] ${
                    f.path === filePath ? "bg-accent font-medium" : "hover:bg-accent/60"
                  }`}
                  title={isRemote ? `${f.name} — ${f.author}\n${f.path}` : f.path}
                >
                  {isRemote ? (
                    <>
                      <span className="block truncate font-medium">{f.name || f.path}</span>
                      <span className="block truncate text-muted-foreground">
                        {[f.author, f.partnered ? "Partnered" : "", f.status !== "ready" ? f.status : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </>
                  ) : (
                    <span className="block truncate">{f.path}</span>
                  )}
                </button>
              </div>
            ))}
            {files.length === 0 && (
              <p className="p-2 text-[10px] text-muted-foreground">
                No files in this source/category.
              </p>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col rounded-md border">
          <div className="flex flex-wrap items-center gap-1 border-b p-1.5">
            <Input
              className="h-7 w-32 text-xs"
              placeholder="Filter entries…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All sources</SelectItem>
                {sourceOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={toggleAll}>
              {allShownSelected ? "Clear" : "Select all"}
            </Button>
            <span className="text-[10px] text-muted-foreground">{selected.size} selected</span>
            <div className="ml-auto flex items-center gap-1">
              <Label className="text-[10px] text-muted-foreground">Delay ms</Label>
              <Input
                className="h-7 w-14 text-xs"
                type="number"
                min={0}
                max={5000}
                value={delay}
                onChange={(e) => setDelay(Math.max(0, Math.min(5000, Number(e.target.value) || 0)))}
              />
              <Button size="sm" className="h-7 text-xs" disabled={loading || importing > 0} onClick={importSelected}>
                {importing > 0 ? `Importing ${importing}…` : "Import selected"}
              </Button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-1">
            {loading && <p className="p-2 text-xs text-muted-foreground">Reading file…</p>}
            {!loading && entries.length === 0 && (
              <p className="p-2 text-xs text-muted-foreground">Choose a file to browse its entries.</p>
            )}
            <VirtualList
              items={shown}
              rowHeight={46}
              getKey={(e, idx) => `${entryName(e)}-${entryIndex.get(e) ?? idx}`}
              className="min-h-0 flex-1"
              render={(e) => {
                const i = entryIndex.get(e);
                return (
                  <label
                    onClick={() => setPreview(e)}
                    className={`flex h-full cursor-pointer items-start gap-1.5 overflow-hidden rounded px-1.5 py-1 text-[10px] ${
                      preview === e ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selected.has(i)}
                      onClick={(ev) => ev.stopPropagation()}
                      onChange={() => toggle(i)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-1">
                        <span className="min-w-0 truncate font-medium">{String(entryName(e))}</span>
                        <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[8px] uppercase tracking-wide text-muted-foreground">
                          {sourceOf(e) || "—"}
                        </span>
                      </span>
                      <span className="block truncate text-muted-foreground">{String(entryMeta(e))}</span>
                      <span className="line-clamp-1 text-muted-foreground/80">{String(entryPreview(e))}</span>
                    </span>
                  </label>
                );
              }}
            />
          </div>
          <p className="border-t px-2 py-1 text-[10px] text-muted-foreground">
            {{
              monsters: "Bestiary entries import into the normal Monsters tab.",
              spells: "Spells import into the normal Spells tab.",
              classes:
                "Class features import into a level-aligned tab. Select a class and its subclasses together to branch them into one tab.",
              feats: "Feats import as an informative feature tab in the Tree system.",
              options: "Features import as an informative tab in the Tree system.",
              items: "Items are sorted into Weapons, Armor, Wondrous Items, gear, poisons, explosives and vehicles.",
              conditions: "Conditions, diseases and statuses import into Status Effects.",
              actions: "Actions import into the Actions tab with their action/bonus/reaction timing.",
              languages: "Languages import into the Languages list.",
              skills: "Skills import with their governing ability.",
              senses: "Senses import into the Senses library.",
              tables: "Tables import into Roll Tables.",
              vehicles: "Vehicles import into the Vehicles library.",
              backgrounds: "Backgrounds import into the Backgrounds tab.",
              species: "Species import into the Species tab.",
              deities: "Deities import into the Deities tab.",
              objects: "Objects import into the Objects tab.",
              traps: "Traps and hazards import into the Traps & Hazards tab.",
              books: "Books import into the Rulebook as read-only books.",
            }[activeCategory.kind || activeCategory.id] || "Imported entries are kept in the 5eTools Imports tab of the Reference Library."}
          </p>
        </section>

        <aside className="flex min-h-0 flex-col rounded-md border">
          <div className="flex items-center justify-between gap-1 border-b px-2 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span>Preview</span>
            {preview && (
              <span className="truncate text-[9px] normal-case tracking-normal text-muted-foreground">
                {sourceOf(preview) || "Unknown source"}
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2 text-xs">
            <ReferenceEntryPreview
              details={previewDetails}
              imageSrc={previewImage}
              onImport={preview ? importPreview : undefined}
              importingLabel={importing > 0 ? "Importing…" : ""}
            />
          </div>
        </aside>
      </div>

      <div className="rounded-md border">
        <button
          type="button"
          className="flex w-full items-center justify-between px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
          onClick={() => setHistoryOpen((v) => !v)}
        >
          <span>Import history ({(settings?.library?.importHistory || []).length})</span>
          <span>{historyOpen ? "Hide" : "Show"}</span>
        </button>
        {historyOpen && (
          <div className="space-y-1 border-t p-2">
            {(settings?.library?.importHistory || []).length === 0 ? (
              <p className="text-[10px] text-muted-foreground">
                No tagged imports yet. Every new import gets a rollback record here.
              </p>
            ) : (
              (settings.library.importHistory || []).map((record) => (
                <div
                  key={record.id}
                  className="flex flex-wrap items-center gap-1 rounded border px-1.5 py-1 text-[10px]"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {record.label || "Import"}
                  </span>
                  <span className="text-muted-foreground">
                    {record.count || 0} entries{record.tabIds?.length ? ` · ${record.tabIds.length} tabs` : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {record.at ? new Date(record.at).toLocaleString() : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-1 text-[9px]"
                    onClick={() => undoImport(record)}
                  >
                    Undo import
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Imported entries are saved with the project. Raw source files are only read from the
        local 5eTools folders; use the Save / Load option to include cached source JSON when you
        need a portable copy.
        {Object.keys(imported).length > 0 ? ` Imported categories: ${Object.keys(imported).join(", ")}.` : ""}
      </p>
    </div>
  );
}
