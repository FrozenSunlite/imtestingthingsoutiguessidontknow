import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { rollEncounter } from "@/lib/dmLoot";
import {
  activeCombatant,
  attackTarget,
  buildParticipantRoster,
  damageCombatant,
  dashCombatant,
  distanceBetween,
  healCombatant,
  moveCombatant,
  nextTurn,
  runEnemyTurns,
  startCombat,
  endCombat,
  obstacleAt,
  occupantAt,
  sortByInitiative,
} from "@/lib/combat";
import {
  Bot,
  Crosshair,
  Dices,
  Footprints,
  Heart,
  Minus,
  Plus,
  Shield,
  SkipForward,
  Swords,
  Users,
  X,
} from "lucide-react";

const CELL = 40;

const TERRAIN_COLOR = {
  rubble: "#4a4038",
  water: "#27495c",
  pillar: "#5b5348",
  brambles: "#3f4f33",
};

const TERRAIN_GLYPH = {
  rubble: "▓",
  water: "≈",
  pillar: "■",
  brambles: "❦",
};

const sides = { party: "#6ea8fe", enemy: "#e06c75" };

export function CombatStage({ world, character, derived, monsters = [], seed = null, onChange }) {
  const combat = world?.combat || null;
  const [selectedId, setSelectedId] = useState("");
  const [pendingAttack, setPendingAttack] = useState(null);
  const [setupName, setSetupName] = useState("Encounter");
  const [setupMonsters, setSetupMonsters] = useState([]);
  const [setupAllies, setSetupAllies] = useState([]);
  const [monsterQuery, setMonsterQuery] = useState("");
  const [tableId, setTableId] = useState("");

  useEffect(() => {
    if (!seed) return;
    setSetupName(seed.name || "Encounter");
    setSetupMonsters(seed.monsters?.length ? seed.monsters : []);
    setSetupAllies([]);
    setMonsterQuery("");
  }, [seed]);

  useEffect(() => {
    if (!combat) return;
    const active = activeCombatant(combat);
    if (active && active.side === "party" && !selectedId) setSelectedId(active.id);
     
  }, [combat?.id, combat?.activeId]);

  const apply = (nextCombat) => onChange?.({ ...world, combat: nextCombat });

  const monsterOptions = useMemo(() => {
    const query = monsterQuery.trim().toLowerCase();
    return (monsters || [])
      .filter((monster) => !monster.dungeonExempt)
      .filter((monster) =>
        !query
          ? true
          : `${monster.name} ${monster.type} ${monster.category} ${monster.cr}`
              .toLowerCase()
              .includes(query)
      )
      .slice(0, 60);
  }, [monsters, monsterQuery]);

  const allyOptions = useMemo(() => {
    const npcs = world?.npcs || [];
    const rulerAndCourt = npcs.filter((npc) => npc.role === "ruler" || npc.role === "court");
    const others = npcs.filter((npc) => npc.role !== "ruler" && npc.role !== "court");
    return [...rulerAndCourt, ...others].slice(0, 60);
  }, [world]);

  if (!world) return null;

  // -----------------------------------------------------------------------
  // Setup
  // -----------------------------------------------------------------------
  if (!combat) {
    const addMonster = (monster) => {
      setSetupMonsters((list) => {
        const existing = list.find((entry) => entry.name === monster.name);
        if (existing) {
          return list.map((entry) =>
            entry.name === monster.name ? { ...entry, count: entry.count + 1 } : entry
          );
        }
        return [...list, { name: monster.name, count: 1 }];
      });
    };
    const setCount = (name, delta) => {
      setSetupMonsters((list) =>
        list
          .map((entry) =>
            entry.name === name ? { ...entry, count: Math.max(0, entry.count + delta) } : entry
          )
          .filter((entry) => entry.count > 0)
      );
    };
    const fillFromTable = () => {
      const table = (world.encounterTables || []).find((t) => t.id === tableId);
      if (!table) return;
      const rolled = rollEncounter(table, monsters);
      if (!rolled.length) {
        toast.error("That table rolled no creatures.");
        return;
      }
      setSetupMonsters(rolled.map((row) => ({ name: row.monster, count: row.count })));
      setSetupName(table.name || "Encounter");
    };
    const begin = () => {
      if (!character?.name && setupMonsters.length === 0) {
        toast.error("Add the party or at least one monster first.");
        return;
      }
      const participants = buildParticipantRoster({
        character,
        derived,
        allies: allyOptions.filter((npc) => setupAllies.includes(npc.id)),
        monsterCounts: setupMonsters,
        monsters,
      });
      if (!participants.some((p) => p.side === "enemy")) {
        toast.error("Add at least one enemy to begin combat.");
        return;
      }
      if (!participants.some((p) => p.side === "party")) {
        toast.error("Add the hero or at least one ally to the party.");
        return;
      }
      const next = startCombat({ participants, name: setupName || "Encounter" });
      apply(next);
      setSelectedId(next.activeId);
      setPendingAttack(null);
      toast.success("Roll for initiative!");
    };

    return (
      <div className="space-y-2">
        <div className="rounded-md border p-2">
          <p className="text-xs font-semibold">Set up a tactical encounter</p>
          <p className="text-[10px] text-muted-foreground">
            The party is placed on the left, enemies on the right. Movement is measured in 5-ft.
            spaces; attacks roll d20 + bonus against AC.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <Input
              className="h-7 w-56 text-xs"
              value={setupName}
              onChange={(e) => setSetupName(e.target.value)}
              placeholder="Encounter name"
            />
            <Select value={tableId} onValueChange={setTableId}>
              <SelectTrigger className="h-7 w-56 text-xs">
                <SelectValue placeholder="Fill from encounter table" />
              </SelectTrigger>
              <SelectContent>
                {(world.encounterTables || []).map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={fillFromTable} disabled={!tableId}>
              <Dices className="mr-1 h-3.5 w-3.5" /> Roll into setup
            </Button>
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="rounded-md border p-2">
              <p className="text-xs font-semibold">Party</p>
              <div className="mt-1 space-y-1 text-[10px]">
                <p className="flex items-center justify-between rounded bg-muted/40 px-1.5 py-1">
                  <span>
                    <span className="font-medium">{character?.name || "No character"}</span>
                    {character?.class ? ` — ${character.class} ${character.level || 1}` : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {derived?.["Hit Points"]?.final ?? "?"} HP · AC {derived?.["Armor Class"]?.final ?? "?"}
                  </span>
                </p>
                {!character?.name && (
                  <p className="text-muted-foreground">
                    Create a character in the Skill Tree to include the party hero.
                  </p>
                )}
              </div>
              <p className="mt-2 text-[10px] font-semibold">Allies</p>
              <div className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                {allyOptions.map((npc) => {
                  const active = setupAllies.includes(npc.id);
                  return (
                    <button
                      key={npc.id}
                      type="button"
                      onClick={() =>
                        setSetupAllies((list) =>
                          active ? list.filter((id) => id !== npc.id) : [...list, npc.id]
                        )
                      }
                      className={`flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[10px] ${
                        active ? "bg-primary/15" : "hover:bg-accent/50"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-primary" : "bg-muted-foreground/40"}`}
                      />
                      <span className="min-w-0 flex-1 truncate">{npc.name}</span>
                      <span className="text-muted-foreground">{npc.occupation}</span>
                    </button>
                  );
                })}
                {allyOptions.length === 0 && (
                  <p className="text-muted-foreground">No NPCs available to join the party.</p>
                )}
              </div>
            </div>

            <div className="rounded-md border p-2">
              <p className="text-xs font-semibold">Staged enemies</p>
              <div className="mt-1 space-y-1">
                {setupMonsters.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Pick monsters from the library on the right.
                  </p>
                )}
                {setupMonsters.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]">
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setCount(entry.name, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-5 text-center font-semibold">{entry.count}</span>
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setCount(entry.name, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5"
                      onClick={() => setSetupMonsters((list) => list.filter((row) => row.name !== entry.name))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button className="mt-2 h-7 w-full text-xs" onClick={begin} disabled={setupMonsters.length === 0}>
                <Swords className="mr-1 h-3.5 w-3.5" /> Roll initiative
              </Button>
            </div>
          </div>

          <div className="rounded-md border p-2">
            <div className="flex items-center gap-1">
              <p className="text-xs font-semibold">Monster library</p>
              <Input
                className="ml-auto h-6 w-40 text-[10px]"
                placeholder="Search monsters…"
                value={monsterQuery}
                onChange={(e) => setMonsterQuery(e.target.value)}
              />
            </div>
            <div className="mt-1 max-h-[52vh] space-y-0.5 overflow-y-auto">
              {monsterOptions.map((monster) => (
                <button
                  key={monster.id || monster.name}
                  type="button"
                  onClick={() => addMonster(monster)}
                  className="flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[10px] hover:bg-accent/60"
                >
                  <span className="min-w-0 flex-1 truncate">{monster.name}</span>
                  <span className="text-muted-foreground">{monster.type}</span>
                  <span className="w-12 text-right text-muted-foreground">CR {monster.cr || "?"}</span>
                  <Plus className="h-3 w-3" />
                </button>
              ))}
              {monsterOptions.length === 0 && (
                <p className="text-[10px] text-muted-foreground">
                  No monsters in the library yet. Import monsters from the Reference Index.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Active combat
  // -----------------------------------------------------------------------
  const active = activeCombatant(combat);
  const selected = combat.participants.find((p) => p.id === selectedId) || active || combat.participants[0];
  const order = sortByInitiative(combat.participants.filter((p) => !p.defeated));
  const canMove = selected && !selected.defeated;
  const remaining = selected ? Math.max(0, (selected.speed || 6) - (selected.moved || 0)) : 0;
  const reachable = new Set();
  if (canMove) {
    for (let y = 0; y < combat.height; y += 1) {
      for (let x = 0; x < combat.width; x += 1) {
        if (distanceBetween(selected, { x, y }) > remaining) continue;
        if (obstacleAt(combat, x, y)) continue;
        const occupant = occupantAt(combat, x, y);
        if (occupant && occupant.id !== selected.id) continue;
        reachable.add(`${x},${y}`);
      }
    }
  }

  const selectCell = (x, y) => {
    const occupant = occupantAt(combat, x, y);
    if (pendingAttack) {
      if (occupant && occupant.side !== pendingAttack.side) {
        const next = attackTarget(combat, pendingAttack.id, occupant.id, pendingAttack.attackIndex);
        apply(next);
        setPendingAttack(null);
        if (next.finished) toast[next.winner === "party" ? "success" : "error"](next.winner === "party" ? "The party wins!" : "The party is defeated.");
        return;
      }
      setPendingAttack(null);
      return;
    }
    if (occupant) {
      setSelectedId(occupant.id);
      return;
    }
    if (canMove) {
      const next = moveCombatant(combat, selected.id, x, y);
      if (next !== combat) setSelectedId(selected.id);
      apply(next);
    }
  };

  const attackWith = (participant, attackIndex) => {
    setPendingAttack({ id: participant.id, side: participant.side, attackIndex });
    setSelectedId(participant.id);
    toast.info(`Select a target for ${participant.attacks?.[attackIndex]?.name || "the attack"}.`);
  };

  const advance = () => {
    setPendingAttack(null);
    const next = nextTurn(combat);
    apply(next);
    setSelectedId(next.activeId);
  };

  const runEnemies = () => {
    const next = runEnemyTurns(combat);
    apply(next);
    setSelectedId(next.activeId || "");
    setPendingAttack(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
        <span className="text-xs font-semibold">{combat.name}</span>
        <span className="text-[10px] text-muted-foreground">Round {combat.round}</span>
        <span className="rounded border px-1.5 py-0.5 text-[10px]">
          Active: <strong>{active?.name || "—"}</strong>
          {active ? ` (${active.side === "enemy" ? "enemy" : "party"})` : ""}
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={advance}>
            <SkipForward className="mr-1 h-3.5 w-3.5" /> Next turn
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={runEnemies}
            disabled={combat.finished || !combat.participants.some((p) => p.side === "enemy" && !p.defeated)}
          >
            <Bot className="mr-1 h-3.5 w-3.5" /> Run enemy turns
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => {
              if (!combat.finished) apply(endCombat(combat, ""));
            }}
            disabled={combat.finished}
          >
            <X className="mr-1 h-3.5 w-3.5" /> End
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs"
            onClick={() => {
              if (window.confirm("Clear this combat and return to setup?")) {
                apply(null);
                setSelectedId("");
                setPendingAttack(null);
              }
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      {combat.finished && (
        <p
          className={`rounded border px-2 py-1 text-xs ${
            combat.winner === "party"
              ? "border-green-500/40 bg-green-500/10 text-green-400"
              : "border-red-500/40 bg-red-500/10 text-red-400"
          }`}
        >
          {combat.winner === "party" ? "Victory — the party holds the field." : "Defeat — the party has fallen."}
        </p>
      )}

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-2">
          <div className="overflow-auto rounded-md border bg-[#111318]">
            <svg
              viewBox={`0 0 ${combat.width * CELL} ${combat.height * CELL}`}
              className="block w-full"
              style={{ minHeight: "360px" }}
            >
              <rect width={combat.width * CELL} height={combat.height * CELL} fill="#14161c" />
              {(combat.terrain || []).map((cell) => (
                <g key={`t-${cell.x}-${cell.y}`}>
                  <rect
                    x={cell.x * CELL}
                    y={cell.y * CELL}
                    width={CELL}
                    height={CELL}
                    fill={TERRAIN_COLOR[cell.type] || "#3a3a3a"}
                    opacity="0.85"
                  />
                  <text
                    x={cell.x * CELL + CELL / 2}
                    y={cell.y * CELL + CELL / 2 + 5}
                    textAnchor="middle"
                    fontSize="14"
                    fill="#c8c2b1"
                  >
                    {TERRAIN_GLYPH[cell.type] || ""}
                  </text>
                </g>
              ))}
              {Array.from({ length: combat.width + 1 }).map((_, index) => (
                <line
                  key={`v${index}`}
                  x1={index * CELL}
                  y1={0}
                  x2={index * CELL}
                  y2={combat.height * CELL}
                  stroke="#262a33"
                  strokeWidth="1"
                />
              ))}
              {Array.from({ length: combat.height + 1 }).map((_, index) => (
                <line
                  key={`h${index}`}
                  x1={0}
                  y1={index * CELL}
                  x2={combat.width * CELL}
                  y2={index * CELL}
                  stroke="#262a33"
                  strokeWidth="1"
                />
              ))}
              {[...reachable].map((key) => {
                const [x, y] = key.split(",").map(Number);
                return (
                  <rect
                    key={`r-${key}`}
                    x={x * CELL + 2}
                    y={y * CELL + 2}
                    width={CELL - 4}
                    height={CELL - 4}
                    fill="#6ea8fe"
                    opacity="0.12"
                  />
                );
              })}
              {combat.participants.map((participant) => {
                if (participant.defeated) return null;
                const isSelected = participant.id === selected?.id;
                const isActive = participant.id === combat.activeId;
                const color = sides[participant.side] || "#888";
                const hpFraction = Math.max(0, Math.min(1, participant.hp / Math.max(1, participant.maxHp)));
                return (
                  <g
                    key={participant.id}
                    onClick={() => selectCell(participant.x, participant.y)}
                    style={{ cursor: "pointer" }}
                  >
                    <circle
                      cx={participant.x * CELL + CELL / 2}
                      cy={participant.y * CELL + CELL / 2}
                      r={CELL * 0.34}
                      fill={color}
                      fillOpacity="0.85"
                      stroke={isSelected ? "#ffe9a8" : isActive ? "#ffffff" : "#0d0f13"}
                      strokeWidth={isSelected || isActive ? 3 : 1.5}
                    />
                    <text
                      x={participant.x * CELL + CELL / 2}
                      y={participant.y * CELL + CELL / 2 + 4}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="700"
                      fill="#10131a"
                    >
                      {participant.name.slice(0, 2).toUpperCase()}
                    </text>
                    <rect
                      x={participant.x * CELL + 5}
                      y={participant.y * CELL + CELL - 8}
                      width={CELL - 10}
                      height="3"
                      rx="1.5"
                      fill="#1a1d24"
                    />
                    <rect
                      x={participant.x * CELL + 5}
                      y={participant.y * CELL + CELL - 8}
                      width={(CELL - 10) * hpFraction}
                      height="3"
                      rx="1.5"
                      fill={hpFraction > 0.5 ? "#5ac47a" : hpFraction > 0.25 ? "#e0b74f" : "#e06c75"}
                    />
                  </g>
                );
              })}
              {Array.from({ length: combat.height }).map((_, y) =>
                Array.from({ length: combat.width }).map((__, x) => (
                  <rect
                    key={`c-${x}-${y}`}
                    x={x * CELL}
                    y={y * CELL}
                    width={CELL}
                    height={CELL}
                    fill="transparent"
                    onClick={() => selectCell(x, y)}
                    style={{ cursor: "crosshair" }}
                  />
                ))
              )}
            </svg>
          </div>

          {pendingAttack && (
            <p className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
              <Crosshair className="mr-1 inline h-3 w-3" />
              Click an enemy token to resolve{" "}
              {combat.participants.find((p) => p.id === pendingAttack.id)?.attacks?.[pendingAttack.attackIndex]?.name}.
              <button type="button" className="ml-2 underline" onClick={() => setPendingAttack(null)}>
                Cancel
              </button>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: sides.party }} /> Party
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: sides.enemy }} /> Enemy
            </span>
            <span>Click a blue-highlighted cell to move; use an attack button, then click a target.</span>
          </div>

          {selected && (
            <div className="rounded-md border p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{selected.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {selected.kind === "monster" ? `CR ${selected.cr || "?"} · ${selected.type}` : selected.notes}
                </span>
                <span className="ml-auto flex items-center gap-1 text-[10px]">
                  <Heart className="h-3 w-3 text-red-400" /> {selected.hp}/{selected.maxHp}
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => apply(damageCombatant(combat, selected.id, 1))}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => apply(healCombatant(combat, selected.id, 1))}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3" /> AC {selected.ac}
                </span>
                <span className="flex items-center gap-1">
                  <Footprints className="h-3 w-3" /> Speed {selected.speed} spaces
                </span>
                <span>Moved {selected.moved || 0}/{selected.speed}</span>
                <span className={selected.acted ? "text-amber-400" : ""}>
                  {selected.acted ? "Action used" : "Action ready"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(selected.attacks || []).map((attack, index) => (
                  <Button
                    key={`${attack.name}-${index}`}
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    disabled={selected.defeated || combat.finished}
                    onClick={() => attackWith(selected, index)}
                  >
                    <Swords className="mr-1 h-3 w-3" />
                    {attack.name} · {attack.bonus >= 0 ? "+" : ""}
                    {attack.bonus} · {attack.damage}
                    {attack.range > 1 ? ` · ${attack.range} sp` : ""}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  disabled={selected.defeated || combat.finished}
                  onClick={() => apply(dashCombatant(combat, selected.id))}
                >
                  <Footprints className="mr-1 h-3 w-3" /> Dash
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  disabled={selected.defeated || combat.finished}
                  onClick={() => apply(damageCombatant(combat, selected.id, 5))}
                >
                  <Minus className="mr-1 h-3 w-3" /> 5
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  disabled={selected.defeated || combat.finished}
                  onClick={() => apply(healCombatant(combat, selected.id, 5))}
                >
                  <Plus className="mr-1 h-3 w-3" /> 5
                </Button>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-2">
          <div className="rounded-md border p-2">
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <p className="text-xs font-semibold">Initiative</p>
              <span className="ml-auto text-[10px] text-muted-foreground">{combat.participants.length} creatures</span>
            </div>
            <div className="mt-1 max-h-[42vh] space-y-1 overflow-y-auto">
              {order.map((participant) => {
                const activeNow = participant.id === combat.activeId;
                const hpFraction = Math.max(0, Math.min(1, participant.hp / Math.max(1, participant.maxHp)));
                return (
                  <button
                    key={participant.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(participant.id);
                      setPendingAttack(null);
                    }}
                    className={`w-full rounded border px-1.5 py-1 text-left text-[10px] ${
                      activeNow ? "border-primary/60 bg-primary/10" : "hover:bg-accent/40"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: sides[participant.side] || "#888" }}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{participant.name}</span>
                      <span className="text-muted-foreground">{participant.initiative}</span>
                    </div>
                    <div className="mt-0.5 h-1 overflow-hidden rounded bg-muted">
                      <div
                        className={`h-full ${hpFraction > 0.5 ? "bg-green-500" : hpFraction > 0.25 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${hpFraction * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>
                        {participant.hp}/{participant.maxHp} HP
                      </span>
                      <span>AC {participant.ac}</span>
                    </div>
                  </button>
                );
              })}
              {combat.participants
                .filter((p) => p.defeated)
                .map((participant) => (
                  <div key={participant.id} className="rounded border px-1.5 py-1 text-[10px] line-through opacity-50">
                    {participant.name} — defeated
                  </div>
                ))}
            </div>
          </div>

          <div className="rounded-md border p-2">
            <p className="text-xs font-semibold">Combat log</p>
            <div className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-[10px]">
              {(combat.log || [])
                .slice(-40)
                .reverse()
                .map((entry, index) => (
                  <p
                    key={index}
                    className={
                      entry.kind === "hit"
                        ? "text-green-400"
                        : entry.kind === "defeat"
                          ? "text-red-400"
                          : entry.kind === "turn"
                            ? "font-semibold"
                            : "text-muted-foreground"
                    }
                  >
                    {entry.text}
                  </p>
                ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
