import { useEffect, useMemo, useState } from "react";
import { useTree } from "@/lib/treeStore";
import {
  FIVE_CATEGORIES,
  entriesFromRaw,
  entryMeta,
  entryName,
  entryPreview,
  featuresForEntry,
  filesForCategory,
  spellToLibrary,
} from "@/lib/fiveETools";
import { normalizeImportedMonster } from "@/lib/monsterImport";
import { cacheFiveEToolsSource } from "@/lib/fiveEToolsCache";
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

// Reference Index: a local, read-only view of the 5eTools data folder. Files
// are fetched on demand, entries can be selected and imported at a chosen rate.
// Imported data becomes part of the project library; raw source files stay in
// the on-disk 5eTools folder and are only cached when the save option is used.
export function ReferenceIndexTab() {
  const { settings, setSettings, addImportedTab } = useTree();
  const [status, setStatus] = useState(null);
  const [index, setIndex] = useState([]);
  const [categoryId, setCategoryId] = useState("bestiary");
  const [filePath, setFilePath] = useState("");
  const [raw, setRaw] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const [delay, setDelay] = useState(120);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(0);

  const category = FIVE_CATEGORIES.find((c) => c.id === categoryId) || FIVE_CATEGORIES[0];
  const files = useMemo(() => filesForCategory(category, index).sort((a, b) => a.path.localeCompare(b.path)), [category, index]);
  const shown = entries.filter((e) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${entryName(e)} ${entryMeta(e)}`.toLowerCase().includes(q);
  });
  const imported = settings?.library?.fiveETools || {};

  const refresh = async () => {
    try {
      const [s, i] = await Promise.all([
        fetch("/api/5etools/status").then((r) => r.json()),
        fetch("/api/5etools/index").then((r) => r.json()),
      ]);
      setStatus(s);
      setIndex(Array.isArray(i.files) ? i.files : []);
    } catch {
      setStatus({ available: false });
      setIndex([]);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    setFilePath(files[0]?.path || "");
    setEntries([]);
    setSelected(new Set());
  }, [categoryId, index.length]);

  const loadFile = async (path) => {
    if (!path) return;
    setLoading(true);
    try {
      const data = await fetch(`/api/5etools/file?path=${encodeURIComponent(path)}`).then((r) => r.json());
      cacheFiveEToolsSource(path, data);
      const list = entriesFromRaw(data);
      setRaw(data);
      setEntries(list);
      setSelected(new Set());
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

  const storeRaw = (catId, entry) => {
    setSettings((s) => {
      const map = { ...(s.library.fiveETools || {}) };
      const list = Array.isArray(map[catId]) ? [...map[catId]] : [];
      const key = `${entryName(entry)}|${entry.source || ""}`;
      const i = list.findIndex((x) => `${entryName(x)}|${x.source || ""}` === key);
      if (i >= 0) list[i] = entry;
      else list.push(entry);
      map[catId] = list;
      return { ...s, library: { ...s.library, fiveETools: map } };
    });
  };

  const importEntry = (cat, entry, fileRaw) => {
    if (cat.kind === "monsters") return mergeMonster(entry);
    if (cat.kind === "spells") return mergeSpell(entry);
    if (cat.kind === "classes" || cat.kind === "feats" || cat.kind === "options") {
      storeRaw(cat.id, entry);
      const features = featuresForEntry(cat.id, entry, fileRaw);
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
    for (const entry of picked) {
      importEntry(category, entry, raw);
      done += 1;
      setImporting(picked.length - done);
      await sleep(Math.max(0, Math.min(5000, Number(delay) || 0)));
    }
    setImporting(0);
    setSelected(new Set());
    toast.success(`Imported ${done} ${category.label.toLowerCase()} entr${done === 1 ? "y" : "ies"}.`);
  };

  if (status && !status.available) {
    return (
      <div className="space-y-2 rounded-md border border-dashed p-4 text-xs">
        <p className="font-medium">5eTools data not found.</p>
        <p className="text-muted-foreground">
          Expected the local data folder at <code>E:\5etools\data</code>. Set the
          <code>TT_5ETOOLS_ROOT</code> environment variable before launching the app if your copy lives elsewhere.
        </p>
        <Button size="sm" variant="outline" onClick={refresh}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium">Reference Index</p>
        <span className="text-[10px] text-muted-foreground">
          {status?.root ? `Reading ${status.root}` : "Reading local 5eTools data…"}
        </span>
        <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={refresh}>
          Refresh index
        </Button>
      </div>

      <div className="grid h-[62vh] min-h-[420px] grid-cols-[170px_230px_1fr] gap-2">
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
              <p className="p-2 text-[10px] text-muted-foreground">No files in this category.</p>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col rounded-md border">
          <div className="flex flex-wrap items-center gap-1 border-b p-1.5">
            <Input
              className="h-7 w-40 text-xs"
              placeholder="Filter entries…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={toggleAll}>
              {allShownSelected ? "Clear" : "Select all"}
            </Button>
            <span className="text-[10px] text-muted-foreground">{selected.size} selected</span>
            <div className="ml-auto flex items-center gap-1">
              <Label className="text-[10px] text-muted-foreground">Delay ms</Label>
              <Input
                className="h-7 w-16 text-xs"
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
                  className="flex cursor-pointer items-start gap-1.5 rounded px-1.5 py-1 text-[10px] hover:bg-accent/50"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{entryName(e)}</span>
                    <span className="block truncate text-muted-foreground">{entryMeta(e)}</span>
                    <span className="line-clamp-1 text-muted-foreground/80">{entryPreview(e)}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {category.kind && (
            <p className="border-t px-2 py-1 text-[10px] text-muted-foreground">
              {category.kind === "monsters"
                ? "Bestiary entries import into the normal Monsters tab."
                : category.kind === "spells"
                ? "Spells import into the normal Spells tab."
                : "Features import into a new tab in the Tree system; the raw entry is kept in the 5eTools library."}
            </p>
          )}
        </section>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Imported entries are saved with the project. Raw source files are only read from the
        local 5eTools folder; use the Save / Load option to include cached source JSON when you
        need a portable copy.
        {Object.keys(imported).length > 0 ? ` Imported categories: ${Object.keys(imported).join(", ")}.` : ""}
      </p>
    </div>
  );
}
