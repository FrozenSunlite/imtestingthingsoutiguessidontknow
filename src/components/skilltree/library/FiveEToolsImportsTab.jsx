import { useMemo, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { FIVE_CATEGORIES, entryName, entrySource } from "@/lib/fiveETools";
import { entryDetails, entryDetailsMarkdown } from "@/lib/fiveEToolsView";
import { ReferenceEntryPreview } from "./ReferenceEntryPreview";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Database, X } from "lucide-react";

// Browse raw entries imported from 5eTools categories that don't map onto a
// dedicated Reference Library tab. The entries stay editable/removable here,
// and their source material is rendered with the same preview as the index.
export function FiveEToolsImportsTab() {
  const { settings, setSettings } = useTree();
  const data = settings?.library?.fiveETools || {};
  const dedicated = new Set(["backgrounds", "species", "deities", "objects", "traps", "books"]);
  // "This Is Your Life" tables are not importable, so don't surface a dead
  // category if an older project still carries one.
  const retired = new Set(["life"]);
  const categories = Object.keys(data).filter(
    (k) => !dedicated.has(k) && !retired.has(k) && Array.isArray(data[k]) && data[k].length
  );
  const labelFor = (id) => FIVE_CATEGORIES.find((c) => c.id === id)?.label || id;
  const [category, setCategory] = useState(categories[0] || "");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(null);
  const [sourceShortcut, setSourceShortcut] = useState("");
  const active = categories.includes(category) ? category : categories[0] || "";
  const list = data[active] || [];
  const shown = useMemo(
    () =>
      list.filter((e) =>
        `${entryName(e)} ${entrySource(e)}`.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [list, query]
  );
  const details = useMemo(
    () => (preview ? entryDetails(active, preview, null) : null),
    [active, preview]
  );

  // Payload for dragging an entry onto the workspace canvas. The full preview
  // text (fields, sections and tables) becomes the new node's description.
  const dragPayload = (entry) => {
    const d = entryDetails(active, entry, null);
    const image =
      typeof entry?.image === "string" && /^(data:|\/images\/|\/api\/|https?:)/i.test(entry.image)
        ? entry.image
        : "";
    return JSON.stringify({
      name: entryName(entry),
      flavor: `${labelFor(active)} · ${entrySource(entry)}`.trim(),
      description: entryDetailsMarkdown(d),
      image,
      category: active,
    });
  };

  const openSourceImporter = () => {
    window.__tttPendingSourceImport = sourceShortcut.trim();
    window.dispatchEvent(new Event("skilltree:open-reference-index"));
  };

  const sourceShortcutRow = (
    <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/20 p-2">
      <span className="text-xs font-semibold">Import by source</span>
      <Input
        className="h-7 w-40 text-xs"
        value={sourceShortcut}
        placeholder="Source code, e.g. XPHB"
        onChange={(event) => setSourceShortcut(event.target.value.toUpperCase())}
      />
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openSourceImporter}>
        <Database className="mr-1 h-3.5 w-3.5" /> Open source importer
      </Button>
      <span className="text-[10px] text-muted-foreground">
        Opens the Reference Index with this source ready to import across a category or all files.
      </span>
    </div>
  );

  if (!categories.length) {
    return (
      <div className="space-y-2">
        {sourceShortcutRow}
        <p className="text-xs text-muted-foreground">
          Nothing imported yet. Categories that don't have a dedicated library tab (backgrounds,
          species, deities, books, objects, traps and so on) are kept here by the Reference Index.
        </p>
      </div>
    );
  }

  const remove = () => {
    if (!preview) return;
    setSettings((s) => {
      const map = { ...(s.library.fiveETools || {}) };
      const entries = (map[active] || []).filter((e) => e !== preview);
      if (entries.length) map[active] = entries;
      else delete map[active];
      return { ...s, library: { ...s.library, fiveETools: map } };
    });
    setPreview(null);
  };

  return (
    <div className="space-y-2">
      {sourceShortcutRow}
      <div className="flex flex-wrap items-center gap-1">
        {categories.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={c === active ? "secondary" : "ghost"}
            className="h-7 text-xs"
            onClick={() => {
              setCategory(c);
              setPreview(null);
            }}
          >
            {labelFor(c)}
          </Button>
        ))}
        <Input
          className="ml-auto h-7 w-40 text-xs"
          placeholder="Filter entries…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        Drag an entry onto the workspace to create a node with its full stat block and text in the
        description.
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(260px,1.1fr)] gap-2 max-md:grid-cols-1">
        <div className="max-h-[55vh] overflow-y-auto rounded-md border p-1">
          {shown.map((e, i) => (
            <button
              key={`${entryName(e)}-${i}`}
              type="button"
              draggable
              onDragStart={(ev) => {
                ev.dataTransfer.setData("application/x-5etools-entry", dragPayload(e));
                ev.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => setPreview(e)}
              title="Click to preview · drag onto the workspace to create a node"
              className={`flex w-full cursor-grab items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] active:cursor-grabbing ${
                preview === e ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{String(entryName(e))}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">{String(entrySource(e))}</span>
            </button>
          ))}
          {shown.length === 0 && (
            <p className="p-2 text-xs text-muted-foreground">No matches.</p>
          )}
        </div>
        <div className="max-h-[55vh] overflow-y-auto rounded-md border p-2">
          {details ? (
            <div className="space-y-2">
              <ReferenceEntryPreview details={details} />
              <Button size="sm" variant="ghost" onClick={remove}>
                <X className="mr-1 h-3.5 w-3.5" /> Remove from project
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Select an entry to read it.</p>
          )}
        </div>
      </div>
    </div>
  );
}
