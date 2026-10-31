import { useMemo, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { FIVE_CATEGORIES, entryName, entrySource } from "@/lib/fiveETools";
import { entryDetails, entryDetailsMarkdown } from "@/lib/fiveEToolsView";
import { ReferenceEntryPreview } from "./ReferenceEntryPreview";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// A dedicated Reference Library tab for one imported 5eTools category
// (backgrounds, species, deities, objects, traps). Entries keep their source
// material and use the same preview as the Reference Index.
export function FiveEToolsCategoryTab({ categoryId }) {
  const { settings, setSettings } = useTree();
  const data = settings?.library?.fiveETools?.[categoryId] || [];
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(null);
  const category = FIVE_CATEGORIES.find((c) => c.id === categoryId);
  const label = category?.label || categoryId;
  const shown = useMemo(
    () =>
      data.filter((entry) =>
        `${entryName(entry)} ${entrySource(entry)}`.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [data, query]
  );
  const details = useMemo(
    () => (preview ? entryDetails(categoryId, preview, null) : null),
    [categoryId, preview]
  );
  const dragPayload = (entry) => {
    const d = entryDetails(categoryId, entry, null);
    const image =
      typeof entry?.image === "string" && /^(data:|\/images\/|\/api\/|https?:)/i.test(entry.image)
        ? entry.image
        : "";
    return JSON.stringify({
      name: entryName(entry),
      flavor: `${label} · ${entrySource(entry)}`.trim(),
      description: entryDetailsMarkdown(d),
      image,
      category: categoryId,
    });
  };

  const remove = () => {
    if (!preview) return;
    setSettings((s) => {
      const map = { ...(s.library.fiveETools || {}) };
      const entries = (map[categoryId] || []).filter((e) => e !== preview);
      if (entries.length) map[categoryId] = entries;
      else delete map[categoryId];
      return { ...s, library: { ...s.library, fiveETools: map } };
    });
    setPreview(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {label} imported from 5eTools. The Reference Index can add more.
        </p>
        <Input
          className="h-8 w-44"
          placeholder={`Search ${label.toLowerCase()}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
          Nothing imported yet. Open <strong>Reference Index</strong>, choose the{" "}
          <strong>{label}</strong> category, and import entries.
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(280px,1.15fr)] gap-2">
          <div className="max-h-[55vh] overflow-y-auto rounded-md border p-1">
            {shown.map((entry, i) => (
              <button
                key={`${entryName(entry)}-${i}`}
                type="button"
                draggable
                onDragStart={(ev) => {
                  ev.dataTransfer.setData("application/x-5etools-entry", dragPayload(entry));
                  ev.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => setPreview(entry)}
                title="Click to read · drag onto the workspace to create a node"
                className={`flex w-full cursor-grab items-center gap-2 rounded px-1.5 py-1 text-left text-xs active:cursor-grabbing ${
                  preview === entry ? "bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{String(entryName(entry))}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {String(entrySource(entry))}
                </span>
              </button>
            ))}
            {shown.length === 0 && (
              <p className="p-2 text-xs text-muted-foreground">No matches.</p>
            )}
          </div>
          <div className="max-h-[55vh] overflow-y-auto rounded-md border p-3">
            {details ? (
              <div className="space-y-2">
                <ReferenceEntryPreview details={details} imageSrc={details.image} />
                <Button size="sm" variant="ghost" onClick={remove}>
                  <X className="mr-1 h-3.5 w-3.5" /> Remove from project
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Select an entry to read it.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
