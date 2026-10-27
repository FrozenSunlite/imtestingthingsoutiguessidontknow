import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { useLibList, ListHeader, EmptyNote } from "./shared";
import { matchesQuery } from "@/lib/textSearch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Dices, Plus, X } from "lucide-react";
import { InfoTip } from "@/components/skilltree/InfoTip";

// Loot tables: a table rolls between one or more subtables, and each subtable
// is filled with items from the library (weapons, armor, poisons, explosives,
// adventuring gear, ammunition, trinkets, wondrous items).
const LOOT_CATEGORIES = [
  ["weapons", "Weapons", (lib) => lib.weapons || []],
  ["armor", "Armor", (lib) => lib.armor || []],
  ["poisons", "Poisons", (lib) => lib.poisons || []],
  ["explosives", "Explosives", (lib) => lib.explosives || []],
  ["adventuringGear", "Adventuring Gear", (lib) => lib.adventuringGear || []],
  ["ammo", "Ammunition", (lib) => lib.ammo || []],
  ["trinkets", "Trinkets", (lib) => lib.trinkets || []],
  ["wondrousItems", "Wondrous Items", (lib) => lib.wondrousItems || []],
];
const catLabel = (key) => LOOT_CATEGORIES.find(([k]) => k === key)?.[1] || key;

export function LootTablesTab() {
  const t = useLibList("lootTables");
  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() => t.add({ name: "", subtables: [{ name: "Main", items: [] }] })}
        addLabel="Add loot table"
        query={t.query}
        setQuery={t.setQuery}
        searchPlaceholder="Search loot tables…"
      />
      <EmptyNote items={t.items} query={t.query} />
      {t.shown.map(({ e, i }) => (
        <LootTableEditor
          key={i}
          table={e}
          onChange={(next) => t.patch(i, next)}
          onDelete={() => t.remove(i)}
        />
      ))}
    </div>
  );
}

function LootTableEditor({ table, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const [roll, setRoll] = useState(null);
  const subtables = table.subtables || [];

  const doRoll = () => {
    const subs = subtables.filter((st) => (st.items || []).length > 0);
    if (!subs.length) return;
    const st = subs[Math.floor(Math.random() * subs.length)];
    const items = st.items.filter((it) => it?.name);
    const it = items[Math.floor(Math.random() * items.length)];
    setRoll({ subtable: st.name, ...it });
  };

  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setOpen(!open)}>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </button>
        <InfoTip label="Name of this loot table.">
          <Input
            className="h-8 flex-1"
            placeholder="Loot table name"
            value={table.name || ""}
            onChange={(e) => onChange({ ...table, name: e.target.value })}
          />
        </InfoTip>
        <Button size="sm" variant="outline" onClick={doRoll}>
          <Dices className="mr-1 h-4 w-4" /> Roll
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {roll && (
        <p className="mt-1 rounded bg-muted/50 px-2 py-1 text-xs">
          🎲 {roll.qty || 1}× {roll.name} <span className="text-muted-foreground">({catLabel(roll.category)}{roll.subtable ? ` · ${roll.subtable}` : ""})</span>
        </p>
      )}

      {open && (
        <div className="mt-2 space-y-2 border-t pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Subtables ({subtables.length})</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                onChange({
                  ...table,
                  subtables: [...subtables, { name: "", items: [] }],
                })
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add subtable
            </Button>
          </div>
          {subtables.map((st, si) => (
            <SubtableEditor
              key={si}
              subtable={st}
              onChange={(next) =>
                onChange({
                  ...table,
                  subtables: subtables.map((x, j) => (j === si ? next : x)),
                })
              }
              onDelete={() =>
                onChange({ ...table, subtables: subtables.filter((_, j) => j !== si) })
              }
            />
          ))}
          {subtables.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Add a subtable to fill the table with items.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SubtableEditor({ subtable, onChange, onDelete }) {
  const { settings } = useTree();
  const [cat, setCat] = useState(LOOT_CATEGORIES[0][0]);
  const [q, setQ] = useState("");
  const items = subtable.items || [];
  const def = LOOT_CATEGORIES.find(([k]) => k === cat) || LOOT_CATEGORIES[0];
  const candidates = def[2](settings?.library || {})
    .filter((e) => e?.name && matchesQuery(e.name, q))
    .slice(0, 30);

  return (
    <div className="space-y-1.5 rounded-md border bg-accent/20 p-2">
      <div className="flex items-center gap-1">
        <InfoTip label="Name of this subtable; a roll first picks one subtable, then one item in it.">
          <Input
            className="h-8 flex-1"
            placeholder="Subtable name"
            value={subtable.name || ""}
            onChange={(e) => onChange({ ...subtable, name: e.target.value })}
          />
        </InfoTip>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="h-8 w-36 shrink-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOOT_CATEGORIES.map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="h-8 flex-1"
          placeholder={`Search ${def[1].toLowerCase()}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="max-h-36 space-y-1 overflow-y-auto rounded border p-1">
        {candidates.length === 0 && (
          <p className="p-1 text-xs text-muted-foreground">Nothing in {def[1]} matches.</p>
        )}
        {candidates.map((entry, j) => (
          <div key={j} className="flex items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-accent">
            <span className="min-w-0 flex-1 truncate">{entry.name}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {String(entry.cost ?? "").trim() || "—"}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                onChange({
                  ...subtable,
                  items: [...items, { category: cat, name: entry.name, qty: 1 }],
                })
              }
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      {items.map((it, j) => (
        <div key={j} className="flex items-center gap-1 rounded px-1 py-0.5 text-xs">
          <span className="min-w-0 flex-1 truncate">
            {it.name} <span className="text-[10px] text-muted-foreground">({catLabel(it.category)})</span>
          </span>
          <InfoTip label="Quantity granted when this row is rolled.">
            <Input
              type="number"
              min={1}
              className="h-7 w-14"
              value={it.qty ?? 1}
              onChange={(e) => {
                const next = [...items];
                next[j] = { ...it, qty: Math.max(1, Number(e.target.value) || 1) };
                onChange({ ...subtable, items: next });
              }}
            />
          </InfoTip>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange({ ...subtable, items: items.filter((_, k) => k !== j) })}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">Import items above to fill the subtable.</p>
      )}
    </div>
  );
}