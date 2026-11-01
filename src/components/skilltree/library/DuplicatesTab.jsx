import { useMemo } from "react";
import { useTree } from "@/lib/treeStore";
import { entryName } from "@/lib/fiveETools";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

const LIBRARY_ARRAYS = [
  "spells",
  "monsters",
  "actions",
  "weapons",
  "armor",
  "wondrousItems",
  "vehicles",
  "siege",
  "adventuringGear",
  "trinkets",
  "explosives",
  "ammo",
  "poisons",
  "tradeGoods",
  "shop",
  "downtimeActions",
  "statusEffects",
  "rollTables",
  "lootTables",
  "lootPools",
  "encounterTables",
  "dungeonRooms",
];

const sourceOf = (entry) =>
  String(
    entry?.source ||
      entry?.classSource ||
      entry?.subclassSource ||
      entry?.bookSource ||
      entry?.monster?.source ||
      ""
  );

const categoryLabel = (key) =>
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());

const entryJson = (entry) => {
  const copy = { ...entry };
  Object.keys(copy).forEach((key) => {
    if (key.startsWith("__")) delete copy[key];
  });
  return JSON.stringify(copy);
};

// A maintenance view over every imported library list. Entries are grouped by
// exact name; the user can keep one version or remove individual copies. This
// is where 2014/2024 near-duplicates are resolved without touching classes.
export function DuplicatesTab() {
  const { settings, setSettings } = useTree();
  const library = settings?.library || {};

  const groups = useMemo(() => {
    const groups = new Map();
    const add = (sourceKey, index, entry, label) => {
      if (!entry || typeof entry !== "object" || !entryName(entry)) return;
      const name = String(entryName(entry)).trim();
      const key = name.toLowerCase();
      if (!groups.has(key)) groups.set(key, { key, name, entries: [] });
      groups.get(key).entries.push({
        sourceKey,
        index,
        entry,
        label,
        source: sourceOf(entry),
        json: entryJson(entry),
      });
    };
    Object.entries(library.fiveETools || {}).forEach(([cat, list]) => {
      if (!Array.isArray(list) || cat === "classes") return;
      list.forEach((entry, index) =>
        add(`raw:${cat}`, index, entry, `5eTools · ${categoryLabel(cat)}`)
      );
    });
    LIBRARY_ARRAYS.forEach((key) => {
      const list = library[key];
      if (!Array.isArray(list)) return;
      list.forEach((entry, index) =>
        add(key, index, entry, `Library · ${categoryLabel(key)}`)
      );
    });
    return [...groups.values()]
      .filter((group) => group.entries.length > 1)
      .map((group) => {
        const seen = new Set();
        return {
          ...group,
          entries: group.entries.map((item) => {
            const exact = seen.has(item.json);
            seen.add(item.json);
            return { ...item, exact };
          }),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [library]);

  const removeEntries = (targets) => {
    if (!targets.length) return;
    setSettings((s) => {
      const raw = { ...(s.library.fiveETools || {}) };
      const nextLibrary = { ...s.library };
      const bySource = new Map();
      targets.forEach(({ sourceKey, index }) => {
        if (!bySource.has(sourceKey)) bySource.set(sourceKey, []);
        bySource.get(sourceKey).push(index);
      });
      bySource.forEach((indices, sourceKey) => {
        const descending = [...indices].sort((a, b) => b - a);
        if (sourceKey.startsWith("raw:")) {
          const cat = sourceKey.slice(4);
          const list = Array.isArray(raw[cat]) ? [...raw[cat]] : [];
          descending.forEach((index) => {
            if (index >= 0 && index < list.length) list.splice(index, 1);
          });
          if (list.length) raw[cat] = list;
          else delete raw[cat];
        } else {
          const list = Array.isArray(nextLibrary[sourceKey])
            ? [...nextLibrary[sourceKey]]
            : [];
          descending.forEach((index) => {
            if (index >= 0 && index < list.length) list.splice(index, 1);
          });
          nextLibrary[sourceKey] = list;
        }
      });
      return {
        ...s,
        library: { ...nextLibrary, fiveETools: raw },
      };
    });
  };

  const keepOnly = (group, keep) => {
    const others = group.entries.filter(
      (item) => !(item.sourceKey === keep.sourceKey && item.index === keep.index)
    );
    if (!window.confirm(`Remove ${others.length} other version(s) of “${group.name}”?`)) return;
    removeEntries(others);
    toast.success(`Kept one version of “${group.name}”.`);
  };

  const removeOne = (group, item) => {
    if (!window.confirm(`Remove this version of “${group.name}”?`)) return;
    removeEntries([item]);
    toast.success(`Removed one version of “${group.name}”.`);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Entries with the same name are grouped here across every imported 5eTools
        category and library list. Keep the version you want, or remove individual
        copies. Classes are never removed automatically.
      </p>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {groups.length} duplicate name group{groups.length === 1 ? "" : "s"}
        </span>
        <span>
          {groups.reduce((sum, group) => sum + group.entries.length, 0)} entries
        </span>
      </div>
      {groups.length === 0 ? (
        <p className="rounded border border-dashed p-3 text-xs text-muted-foreground">
          No same-name duplicates found.
        </p>
      ) : (
        <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
          {groups.map((group) => (
            <div key={group.key} className="rounded-md border p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold">{group.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {group.entries.length} versions
                </span>
              </div>
              <div className="mt-1 space-y-1">
                {group.entries.map((item) => (
                  <div
                    key={`${item.sourceKey}:${item.index}`}
                    className="flex flex-wrap items-center gap-1 rounded border bg-muted/20 px-2 py-1 text-[10px]"
                  >
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {item.source || "—"}
                    </span>
                    {item.exact && (
                      <span className="rounded bg-amber-500/20 px-1 text-amber-700 dark:text-amber-300">
                        exact copy
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-1.5 text-[10px]"
                      onClick={() => keepOnly(group, item)}
                    >
                      Keep this
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-[10px] text-destructive"
                      onClick={() => removeOne(group, item)}
                      title="Remove this version"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
