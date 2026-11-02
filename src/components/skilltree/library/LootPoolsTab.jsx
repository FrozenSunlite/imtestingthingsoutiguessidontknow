import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTree } from "@/lib/treeStore";
import { useLibList, EmptyNote } from "./shared";
import { LOOT_CATEGORIES, rollLootPool } from "@/lib/dmLoot";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Dices, Download, Plus, Upload, X } from "lucide-react";
import { InfoTip } from "@/components/skilltree/InfoTip";

// Loot pools: recursive rollable tables. An entry is a library item, a free
// text result (e.g. "50 gp") or a reference to another pool — rolled a
// quantity of times (dice like 1d6 allowed), resolving all the way down.
// Pools can be exported to and imported from a JSON file, and assigned to
// monsters in the Monsters tab.
export function LootPoolsTab() {
  const t = useLibList("lootPools");
  const fileRef = useRef(null);

  const exportPools = () => {
    const blob = new Blob([JSON.stringify(t.items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "loot-pools.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importPools = (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!Array.isArray(data)) throw new Error("not a list");
        const valid = data.filter((p) => p?.name);
        let added = 0;
        let replaced = 0;
        const next = [...t.items];
        valid.forEach((p) => {
          const idx = next.findIndex((x) => x.name === p.name);
          if (idx >= 0) {
            next[idx] = p;
            replaced++;
          } else {
            next.push(p);
            added++;
          }
        });
        t.setItems(next);
        toast(`Imported loot pools — ${added} added, ${replaced} replaced.`);
      } catch {
        toast("Could not read that file — expected a loot pools JSON export.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="outline" onClick={() => t.add({ name: "", entries: [] })}>
          <Plus className="mr-1 h-4 w-4" /> Add loot pool
        </Button>
        <div className="flex items-center gap-1.5">
          <InfoTip label="Filter this list by name.">
            <Input
              className="h-8 w-40"
              placeholder="Search loot pools…"
              value={t.query}
              onChange={(e) => t.setQuery(e.target.value)}
            />
          </InfoTip>
          <Button size="sm" variant="outline" onClick={exportPools}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" /> Import
          </Button>
          <input
            ref={(el) => (fileRef.current = el)}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={importPools}
          />
        </div>
      </div>
      <EmptyNote items={t.items} query={t.query} />
      {t.shown.map(({ e, i }) => (
        <PoolEditor
          key={i}
          pool={e}
          pools={t.items}
          onChange={(next) => t.patch(i, next)}
          onDelete={() => t.remove(i)}
        />
      ))}
      <p className="text-[10px] text-muted-foreground">
        Entries can point at other loot pools — a roll recurses down until every branch decides
        loot. Assign pools to monsters in the Monsters tab.
      </p>
    </div>
  );
}

function PoolEditor({ pool, pools, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const entries = pool.entries || [];

  const doRoll = () => setResult(rollLootPool(pool.name, pools));

  return (
    <div className="rounded-md border p-2" data-entry-name={pool.name ? String(pool.name) : ""}>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setOpen(!open)}>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </button>
        <InfoTip label="Name of this loot pool; other pools reference it by name.">
          <Input
            className="h-8 flex-1"
            placeholder="Loot pool name"
            value={pool.name || ""}
            onChange={(e) => onChange({ ...pool, name: e.target.value })}
          />
        </InfoTip>
        <Button size="sm" variant="outline" onClick={doRoll}>
          <Dices className="mr-1 h-4 w-4" /> Roll
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {result && (
        <div className="mt-1 rounded bg-muted/50 px-2 py-1 text-xs">
          {result.error ? (
            <span className="text-destructive">{result.error}</span>
          ) : result.lines.length === 0 ? (
            <span className="text-muted-foreground">Nothing rolled.</span>
          ) : (
            result.lines.map((l, i) => (
              <p key={i}>
                🎲 {l.qty}× {l.name}
                {l.category ? ` (${l.category})` : ""}
                {l.via.length > 1 && (
                  <span className="text-muted-foreground"> · via {l.via.join(" → ")}</span>
                )}
              </p>
            ))
          )}
        </div>
      )}

      {open && (
        <div className="mt-2 space-y-2 border-t pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Entries ({entries.length})</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                onChange({ ...pool, entries: [...entries, { kind: "item", category: "weapons", name: "", qty: 1 }] })
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add entry
            </Button>
          </div>
          {entries.map((entry, i) => (
            <EntryEditor
              key={i}
              entry={entry}
              pools={pools}
              selfName={pool.name}
              onChange={(next) =>
                onChange({ ...pool, entries: entries.map((x, j) => (j === i ? next : x)) })
              }
              onDelete={() => onChange({ ...pool, entries: entries.filter((_, j) => j !== i) })}
            />
          ))}
          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Add entries to fill the pool — items, free text or other pools.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function EntryEditor({ entry, pools, selfName, onChange, onDelete }) {
  const { settings } = useTree();
  const kind = entry.kind || "item";
  const def = LOOT_CATEGORIES.find(([k]) => k === entry.category) || LOOT_CATEGORIES[0];
  const items = def[2](settings?.library || {}).filter((i) => i?.name);

  return (
    <div className="flex flex-wrap items-center gap-1 rounded border bg-accent/20 p-1.5">
      <Select
        value={kind}
        onValueChange={(v) =>
          onChange({ ...entry, kind: v, category: v === "item" ? entry.category || "weapons" : undefined })
        }
      >
        <SelectTrigger className="h-7 w-28 shrink-0 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="item">Item</SelectItem>
          <SelectItem value="table">Another pool</SelectItem>
          <SelectItem value="text">Free text</SelectItem>
        </SelectContent>
      </Select>
      {kind === "table" ? (
        <Select value={entry.name || ""} onValueChange={(v) => onChange({ ...entry, name: v })}>
          <SelectTrigger className="h-7 min-w-32 flex-1 text-xs">
            <SelectValue placeholder="Pool…" />
          </SelectTrigger>
          <SelectContent>
            {pools
              .filter((p) => p.name && p.name !== selfName)
              .map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      ) : kind === "text" ? (
        <Input
          className="h-7 min-w-32 flex-1"
          placeholder="e.g. 50 gp"
          value={entry.name || ""}
          onChange={(e) => onChange({ ...entry, name: e.target.value })}
        />
      ) : (
        <>
          <Select
            value={entry.category || "weapons"}
            onValueChange={(v) => onChange({ ...entry, category: v, name: "" })}
          >
            <SelectTrigger className="h-7 w-28 shrink-0 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LOOT_CATEGORIES.map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entry.name || ""} onValueChange={(v) => onChange({ ...entry, name: v })}>
            <SelectTrigger className="h-7 min-w-32 flex-1 text-xs">
              <SelectValue placeholder="Item…" />
            </SelectTrigger>
            <SelectContent>
              {items.slice(0, 100).map((i) => (
                <SelectItem key={i.name} value={i.name}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
      <InfoTip label="Quantity — a number or dice like 1d6+2. For another pool, how many times it is rolled.">
        <Input
          className="h-7 w-16 text-center"
          value={entry.qty ?? 1}
          onChange={(e) => onChange({ ...entry, qty: e.target.value })}
        />
      </InfoTip>
      <Button size="sm" variant="ghost" onClick={onDelete}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}