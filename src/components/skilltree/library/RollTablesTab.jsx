import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { toast } from "sonner";
import { useLibList, ListHeader, EmptyNote } from "./shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Dices, Plus, ShoppingCart, X } from "lucide-react";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { matchesQuery } from "@/lib/textSearch";
import { CATEGORIES, parseCost, describe } from "../ShopImportDialog";

// Rollable tables in the Reference Library. Each table holds rows imported
// from any library list the shop uses (weapons, gear, trinkets…), each with
// its own quantity. Rolling picks a random row; the result can be pushed
// straight into the shop's stock.
export function RollTablesTab() {
  const t = useLibList("rollTables");
  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() => t.add({ name: "", rows: [] })}
        addLabel="Add roll table"
        query={t.query}
        setQuery={t.setQuery}
        searchPlaceholder="Search tables…"
      />
      <EmptyNote items={t.items} query={t.query} />
      {t.shown.map(({ e, i }) => (
        <RollTableEditor
          key={i}
          table={e}
          onChange={(next) => t.patch(i, next)}
          onDelete={() => t.remove(i)}
        />
      ))}
    </div>
  );
}

function RollTableEditor({ table, onChange, onDelete }) {
  const { settings, setSettings } = useTree();
  const [open, setOpen] = useState(false);
  const [importCat, setImportCat] = useState(CATEGORIES[0][0]);
  const [importQ, setImportQ] = useState("");
  const [roll, setRoll] = useState(null);
  const rows = table.rows || [];
  const def = CATEGORIES.find(([key]) => key === importCat) || CATEGORIES[0];
  const candidates = def[2](settings?.library || {})
    .filter((e) => e?.name && matchesQuery(e.name, importQ))
    .slice(0, 30);

  const addItem = (entry) => {
    const { price, currency } = parseCost(entry);
    onChange({
      ...table,
      rows: [
        ...rows,
        {
          name: entry.name,
          category: def[1],
          price,
          currency,
          weight: Number(entry.weight) || 0,
          description: entry.description || describe(importCat, entry),
          qty: 1,
        },
      ],
    });
  };

  const doRoll = () => {
    if (!rows.length) return;
    setRoll(rows[Math.floor(Math.random() * rows.length)]);
  };

  // Push the rolled row into the shop's stock, quantity included.
  const addToShop = (row) => {
    setSettings((s) => ({
      ...s,
      library: {
        ...s.library,
        shop: [
          ...(s.library?.shop || []),
          {
            name: row.name,
            category: row.category,
            price: row.price,
            currency: row.currency,
            weight: row.weight,
            description: row.description,
            qty: row.qty || 1,
          },
        ],
      },
    }));
    toast(`Added ${row.qty || 1}× ${row.name} to the shop.`);
  };

  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setOpen(!open)}>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </button>
        <InfoTip label="Name of this rollable table.">
          <Input
            className="h-8 flex-1"
            placeholder="Table name"
            value={table.name || ""}
            onChange={(e) => onChange({ ...table, name: e.target.value })}
          />
        </InfoTip>
        <Button size="sm" variant="outline" onClick={doRoll} disabled={!rows.length}>
          <Dices className="mr-1 h-4 w-4" /> Roll
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {roll && (
        <div className="mt-1 flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1 text-xs">
          <span>
            🎲 {roll.qty || 1}× {roll.name}
          </span>
          <Button size="sm" variant="ghost" onClick={() => addToShop(roll)}>
            <ShoppingCart className="mr-1 h-3.5 w-3.5" /> Add to shop
          </Button>
        </div>
      )}

      {open && (
        <div className="mt-2 space-y-2 border-t pt-2">
          <p className="text-xs font-medium">Rows ({rows.length})</p>
          <div className="flex items-center gap-1">
            <Select value={importCat} onValueChange={setImportCat}>
              <SelectTrigger className="h-8 w-36 shrink-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="h-8 flex-1"
              placeholder={`Search ${def[1].toLowerCase()}…`}
              value={importQ}
              onChange={(e) => setImportQ(e.target.value)}
            />
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded border p-1">
            {candidates.length === 0 && (
              <p className="p-1 text-xs text-muted-foreground">
                Nothing in {def[1]} matches.
              </p>
            )}
            {candidates.map((entry, j) => (
              <div key={j} className="flex items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-accent">
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {String(entry.cost ?? "").trim() || "—"}
                </span>
                <Button size="sm" variant="ghost" onClick={() => addItem(entry)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          {rows.map((row, j) => (
            <div key={j} className="flex items-center gap-1 rounded px-1 py-0.5 text-xs">
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              <InfoTip label="Quantity shown when this row is rolled or added to the shop.">
                <Input
                  type="number"
                  min={1}
                  className="h-7 w-14"
                  value={row.qty ?? 1}
                  onChange={(e) => {
                    const next = [...rows];
                    next[j] = { ...row, qty: Math.max(1, Number(e.target.value) || 1) };
                    onChange({ ...table, rows: next });
                  }}
                />
              </InfoTip>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange({ ...table, rows: rows.filter((_, k) => k !== j) })}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Import items above to fill the table.
            </p>
          )}
        </div>
      )}
    </div>
  );
}