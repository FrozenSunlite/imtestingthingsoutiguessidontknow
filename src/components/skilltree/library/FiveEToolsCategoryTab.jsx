import { useMemo, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { FIVE_CATEGORIES, entryName, entrySource, fiveText } from "@/lib/fiveETools";
import {
  abilityText,
  entryDetails,
  entryDetailsMarkdown,
  featsText,
  proficiencyText,
  sizeText,
  speedText,
  startingEquipmentText,
} from "@/lib/fiveEToolsView";
import { ReferenceEntryPreview } from "./ReferenceEntryPreview";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Save, X } from "lucide-react";

// Editable fields for the Lore & Creatures categories. Values are stored on
// the raw 5eTools entry, and the preview formatters below understand both the
// original structured shapes and the plain text written back from this form.
const ENTRY_FIELDS = {
  backgrounds: [
    ["ability", "Ability Scores", "ability"],
    ["feats", "Feat", "text"],
    ["skillProficiencies", "Skill Proficiencies", "text"],
    ["toolProficiencies", "Tool Proficiencies", "text"],
    ["languageProficiencies", "Languages", "text"],
    ["startingEquipment", "Starting Equipment", "textarea"],
  ],
  species: [
    ["size", "Size", "text"],
    ["speed", "Speed", "text"],
    ["ability", "Ability Scores", "ability"],
    ["languageProficiencies", "Languages", "text"],
  ],
  deities: [
    ["pantheon", "Pantheon", "text"],
    ["alignment", "Alignment", "text"],
    ["category", "Category", "text"],
    ["domains", "Domains", "text"],
    ["province", "Province", "text"],
    ["symbol", "Symbol", "text"],
  ],
  objects: [
    ["objectType", "Type", "text"],
    ["size", "Size", "text"],
    ["ac", "Armor Class", "text"],
    ["hp", "Hit Points", "text"],
    ["speed", "Speed", "text"],
    ["str", "STR", "number"],
    ["dex", "DEX", "number"],
    ["con", "CON", "number"],
    ["int", "INT", "number"],
    ["wis", "WIS", "number"],
    ["cha", "CHA", "number"],
    ["senses", "Senses", "text"],
    ["immune", "Immunities", "text"],
  ],
  traps: [
    ["trapHazType", "Type", "text"],
    ["rating", "Rating", "text"],
  ],
};

const textValue = (value) => {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : fiveText(item)))
      .filter(Boolean)
      .join(", ");
  }
  return fiveText(value);
};

const fieldValue = (entry, [key, , kind]) => {
  if (kind === "ability") return abilityText(entry?.[key]);
  if (key === "feats") return featsText(entry?.[key]);
  if (key === "startingEquipment") return startingEquipmentText(entry?.[key]);
  if (key === "size") return sizeText(entry?.[key]);
  if (key === "speed") return speedText(entry?.[key]);
  if (key.endsWith("Proficiencies")) return proficiencyText(entry?.[key]);
  if (kind === "number") return entry?.[key] ?? "";
  return textValue(entry?.[key]);
};

// Turn the friendly ability text back into 5eTools' structured shape. Anything
// that is not a recognisable ability is kept as text for the preview.
const normalizeAbility = (value) => {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text || /^any$/i.test(text)) return undefined;
  return text
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const parsed = part.match(
        /^(str|dex|con|int|wis|cha|strength|dexterity|constitution|intelligence|wisdom|charisma)\s*([+-]\s*\d+)?$/i
      );
      if (!parsed) return part;
      const key = parsed[1].slice(0, 3).toLowerCase();
      const bonus = parsed[2] ? Number(parsed[2].replace(/\s+/g, "")) : null;
      return bonus != null ? { [key]: bonus } : key;
    });
};

