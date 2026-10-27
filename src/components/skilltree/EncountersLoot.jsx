import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dices } from "lucide-react";
import { rollLootPool, rollEncounter } from "@/lib/dmLoot";

// The DM Screen's Encounters & Loot tab: rolls an encounter table (monsters
// drop straight into the combat tracker) and rolls loot — from a monster's
// assigned pools or any pool directly — resolving recursively.
export function EncountersLoot({ monsters, pools, encounterTables, onEncounter }) {
  const [tableId, setTableId] = useState("");
  const [encResult, setEncResult] = useState(null);
  const [lootMonster, setLootMonster] = useState("");
  const [lootResult, setLootResult] = useState(null);
  const [poolId, setPoolId] = useState("");
  const [poolResult, setPoolResult] = useState(null);

  const rollEnc = () => {
    const t = encounterTables.find((x) => x.name === tableId);
    if (!t) return;
    const spawned = rollEncounter(t, monsters);
    setEncResult({ table: t.name, spawned });
    if (spawned.length) onEncounter(spawned, t.name);
  };

  const rollMonsterLoot = () => {
    const m = monsters.find((x) => x.name === lootMonster);
    if (!m) return;
    const names = m.lootPools || [];
    const lines = [];
    const errors = [];
    names.forEach((n) => {
      const r = rollLootPool(n, pools);
      lines.push(...r.lines);
      if (r.error) errors.push(r.error);
    });
    setLootResult({ monster: m.name, pools: names, lines, errors });
  };

  const rollPool = () => {
    if (!poolId) return;
    setPoolResult(rollLootPool(poolId, pools));
  };

  return (
    <div className="space-y-3">
      <section className="rounded-lg border p-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Random Encounters
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Select value={tableId} onValueChange={setTableId}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder="Pick an encounter table…" />
            </SelectTrigger>
            <SelectContent>
              {encounterTables.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No encounter tables in the reference library yet.
                </p>
              )}
              {encounterTables.map((t) => (
                <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8" disabled={!tableId} onClick={rollEnc}>
            <Dices className="mr-1 h-4 w-4" /> Roll encounter
          </Button>
        </div>
        {encResult && (
          <p className="mt-1.5 text-xs">
            {encResult.spawned.length === 0 ? (
              <span className="text-muted-foreground">Nothing spawned.</span>
            ) : (
              <>
                🎲 {encResult.spawned.map((r) => `${r.count}× ${r.monster}`).join(", ")}
                <span className="text-muted-foreground"> — added to the combat tracker.</span>
              </>
            )}
          </p>
        )}
      </section>

      <section className="rounded-lg border p-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Monster Loot
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Select value={lootMonster} onValueChange={setLootMonster}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder="Pick a monster…" />
            </SelectTrigger>
            <SelectContent>
              {monsters.map((m) => (
                <SelectItem key={m.name} value={m.name}>
                  {m.name}
                  {(m.lootPools || []).length ? ` (${m.lootPools.length} pools)` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8" disabled={!lootMonster} onClick={rollMonsterLoot}>
            <Dices className="mr-1 h-4 w-4" /> Roll loot
          </Button>
        </div>
        {lootResult && <LootLines result={lootResult} emptyNote={`${lootResult.monster} has no loot pools assigned.`} />}
      </section>

      <section className="rounded-lg border p-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Roll Any Loot Pool
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Select value={poolId} onValueChange={setPoolId}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder="Pick a loot pool…" />
            </SelectTrigger>
            <SelectContent>
              {pools.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No loot pools in the reference library yet.
                </p>
              )}
              {pools.map((p) => (
                <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8" disabled={!poolId} onClick={rollPool}>
            <Dices className="mr-1 h-4 w-4" /> Roll
          </Button>
        </div>
        {poolResult && <LootLines result={poolResult} />}
      </section>
    </div>
  );
}

// Loot roll results: decided items with quantities and the pool path taken.
function LootLines({ result, emptyNote }) {
  return (
    <div className="mt-1.5 rounded bg-muted/50 px-2 py-1.5 text-xs">
      {result.error && <p className="text-destructive">{result.error}</p>}
      {result.errors?.length > 0 &&
        result.errors.map((e, i) => (
          <p key={i} className="text-destructive">{e}</p>
        ))}
      {result.lines && result.lines.length === 0 && !result.error && !result.errors?.length && (
        <p className="text-muted-foreground">{emptyNote || "Nothing rolled."}</p>
      )}
      {(result.lines || []).map((l, i) => (
        <p key={i}>
          🎲 {l.qty}× {l.name}
          {l.category ? ` (${l.category})` : ""}
          {l.via?.length > 1 && (
            <span className="text-muted-foreground"> · via {l.via.join(" → ")}</span>
          )}
        </p>
      ))}
    </div>
  );
}