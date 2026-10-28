import { useMemo, useState } from "react";
import { useTree } from "@/lib/treeStore";
import {
  DIFFICULTIES,
  averageCount,
  encounterXp,
} from "@/lib/encounterXp";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Wand2 } from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString();
const tagPool = (monsters, tag) => {
  const needle = String(tag || "").toLowerCase();
  return (monsters || []).filter((m) =>
    [m.type, m.category, ...(m.tags || [])]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(needle))
  );
};

// Encounter XP checker for a four-player party. The level is derived from the
// highest-CR monster in the grouping, with the one-level-lower case shown too.
export function EncounterXpCalculator() {
  const { settings } = useTree();
  const monsters = (settings?.library?.monsters || []).filter((m) => m.name);
  const tables = settings?.library?.encounterTables || [];
  const [tableId, setTableId] = useState("");
  const [rows, setRows] = useState([]);
  const [note, setNote] = useState("");

  const result = useMemo(() => encounterXp(rows, monsters, { partySize: 4 }), [rows, monsters]);

  const addRow = () => {
    setRows((prev) => [...prev, { monster: monsters[0]?.name || "", count: "1" }]);
  };
  const patchRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const loadTable = (id) => {
    setTableId(id);
    const table = tables.find((t) => t.id === id);
    if (!table) return;
    const next = [];
    let tagRows = 0;
    (table.rows || []).forEach((row) => {
      if (row.monster) {
        const monster = monsters.find((m) => m.name === row.monster);
        if (monster) next.push({ monster: monster.name, count: String(averageCount(row.count)) });
      } else if (row.tag) {
        const pool = tagPool(monsters, row.tag);
        if (pool.length) {
          next.push({ monster: pool[0].name, count: String(averageCount(row.count)) });
          tagRows += 1;
        }
      }
    });
    setRows(next);
    setNote(
      tagRows
        ? `${tagRows} tag row${tagRows === 1 ? "" : "s"} used the first matching monster. Pick a specific monster if you want a different result.`
        : ""
    );
  };

  const clear = () => {
    setRows([]);
    setTableId("");
    setNote("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Label className="text-[10px] text-muted-foreground">Load an encounter table</Label>
          <Select value={tableId} onValueChange={loadTable}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Choose a table…" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table, i) => (
                <SelectItem key={table.id || `${table.name}-${i}`} value={table.id || table.name}>
                  {table.name || `Encounter table ${i + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={addRow}>
          <Plus className="mr-1 h-4 w-4" /> Add monster
        </Button>
        <Button size="sm" variant="ghost" onClick={clear} disabled={!rows.length}>
          Clear
        </Button>
      </div>

      {note && <p className="rounded bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground">{note}</p>}

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
          Add monsters or load a table. The calculator assumes a party of <strong>4</strong> and
          checks both the highest monster's CR level and one level below it.
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row, i) => {
            const item = result.items.find((x) => x.monster === row.monster && Number(x.count) === Number(row.count));
            return (
              <div key={i} className="flex items-center gap-1.5 rounded border p-1.5">
                <Select value={row.monster || ""} onValueChange={(v) => patchRow(i, { monster: v })}>
                  <SelectTrigger className="h-8 min-w-40 flex-1 text-xs">
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
                <Input
                  className="h-8 w-16 text-center text-xs"
                  value={row.count ?? "1"}
                  onChange={(e) => patchRow(i, { count: e.target.value })}
                  title="Count"
                />
                <span className="w-24 shrink-0 text-right text-[10px] text-muted-foreground">
                  {item ? `${fmt(item.xp)} XP each` : "—"}
                </span>
                <Button size="sm" variant="ghost" className="h-8 px-1" onClick={() => removeRow(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DIFFICULTIES.map((label, i) => {
              const active = result.levelDifficulty === label;
              return (
                <div
                  key={label}
                  className={`rounded-md border p-2 ${active ? "border-primary bg-primary/10" : ""}`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="font-mono text-sm font-semibold">
                    {fmt(result.levelThresholds[i])}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    at level {result.level}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border p-2 text-xs">
              <p className="font-medium">At CR level {result.level}</p>
              <p className="text-muted-foreground">
                Highest CR: {result.highestCR || "0"} · party of 4
              </p>
              <p className="mt-1">
                Base XP <span className="font-mono font-semibold">{fmt(result.baseXp)}</span> ·
                ×{result.multiplier} multiplier ·{" "}
                <span className="font-mono font-semibold">{fmt(result.adjustedXp)}</span> adjusted
              </p>
              <p className="mt-1">
                Difficulty:{" "}
                <span className="font-semibold">{result.levelDifficulty}</span>
              </p>
            </div>
            <div className="rounded-md border p-2 text-xs">
              <p className="font-medium">One level below ({result.lowerLevel})</p>
              <p className="text-muted-foreground">
                {result.totalCount} monster{result.totalCount === 1 ? "" : "s"} total
              </p>
              <p className="mt-1">
                Easy {fmt(result.lowerThresholds[0])} · Medium{" "}
                {fmt(result.lowerThresholds[1])} · Hard {fmt(result.lowerThresholds[2])} ·
                Deadly {fmt(result.lowerThresholds[3])}
              </p>
              <p className="mt-1">
                Difficulty:{" "}
                <span className="font-semibold">{result.lowerDifficulty}</span>
              </p>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Uses the 2014 DMG encounter multiplier for the total number of monsters. CR is read
            from the highest monster in the grouping. <Wand2 className="inline h-3 w-3" /> A
            tag-based table row is resolved to its first matching monster when loaded.
          </p>
        </>
      )}
    </div>
  );
}