// A dedicated Reference Library tab for one imported 5eTools category
// (backgrounds, species, deities, objects, traps). Entries keep their source
// material and use the same preview as the Reference Index, and every field
// shown here can be edited or extended.
export function FiveEToolsCategoryTab({ categoryId }) {
  const { settings, setSettings } = useTree();
  const data = settings?.library?.fiveETools?.[categoryId] || [];
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(-1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [showJson, setShowJson] = useState(false);
  const category = FIVE_CATEGORIES.find((c) => c.id === categoryId);
  const label =
    category?.label ||
    categoryId
      .replace(/([A-Z])/g, " $1")
      .replace(/[-_]+/g, " ")
      .replace(/^./, (char) => char.toUpperCase());
  const fields = ENTRY_FIELDS[categoryId] || [];
  const shown = useMemo(
    () =>
      data
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) =>
          `${entryName(entry)} ${entrySource(entry)}`
            .toLowerCase()
            .includes(query.trim().toLowerCase())
        ),
    [data, query]
  );
  const details = useMemo(
    () => (preview ? entryDetails(categoryId, preview, null) : null),
    [categoryId, preview]
  );
  const dragPayload = (entry) => {
    const d = entryDetails(categoryId, entry, null);
    const rawImage = entry?.image || entry?.img;
    const image =
      typeof rawImage === "string" && /^(data:|\/images\/|\/api\/|https?:)/i.test(rawImage)
        ? rawImage
        : "";
    return JSON.stringify({
      name: entryName(entry),
      flavor: `${label} · ${entrySource(entry)}`.trim(),
      description: entryDetailsMarkdown(d),
      image,
      category: categoryId,
    });
  };

  const writeEntries = (entries) =>
    setSettings((s) => {
      const map = { ...(s.library.fiveETools || {}) };
      if (entries.length) map[categoryId] = entries;
      else delete map[categoryId];
      return { ...s, library: { ...s.library, fiveETools: map } };
    });

  const select = (entry, index) => {
    setPreview(entry);
    setPreviewIndex(index);
    setEditing(false);
    setDraft(null);
    setIsNew(false);
    setJsonText("");
    setJsonError("");
  };

  const addEntry = () => {
    const blank = {
      name: `New ${label}`,
      source: "Homebrew",
      entries: "",
    };
    writeEntries([...data, blank]);
    select(blank, data.length);
    setDraft(blank);
    setJsonText(JSON.stringify(blank, null, 2));
    setJsonError("");
    setIsNew(true);
    setEditing(true);
    setQuery("");
  };

  const startEdit = () => {
    if (!preview) return;
    const copy = JSON.parse(JSON.stringify(preview));
    setDraft(copy);
    setJsonText(JSON.stringify(copy, null, 2));
    setJsonError("");
    setShowJson(fields.length === 0);
    setEditing(true);
  };

  const cancelEdit = () => {
    // A brand-new entry that is cancelled never touched the library.
    if (isNew && previewIndex >= 0) {
      writeEntries(data.filter((_, i) => i !== previewIndex));
      setPreview(null);
      setPreviewIndex(-1);
    }
    setIsNew(false);
    setEditing(false);
    setDraft(null);
    setJsonText("");
    setJsonError("");
  };

  const patchDraft = (patch) => {
    if (!draft) return;
    const next = { ...draft, ...patch };
    setDraft(next);
    setJsonText(JSON.stringify(next, null, 2));
    setJsonError("");
  };

  const saveDraft = () => {
    if (!draft || previewIndex < 0) return;
    let next = { ...draft };
    if (jsonText.trim()) {
      try {
        const parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("The entry must be a JSON object.");
        }
        next = parsed;
      } catch (error) {
        setJsonError(`Could not save the JSON: ${error?.message || error}`);
        return;
      }
    }
    if (typeof next.ability === "string") {
      const ability = normalizeAbility(next.ability);
      if (ability === undefined) delete next.ability;
      else next.ability = ability;
    }
    const entries = [...data];
    entries[previewIndex] = next;
    writeEntries(entries);
    setPreview(next);
    setIsNew(false);
    setEditing(false);
    setDraft(null);
    setJsonText("");
    setJsonError("");
  };

  const remove = () => {
    const index = previewIndex >= 0 ? previewIndex : data.indexOf(preview);
    if (index < 0) return;
    writeEntries(data.filter((_, i) => i !== index));
    setPreview(null);
    setPreviewIndex(-1);
    setIsNew(false);
    setEditing(false);
    setDraft(null);
    setJsonText("");
    setJsonError("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {label} imported from 5eTools. Every entry can be edited or extended.
        </p>
        <div className="flex items-center gap-2">
          <Input
            className="h-8 w-44"
            placeholder={`Search ${label.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button size="sm" variant="outline" onClick={addEntry}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
          Nothing imported yet. Open <strong>Reference Index</strong>, choose the{" "}
          <strong>{label}</strong> category, and import entries — or add one here.
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(280px,1.15fr)] gap-2">
          <div className="max-h-[55vh] overflow-y-auto rounded-md border p-1">
            {shown.map(({ entry, index }) => (
              <button
                key={`${entryName(entry)}-${index}`}
                type="button"
                draggable
                onDragStart={(ev) => {
                  ev.dataTransfer.setData("application/x-5etools-entry", dragPayload(entry));
                  ev.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => select(entry, index)}
                title="Click to read or edit · drag onto the workspace to create a node"
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
            {editing && draft ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="space-y-1">
                    <span className="text-[10px] font-medium text-muted-foreground">Name</span>
                    <Input
                      className="h-8"
                      value={draft.name || ""}
                      placeholder="Entry name"
                      onChange={(e) => patchDraft({ name: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-medium text-muted-foreground">Source</span>
                    <Input
                      className="h-8"
                      value={draft.source || ""}
                      placeholder="e.g. Homebrew"
                      onChange={(e) => patchDraft({ source: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-medium text-muted-foreground">Page</span>
                    <Input
                      className="h-8"
                      type="number"
                      value={draft.page ?? ""}
                      placeholder="Page"
                      onChange={(e) =>
                        patchDraft({
                          page: e.target.value === "" ? undefined : Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-medium text-muted-foreground">Image URL</span>
                    <Input
                      className="h-8"
                      value={draft.img || draft.image || ""}
                      placeholder="https://… or /images/…"
                      onChange={(e) =>
                        patchDraft({ img: e.target.value, image: e.target.value })
                      }
                    />
                  </label>
                </div>
                {fields.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {fields.map((field) => {
                      const [key, fieldLabel, kind] = field;
                      return (
                        <label key={key} className="space-y-1">
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {fieldLabel}
                          </span>
                          {kind === "textarea" ? (
                            <Textarea
                              className="min-h-14 text-xs"
                              rows={2}
                              value={fieldValue(draft, field)}
                              onChange={(e) => patchDraft({ [key]: e.target.value })}
                            />
                          ) : (
                            <Input
                              className="h-8"
                              type={kind === "number" ? "number" : "text"}
                              value={fieldValue(draft, field)}
                              onChange={(e) => {
                                if (kind === "number") {
                                  patchDraft({
                                    [key]:
                                      e.target.value === ""
                                        ? undefined
                                        : Number(e.target.value) || 0,
                                  });
                                } else {
                                  patchDraft({ [key]: e.target.value });
                                }
                              }}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
                <label className="block space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Description
                  </span>
                  <Textarea
                    className="min-h-32 text-xs"
                    rows={6}
                    value={textValue(draft.entries)}
                    placeholder="Description, traits and rules text"
                    onChange={(e) => patchDraft({ entries: e.target.value })}
                  />
                </label>
                <div className="rounded-md border bg-muted/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      All entry data (JSON)
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px]"
                      onClick={() => setShowJson((value) => !value)}
                    >
                      {showJson ? "Hide" : "Show"}
                    </Button>
                  </div>
                  {(showJson || fields.length === 0) && (
                    <Textarea
                      className="mt-1 min-h-40 font-mono text-[10px] leading-tight"
                      rows={10}
                      value={jsonText}
                      onChange={(event) => {
                        setJsonText(event.target.value);
                        setJsonError("");
                      }}
                    />
                  )}
                  {jsonError && (
                    <p className="mt-1 text-[10px] text-destructive">{jsonError}</p>
                  )}
                  <p className="mt-1 text-[9px] text-muted-foreground">
                    Every imported field is preserved here. Edit the JSON directly to change
                    fields not shown above, then save.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveDraft}>
                    <Save className="mr-1 h-3.5 w-3.5" /> Save entry
                  </Button>
                </div>
              </div>
            ) : details ? (
              <div className="space-y-2">
                <ReferenceEntryPreview details={details} imageSrc={details.image} />
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={startEdit}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={remove}>
                    <X className="mr-1 h-3.5 w-3.5" /> Remove from project
                  </Button>
                </div>
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
