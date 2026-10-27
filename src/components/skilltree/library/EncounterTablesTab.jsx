import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { useLibList, ListHeader, EmptyNote } from "./shared";
import { rollEncounter } from "@/lib/dmLoot";
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

// Random encounter tables: each row is a library monster with a count that
// may be dice ("1d6"). Rolling resolves every row's count; the DM Screen's
// Encounters & Loot tab rolls these and drops the monsters into the tracker.
export function EncounterTablesTab() {
  const t = useLibList("encounterTables");
  const { settings } = useTree();
  const monsters = (settings?.library?.monsters || []).filter((m) => m.name);

  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() => t.add({ name: "", rows: [] })}
        addLabel="Add encounter table"
        query={t.query}
        setQuery={t.setQuery}
        searchPlaceholder="Search encounter tables…"
      />
      <EmptyNote items={t.items} query={t.query} />
      {t.shown.map(({ e, i }) => (
        <EncounterTableEditor
          key={i}
          table={e}
          monsters={monsters}
          onChange={(next) => t.patch(i, next)}
          onDelete={() => t.remove(i)}
        />
      ))}
      <p className="text-[10px] text-muted-foreground">
        Counts can be dice expressions — rolling an encounter decides how many of each monster
        appears.
      </p>
    </div>
  );
}

function EncounterTableEditor({ table, monsters, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const rows = table.rows || [];

  const doRoll = () => setResult(rollEncounter(table));

  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setOpen(!open)}>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </button>
        <InfoTip label="Name of this encounter table.">
          <Input
            className="h-8 flex-1"
            placeholder="Encounter table name"
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

      {result && (
        <p className="mt-1 rounded bg-muted/50 px-2 py-1 text-xs">
          {result.length === 0 ? (
            <span className="text-muted-foreground">Nothing spawned.</span>
          ) : (
            <>🎲 {result.map((r) => `${r.count}× ${r.monster}`).join(", ")}</>
          )}
        </p>
      )}

      {open && (
        <div className="mt-2 space-y-2 border-t pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Rows ({rows.length})</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange({ ...table, rows: [...rows, { monster: "", count: "1" }] })}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add row
            </Button>
          </div>
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-1 rounded border bg-accent/20 p-1.5">
              <Select
                value={row.monster || ""}
                onValueChange={(v) =>
                  onChange({ ...table, rows: rows.map((r, j) => (j === i ? { ...r, monster: v } : r)) })
                }
              >
                <SelectTrigger className="h-7 min-w-36 flex-1 text-xs">
                  <SelectValue placeholder="Monster…" />
                </SelectTrigger>
                <SelectContent>
                  {monsters.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.name}
                      {m.cr ? ` (CR ${m.cr})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <InfoTip label="How many appear — a number or dice like 1d6.">
                <Input
                  className="h-7 w-16 text-center"
                  value={row.count ?? "1"}
                  onChange={(e) =>
                    onChange({
                      ...table,
                      rows: rows.map((r, j) => (j === i ? { ...r, count: e.target.value } : r)),
                    })
                  }
                />
              </InfoTip>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange({ ...table, rows: rows.filter((_, j) => j !== i) })}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Add rows of monsters to fill the table.
            </p>
          )}
        </div>
      )}
    </div>
  );
}