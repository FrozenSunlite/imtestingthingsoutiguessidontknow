import { useEffect, useMemo, useState } from "react";
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
import { entryDetails } from "@/lib/fiveEToolsView";
import { loadSpellLookup } from "@/lib/fiveEToolsLookup";
import { ReferenceEntryPreview } from "./ReferenceEntryPreview";
import { normalizeImportedMonster } from "@/lib/monsterImport";
import { cacheFiveEToolsSource } from "@/lib/fiveEToolsCache";
import { importImageFromUrl } from "@/lib/imageStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ["data", "Partnered"],
  ["homebrew", "Homebrew"],
  ["prerelease", "Prerelease"],
];

const isSubclassEntry = (entry) => !!entry?.shortName || !!entry?.subclassShortName;

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
  if (/^(https?:|data:|\/images\/)/i.test(raw)) return raw;
  const dir = filePath?.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : "";
  const cleaned = raw.replace(/^\/+/, "");
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
  const { settings, setSettings, addImportedTab } = useTree();
  const [status, setStatus] = useState(null);
  const [root, setRoot] = useState("data");
  const [index, setIndex] = useState([]);
  const [categoryId, setCategoryId] = useState("bestiary");
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

  const category = FIVE_CATEGORIES.find((c) => c.id === categoryId) || FIVE_CATEGORIES[0];
  const files = useMemo(() => {
    const list = root === "data" ? filesForCategory(category, index) : index.filter((f) => isSourceFile(f.path));
    return list.sort((a, b) => a.path.localeCompare(b.path));
  }, [category, index, root]);
  const sourceOptions = useMemo(
    () => [...new Set(entries.map(sourceOf).filter(Boolean))].sort(),
    [entries]
  );
  const shown = entries.filter((e) => {
    const q = query.trim().toLowerCase();
    if (q && !`${entryName(e)} ${entryMeta(e)}`.toLowerCase().includes(q)) return false;
    if (sourceFilter !== "__all__" && sourceOf(e) !== sourceFilter) return false;
    return true;
  });
  const imported = settings?.library?.fiveETools || {};
  const previewDetails = useMemo(
    () => (preview ? entryDetails(category.id, preview, raw, { spellLookup }) : null),
    [preview, category.id, raw, spellLookup]
  );

  const refresh = async () => {
    try {
      const s = await fetch("/api/5etools/status").then((r) => r.json());
      setStatus(s);
      const i = await fetch(`/api/5etools/index?root=${encodeURIComponent(root)}`).then((r) => r.json());
      setIndex(Array.isArray(i.files) ? i.files : []);
    } catch {
      setStatus({ available: false, roots: {} });
      setIndex([]);
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
      await refresh();
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
    setEntries([]);
    setPreview(null);
    setSelected(new Set());
  }, [categoryId, root, index.length]);

  const loadFile = async (path) => {
    if (!path) return;
    setLoading(true);
    try {
      const data = await fetch(
        `/api/5etools/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`
      ).then((r) => r.json());
      cacheFiveEToolsSource(`${root}/${path}`, data);
      const list = entriesFromRaw(data).map((e) => ({ ...e }));
      setRaw(data);
      setEntries(list);
      setPreview(list[0] || null);
      setSelected(new Set());
      setSourceFilter("__all__");
      setFilePath(path);
      if (!list.length) toast("That file has no importable entries.");
    } catch {
      toast.error("Could not read that 5eTools file.");
    } finally {
      setLoading(false);
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

  const allShownSelected = shown.length > 0 && shown.every((e) => selected.has(entries.indexOf(e)));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShownSelected) shown.forEach((e) => next.delete(entries.indexOf(e)));
      else shown.forEach((e) => next.add(entries.indexOf(e)));
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

  const mergeSpell = (entry) => {
    const sp = spellToLibrary(entry);
    if (!sp.name) return false;
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

  const storeRaw = (catId, entry) => {
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

  const importEntry = async (cat, entry) => {
    if (cat.kind === "items") {
      const mapped = itemToLibrary(entry);
      return mapped ? mergeNamed(mapped.key, mapped.value) : false;
    }
    if (cat.kind === "conditions") {
      const status = conditionToStatus(entry);
      return status ? mergeNamed("statusEffects", status) : false;
    }
    if (cat.kind === "actions") {
      const action = actionToLibrary(entry);
      return action ? mergeNamed("actions", action) : false;
    }
    if (cat.kind === "languages") return addLanguage(languageToLibrary(entry));
    if (cat.kind === "skills") {
      const skill = skillToLibrary(entry);
      return skill ? mergeNamedList("skills", skill) : false;
    }
    if (cat.kind === "senses") {
      const sense = senseToLibrary(entry);
      return sense ? mergeNamed("senses", sense) : false;
    }
    if (cat.kind === "tables") {
      const table = tableToRollTable(entry);
      return table ? mergeNamed("rollTables", table) : false;
    }
    if (cat.kind === "vehicles") {
      const vehicle = vehicleToLibrary(entry);
      return vehicle ? mergeNamed("vehicles", vehicle) : false;
    }
    if (cat.kind === "monsters") {
      let value = entry;
      const image = imageFor(entry, root, filePath);
      if (image && !image.startsWith("/images/") && !image.startsWith("data:")) {
        try {
          value = { ...entry, image: await importImageFromUrl(image) };
        } catch {
          /* keep the original reference */
        }
      }
      return mergeMonster(value);
    }
    if (cat.kind === "spells") return mergeSpell(entry);
    if (cat.kind === "classes") {
      storeRaw(cat.id, entry);
      const features = featuresForEntry(cat.id, entry, raw);
      if (features.length) {
        const subclass = !!entry.shortName || !!entry.subclassShortName;
        addImportedTab(
          `${subclass ? "Subclass" : "Class"}: ${entryName(entry)}`,
          features,
          {
            category: cat.label,
            layout: "class",
            className: subclass ? entry.className : entry.name,
          }
        );
      }
      return true;
    }
    if (cat.kind === "feats" || cat.kind === "options") {
      storeRaw(cat.id, entry);
      const features = featuresForEntry(cat.id, entry, raw);
      if (features.length) {
        addImportedTab(
          `${cat.label.replace(/^Other /, "")}: ${entryName(entry)}`,
          features,
          { category: cat.label }
        );
      }
      return true;
    }
    storeRaw(cat.id, entry);
    return true;
  };

  const importSelected = async () => {
    const picked = [...selected].map((i) => entries[i]).filter(Boolean);
    if (!picked.length) {
      toast("Select one or more entries first.");
      return;
    }
    setImporting(picked.length);
    let done = 0;

    // A class and the subclasses selected with it become one level-aligned
    // tab: base features in the main ladder, each subclass branching from the
    // level where it is gained.
    if (category.kind === "classes") {
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
          storeRaw(category.id, s);
          const features = featuresForEntry(category.id, s, raw);
          if (features.length) {
            addImportedTab(`Subclass: ${entryName(s)}`, features, {
              category: category.label,
              layout: "class",
              className: s.className,
            });
            done += 1;
          }
        }
      });
      for (const { base, subs: selectedSubs } of bundles) {
        storeRaw(category.id, base);
        selectedSubs.forEach((s) => storeRaw(category.id, s));
        const features = featuresForClassBundle(base, selectedSubs, raw);
        if (features.length) {
          addImportedTab(`Class: ${entryName(base)}`, features, {
            category: category.label,
            layout: "class",
            className: base.name,
          });
          done += 1;
        }
        setImporting(Math.max(0, picked.length - done));
        await sleep(Math.max(0, Math.min(5000, Number(delay) || 0)));
      }
    } else {
      for (const entry of picked) {
        await importEntry(category, entry);
        done += 1;
        setImporting(picked.length - done);
        await sleep(Math.max(0, Math.min(5000, Number(delay) || 0)));
      }
    }

    setImporting(0);
    setSelected(new Set());
    toast.success(
      category.kind === "classes"
        ? `Imported ${done} class tab${done === 1 ? "" : "s"}.`
        : `Imported ${done} ${category.label.toLowerCase()} entr${done === 1 ? "y" : "ies"}.`
    );
  };

  const importPreview = async () => {
    if (!preview) return;
    await importEntry(category, preview);
    toast.success(`Imported ${entryName(preview)}.`);
  };

  if (status && !status.available) {
    return (
      <div className="space-y-2 rounded-md border border-dashed p-4 text-xs">
        <p className="font-medium">5eTools data not found.</p>
        <p className="text-muted-foreground">
          Download the latest 5eTools release, or place a 5eTools folder at{" "}
          <code>E:\5etools</code>. Downloaded data stays in the app's own user data folder.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={updateData} disabled={updating}>
            {updating ? "Downloading…" : "Download 5eTools"}
          </Button>
          <Button size="sm" variant="outline" onClick={refresh}>Retry</Button>
        </div>
      </div>
    );
  }

  const previewImage = preview ? imageFor(preview, root, filePath) : "";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium">Reference Index</p>
        <div className="flex items-center gap-1">
          <Label className="text-[10px] text-muted-foreground">Source</Label>
          <Select value={root} onValueChange={setRoot}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROOTS.map(([id, label]) => (
                <SelectItem key={id} value={id} disabled={!status?.roots?.[id]}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="min-w-0 text-[10px] text-muted-foreground">
          {status?.base ? `${status.base}\\${root}` : "Reading local 5eTools data…"}
          {status?.version ? ` · ${status.version}` : ""}
          {status?.managed ? " · downloaded" : status?.base ? " · local folder" : ""}
        </span>
        <div className="ml-auto flex items-center gap-1">
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
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={refresh}>
            Refresh index
          </Button>
        </div>
      </div>

      <div className="grid h-[64vh] min-h-[430px] grid-cols-[150px_200px_minmax(0,1fr)_minmax(260px,1.1fr)] gap-2">
        <aside className="overflow-y-auto rounded-md border p-1">
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
        </aside>

        <aside className="flex min-h-0 flex-col rounded-md border">
          <div className="border-b px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Files ({files.length})
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {files.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => loadFile(f.path)}
                className={`w-full truncate rounded px-1.5 py-1 text-left text-[10px] ${
                  f.path === filePath ? "bg-accent font-medium" : "hover:bg-accent/60"
                }`}
                title={f.path}
              >
                {f.path}
              </button>
            ))}
            {files.length === 0 && (
              <p className="p-2 text-[10px] text-muted-foreground">No files in this source/category.</p>
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
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {loading && <p className="p-2 text-xs text-muted-foreground">Reading file…</p>}
            {!loading && entries.length === 0 && (
              <p className="p-2 text-xs text-muted-foreground">Choose a file to browse its entries.</p>
            )}
            {shown.map((e) => {
              const i = entries.indexOf(e);
              return (
                <label
                  key={`${entryName(e)}-${i}`}
                  onClick={() => setPreview(e)}
                  className={`flex cursor-pointer items-start gap-1.5 rounded px-1.5 py-1 text-[10px] ${
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
                    <span className="block truncate font-medium">{String(entryName(e))}</span>
                    <span className="block truncate text-muted-foreground">{String(entryMeta(e))}</span>
                    <span className="line-clamp-1 text-muted-foreground/80">{String(entryPreview(e))}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {category.kind && (
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
              }[category.kind] || "Imported entries are kept in the 5eTools library."}
            </p>
          )}
        </section>

        <aside className="flex min-h-0 flex-col rounded-md border">
          <div className="border-b px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Preview
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

      <p className="text-[10px] text-muted-foreground">
        Imported entries are saved with the project. Raw source files are only read from the
        local 5eTools folders; use the Save / Load option to include cached source JSON when you
        need a portable copy.
        {Object.keys(imported).length > 0 ? ` Imported categories: ${Object.keys(imported).join(", ")}.` : ""}
      </p>
    </div>
  );
}
