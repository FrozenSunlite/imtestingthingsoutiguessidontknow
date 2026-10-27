import { useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { useTree } from "@/lib/treeStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dices,
  GripVertical,
  Plus,
  RotateCcw,
  SkipForward,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { parseMaxHp, crNum, rollLootPool, dexMod } from "@/lib/dmLoot";

// Combat tracker grid: combatants sorted by initiative with live HP
// tracking, conditions/notes and a round/turn pointer. Monsters are pulled
// from the reference library — rows carry their DEX bonus, expand to the
// full statblock with assignable loot pools, and drag to reorder. The whole
// encounter persists between sessions.
export function CombatTracker({ tracker, setTracker, monsters }) {
  const [sort, setSort] = useState("name"); // name | type | cr
  const [pick, setPick] = useState("");
  const [count, setCount] = useState(1);
  const [amts, setAmts] = useState({}); // per-row damage/heal amount

  const { round, activeId, entries } = tracker;
  const update = (patch) => setTracker((t) => ({ ...t, ...patch }));
  const sorted = [...entries].sort((a, b) => (Number(b.init) || 0) - (Number(a.init) || 0));
  // Manual order (after dragging) until the next initiative re-roll.
  const displayed = tracker.manual ? entries : sorted;
  const sortedMonsters = useMemo(() => {
    const arr = [...monsters];
    if (sort === "type")
      arr.sort(
        (a, b) =>
          (a.type || "").localeCompare(b.type || "") ||
          (a.name || "").localeCompare(b.name || "")
      );
    else if (sort === "cr")
      arr.sort(
        (a, b) => crNum(a.cr) - crNum(b.cr) || (a.name || "").localeCompare(b.name || "")
      );
    else arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return arr;
  }, [monsters, sort]);

  const addMonster = (name, n) => {
    const m = monsters.find((x) => x.name === name);
    if (!m || !n) return;
    const maxHp = parseMaxHp(m.hp);
    const rows = Array.from({ length: n }, (_, i) => ({
      id: `e${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      name: n > 1 ? `${m.name} ${i + 1}` : m.name,
      monster: m.name,
      init: "",
      initBonus: dexMod(m.abilities),
      ac: String(m.ac ?? ""),
      hp: maxHp,
      maxHp,
      notes: `CR ${m.cr || "—"}${m.type ? ` · ${m.type}` : ""}`,
      lootPools: (m.lootPools || []).slice(),
    }));
    update({ entries: [...entries, ...rows] });
  };

  const addCustom = () =>
    update({
      entries: [
        ...entries,
        {
          id: `e${Date.now()}-custom`,
          name: "",
          init: "",
          initBonus: 0,
          monster: "",
          ac: "",
          hp: 0,
          maxHp: 0,
          notes: "",
          lootPools: [],
        },
      ],
    });

  const patchEntry = (id, p) =>
    update({ entries: entries.map((e) => (e.id === id ? { ...e, ...p } : e)) });

  const removeEntry = (id) =>
    update({
      entries: entries.filter((e) => e.id !== id),
      activeId: activeId === id ? null : activeId,
    });

  const nextTurn = () => {
    if (!displayed.length) return;
    const idx = displayed.findIndex((e) => e.id === activeId);
    if (idx === -1 || idx === displayed.length - 1)
      update({ activeId: displayed[0].id, round: idx === -1 ? round : round + 1 });
    else update({ activeId: displayed[idx + 1].id });
  };

  // d20 + the combatant's initiative bonus (the monster's DEX modifier).
  const rollInit = (e) => 1 + Math.floor(Math.random() * 20) + (Number(e.initBonus) || 0);

  const rollAllInit = () =>
    update({
      manual: false, // back to initiative order
      entries: entries.map((e) => ({ ...e, init: rollInit(e) })),
    });

  // Drag to reorder: freezes the tracker in this order until re-rolled.
  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const arr = [...displayed];
    const [moved] = arr.splice(result.source.index, 1);
    arr.splice(result.destination.index, 0, moved);
    update({ entries: arr, manual: true });
  };

  const reset = () => {
    if (entries.length && !window.confirm("Clear the whole tracker?")) return;
    setAmts({});
    update({ round: 1, activeId: null, entries: [], manual: false });
  };

  return (
    <div className="space-y-2">
      {/* Add combatants: reference-library monsters or a custom row. */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border p-2">
        <Select value={pick} onValueChange={setPick}>
          <SelectTrigger className="h-8 w-52 text-xs">
            <SelectValue placeholder="Pick a monster from the library…" />
          </SelectTrigger>
          <SelectContent>
            {monsters.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No monsters in the reference library yet.
              </p>
            )}
            {sortedMonsters.map((m) => (
              <SelectItem key={m.name} value={m.name}>
                {m.name}
                {m.cr ? ` (CR ${m.cr})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-8 w-32 text-xs" title="Sort the monster list">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">A–Z</SelectItem>
            <SelectItem value="type">By type</SelectItem>
            <SelectItem value="cr">By CR</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={1}
          max={20}
          className="h-8 w-16"
          title="How many to add"
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
        <Button
          size="sm"
          className="h-8"
          disabled={!pick}
          onClick={() => {
            addMonster(pick, Math.max(1, Math.min(20, Number(count) || 1)));
            setCount(1);
          }}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
        <Button size="sm" variant="outline" className="h-8" onClick={addCustom}>
          <Plus className="h-4 w-4" /> Custom combatant
        </Button>
      </div>

      {/* Encounter controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium">Round {round}</span>
        <Button size="sm" onClick={nextTurn} disabled={!displayed.length}>
          <SkipForward className="h-4 w-4" /> Next turn
        </Button>
        <Button size="sm" variant="outline" onClick={rollAllInit} disabled={!entries.length}>
          <Dices className="h-4 w-4" /> Roll all initiative
        </Button>
        <Button size="sm" variant="ghost" onClick={reset} disabled={!entries.length}>
          <RotateCcw className="h-4 w-4" /> Reset
        </Button>
        {tracker.manual && (
          <span className="text-[10px] text-muted-foreground">manual order — re-roll initiative to sort</span>
        )}
      </div>

      {displayed.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing in the tracker yet — add monsters from the reference library above.
        </p>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="tracker">
            {(dropProvided) => (
              <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="space-y-1.5">
                {displayed.map((e, idx) => (
                  <Draggable key={e.id} draggableId={e.id} index={idx}>
                    {(dragProvided) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                      >
                        <TrackerRow
                          e={e}
                          active={e.id === activeId}
                          mon={monsters.find((m) => m.name === e.monster)}
                          amt={amts[e.id] ?? ""}
                          setAmt={(v) => setAmts((a) => ({ ...a, [e.id]: v }))}
                          patch={(p) => patchEntry(e.id, p)}
                          remove={() => removeEntry(e.id)}
                          dragHandleProps={dragProvided.dragHandleProps}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {dropProvided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
      <p className="text-[10px] text-muted-foreground">
        The tracker is saved in the browser — an encounter survives closing the app.
      </p>
    </div>
  );
}

// One combatant row: editable stats, HP damage/heal, notes and actions —
// with a drag handle, an initiative roll that includes the DEX bonus, and a
// chevron that expands to the full monster statblock plus its loot pools.
function TrackerRow({ e, active, mon, amt, setAmt, patch, remove, dragHandleProps }) {
  const [open, setOpen] = useState(false);
  const down = Number(e.maxHp) > 0 && Number(e.hp) <= 0;
  const apply = (delta) => {
    const n = Number(amt) || 0;
    if (!n) return;
    patch({ hp: delta < 0 ? Math.max(0, Number(e.hp) - n) : Number(e.hp) + n });
    setAmt("");
  };
  const rollHere = () =>
    patch({ init: 1 + Math.floor(Math.random() * 20) + (Number(e.initBonus) || 0) });
  return (
    <div
      className={`rounded-md border ${active ? "border-primary bg-primary/5" : ""} ${
        down ? "opacity-80" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5 p-1.5">
        <div className="flex w-9 items-center gap-0.5">
          <span
            {...dragHandleProps}
            title="Drag to reorder"
            className="cursor-grab text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <button type="button" onClick={() => setOpen(!open)} title="Monster details">
            <ChevronDown
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
            />
          </button>
        </div>
        <div className="w-32">
          <Input
            className="h-7 text-xs"
            placeholder="Name"
            value={e.name || ""}
            onChange={(ev) => patch({ name: ev.target.value })}
          />
          {down && <span className="ml-1 text-[10px] font-semibold text-destructive">Down</span>}
        </div>
        <Input
          className="h-7 w-12 text-center text-xs"
          type="number"
          title="Initiative"
          value={e.init ?? ""}
          onChange={(ev) => patch({ init: ev.target.value })}
        />
        <Input
          className="h-7 w-12 text-center text-xs"
          title="AC"
          value={e.ac ?? ""}
          onChange={(ev) => patch({ ac: ev.target.value })}
        />
        <div className="flex w-28 items-center gap-1">
          <Input
            className="h-7 text-center text-xs"
            type="number"
            title="Current HP"
            value={e.hp ?? 0}
            onChange={(ev) => patch({ hp: Number(ev.target.value) || 0 })}
          />
          <span className="text-xs text-muted-foreground">/</span>
          <Input
            className="h-7 text-center text-xs"
            type="number"
            title="Max HP"
            value={e.maxHp ?? 0}
            onChange={(ev) => patch({ maxHp: Number(ev.target.value) || 0 })}
          />
        </div>
        <div className="flex w-[10.5rem] items-center gap-1">
          <Input
            className="h-7 w-14 text-center text-xs"
            type="number"
            min={0}
            placeholder="amt"
            value={amt}
            onChange={(ev) => setAmt(ev.target.value)}
          />
          <Button size="sm" variant="destructive" className="h-7 px-2" onClick={() => apply(-1)} title="Damage">
            −
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => apply(1)} title="Heal">
            +
          </Button>
        </div>
        <Input
          className="h-7 min-w-[8rem] flex-1 text-xs"
          placeholder="Conditions / notes"
          value={e.notes || ""}
          onChange={(ev) => patch({ notes: ev.target.value })}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-1.5"
          title="Roll initiative (d20 + DEX)"
          onClick={rollHere}
        >
          <Dices className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-1.5" title="Remove" onClick={remove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {open && (
        <div className="space-y-2 border-t p-2">
          <MonsterInfo m={mon} />
          <LootRowSection e={e} patch={patch} />
        </div>
      )}
    </div>
  );
}

// The linked library monster's full statblock, read-only.
function MonsterInfo({ m }) {
  if (!m)
    return (
      <p className="text-xs text-muted-foreground">
        This combatant isn't linked to a library monster.
      </p>
    );
  return (
    <div className="space-y-1 text-xs">
      <p className="font-medium">
        {[m.size, m.type, m.alignment].filter(Boolean).join(" · ")}
        {m.cr ? ` · CR ${m.cr}` : ""}
      </p>
      <p className="text-muted-foreground">
        AC {m.ac || "—"} · HP {m.hp || "—"} · Speed {m.speed || "—"}
      </p>
      {m.abilities && <p>{m.abilities}</p>}
      {(m.senses || m.languages) && (
        <p className="text-muted-foreground">
          Senses: {m.senses || "—"} · Languages: {m.languages || "—"}
        </p>
      )}
      {["traits", "actions", "reactions"].map((key) => {
        const list = m[key] || [];
        if (!list.length) return null;
        const label = key[0].toUpperCase() + key.slice(1);
        return (
          <div key={key}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            {list.map((t, i) => (
              <p key={i}>
                <span className="font-medium">{t.name}</span>
                {t.text ? ` — ${t.text}` : ""}
              </p>
            ))}
          </div>
        );
      })}
      {m.description && <p className="italic text-muted-foreground">{m.description}</p>}
    </div>
  );
}

// Assign loot pools to this combatant and roll them, resolving recursively.
function LootRowSection({ e, patch }) {
  const { settings } = useTree();
  const allPools = (settings?.library?.lootPools || []).filter((p) => p.name);
  const assigned = e.lootPools || [];
  const [result, setResult] = useState(null);

  const rollLoot = () => {
    const lines = [];
    const errors = [];
    assigned.forEach((name) => {
      const r = rollLootPool(name, allPools);
      lines.push(...r.lines);
      if (r.error) errors.push(r.error);
    });
    setResult({ lines, errors });
  };

  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Loot pools
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {allPools.map((p) => {
          const on = assigned.includes(p.name);
          return (
            <button
              key={p.name}
              onClick={() =>
                patch({
                  lootPools: on
                    ? assigned.filter((n) => n !== p.name)
                    : [...assigned, p.name],
                })
              }
              className={`rounded border px-2 py-0.5 text-xs ${
                on ? "border-primary bg-primary/10 font-semibold" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {p.name}
            </button>
          );
        })}
        <Button size="sm" variant="outline" className="h-6 text-[11px]" disabled={!assigned.length} onClick={rollLoot}>
          <Dices className="mr-1 h-3 w-3" /> Roll loot
        </Button>
      </div>
      {allPools.length === 0 && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          No loot pools yet — create them in the Reference Library (Loot Pools).
        </p>
      )}
      {result && (
        <div className="mt-1 rounded bg-muted/50 px-2 py-1 text-xs">
          {result.errors.map((err, i) => (
            <p key={i} className="text-destructive">{err}</p>
          ))}
          {result.lines.length === 0 && !result.errors.length && (
            <p className="text-muted-foreground">Nothing rolled.</p>
          )}
          {result.lines.map((l, i) => (
            <p key={i}>
              🎲 {l.qty}× {l.name}
              {l.category ? ` (${l.category})` : ""}
              {l.via?.length > 1 && (
                <span className="text-muted-foreground"> · via {l.via.join(" → ")}</span>
              )}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}