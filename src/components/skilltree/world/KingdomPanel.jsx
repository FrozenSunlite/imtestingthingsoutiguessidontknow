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
import { useTree, listCharacterSaves } from "@/lib/treeStore";
import {
  ACCORD_TYPES,
  COUNCIL_ACTION_GROUPS,
  COUNCIL_ROLES,
  ESPIONAGE_MISSIONS,
  KINGDOM_DECREES,
  KINGDOM_RESEARCH,
  applyKingdomAction,
  availableKingdomActions,
  battlePower,
  councilAbility,
  eventResolutionCost,
  normalizeCouncilRole,
  resolveKingdomEvent,
  runKingdomTurn,
} from "@/lib/kingdom";
import { addCaravan, advanceWorldTime } from "@/lib/worldSim";
import { Dices, Eye, EyeOff, Handshake, Shield, Swords } from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString();

export function KingdomPanel({ world, kingdomId, onChange, onSelect }) {
  const { character } = useTree();
  const [actionQuery, setActionQuery] = useState("");
  const [actionCouncil, setActionCouncil] = useState("all");
  const [tab, setTab] = useState("actions");
  const [caravanTarget, setCaravanTarget] = useState("");
  const [caravanCargo, setCaravanCargo] = useState("grain and cloth");
  const [appointRole, setAppointRole] = useState("steward");
  const [appointCharacterId, setAppointCharacterId] = useState("__active__");
  const [savedCharacters, setSavedCharacters] = useState([]);
  const kingdom = world?.kingdoms?.find((k) => k.id === kingdomId) || world?.kingdoms?.[0] || null;
  const nation = world?.nations?.find((n) => n.id === kingdom?.nationId);
  const capital = world?.settlements?.find((s) => s.id === kingdom?.capitalId);
  const actions = useMemo(
    () => (kingdom ? availableKingdomActions(kingdom, world) : []),
    [kingdom, world]
  );
  const shownActions = actions
    .filter((action) =>
      actionCouncil === "all" || normalizeCouncilRole(action.council) === actionCouncil
    )
    .filter((action) =>
      `${action.label} ${action.detail} ${action.kind}`.toLowerCase().includes(actionQuery.trim().toLowerCase())
    )
    .slice(0, 260);
  const groupedActions = useMemo(() => {
    const groups = new Map(COUNCIL_ACTION_GROUPS.map((group) => [group.id, []]));
    shownActions.forEach((action) => {
      const id = normalizeCouncilRole(action.council) || "architect";
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(action);
    });
    return COUNCIL_ACTION_GROUPS.map((group) => ({
      ...group,
      actions: groups.get(group.id) || [],
    })).filter((group) => group.actions.length > 0);
  }, [shownActions]);

  useEffect(() => {
    if (tab !== "council") return undefined;
    let alive = true;
    listCharacterSaves()
      .then((rows) => alive && setSavedCharacters(Array.isArray(rows) ? rows : []))
      .catch(() => alive && setSavedCharacters([]));
    return () => {
      alive = false;
    };
  }, [tab]);

  if (!kingdom) return <p className="text-xs text-muted-foreground">No kingdoms generated.</p>;

  const replaceKingdom = (nextKingdom, nextWorld = world) => {
    const kingdoms = nextWorld.kingdoms.map((k) => (k.id === nextKingdom.id ? nextKingdom : k));
    onChange?.({ ...nextWorld, kingdoms });
  };

  const resolveEvent = (eventId) => {
    const result = resolveKingdomEvent(kingdom, eventId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    replaceKingdom(result.kingdom);
    toast.success(
      `${result.event.name} resolved for ${result.cost} ${result.resourceLabel}.`
    );
  };

  const runTurn = () => {
    const nextWorld = JSON.parse(JSON.stringify(world));
    const index = nextWorld.kingdoms.findIndex((k) => k.id === kingdom.id);
    if (index < 0) return;
    const result = runKingdomTurn(nextWorld.kingdoms[index], nextWorld, `${kingdom.id}:${Date.now()}`);
    nextWorld.kingdoms[index] = result.kingdom;
    nextWorld.logs = [
      ...(nextWorld.logs || []),
      { at: new Date().toISOString(), text: `${kingdom.name}: ${result.log.join(" ")}` },
    ];
    onChange?.(nextWorld);
    toast.success(`${kingdom.name} completed a Kingdom Turn.`);
  };

  const runAll = () => {
    const nextWorld = JSON.parse(JSON.stringify(world));
    nextWorld.kingdoms = nextWorld.kingdoms.map((k, index) => {
      const result = runKingdomTurn(k, nextWorld, `${k.id}:${Date.now()}:${index}`);
      return result.kingdom;
    });
    nextWorld.logs = [
      ...(nextWorld.logs || []),
      { at: new Date().toISOString(), text: "All kingdoms completed a turn." },
    ];
    onChange?.(nextWorld);
    toast.success("All kingdoms completed a turn.");
  };

  // The autonomous loop: every kingdom takes a month's turn while the world
  // clock and caravans move forward with it.
  const runMonth = () => {
    const nextWorld = JSON.parse(JSON.stringify(world));
    nextWorld.kingdoms = nextWorld.kingdoms.map((k, index) => {
      const result = runKingdomTurn(k, nextWorld, `${k.id}:month:${Date.now()}:${index}`);
      return result.kingdom;
    });
    const advanced = advanceWorldTime(nextWorld, 24 * 30);
    advanced.logs = [
      ...(advanced.logs || []),
      { at: new Date().toISOString(), text: "A month passes; every kingdom has taken its turn." },
    ];
    onChange?.(advanced);
    toast.success("A month passes. Kingdoms, people and caravans move.");
  };

  const apply = (action) => {
    if (!action.affordable) {
      toast.error("The kingdom cannot afford that action.");
      return;
    }
    const nextWorld = JSON.parse(JSON.stringify(world));
    const index = nextWorld.kingdoms.findIndex((k) => k.id === kingdom.id);
    if (index < 0) return;
    const result = applyKingdomAction(nextWorld.kingdoms[index], action.id, nextWorld);
    nextWorld.kingdoms[index] = result.kingdom;
    nextWorld.logs = [
      ...(nextWorld.logs || []),
      { at: new Date().toISOString(), text: `${kingdom.name}: ${result.log.join(" ")}` },
    ];
    onChange?.(nextWorld);
    toast.success(result.log[0] || "Action applied.");
  };

  const appoint = (roleId, npcId) => {
    const npc = (world.npcs || []).find((n) => n.id === npcId);
    if (!npc) return;
    const role = COUNCIL_ROLES.find((r) => r.id === normalizeCouncilRole(roleId));
    const council = (kingdom.council || []).map((member) =>
      normalizeCouncilRole(member.role) === role?.id
        ? { ...npc, role: role.name, occupation: role.name }
        : member
    );
    if (role && !council.some((member) => normalizeCouncilRole(member.role) === role.id)) {
      council.push({ ...npc, role: role.name, occupation: role.name });
    }
    replaceKingdom({ ...kingdom, council });
    toast.success(`${npc.name} appointed as ${role?.name || roleId}.`);
  };

  const applyAdventurer = (roleId, char, sourceId = "") => {
    if (!char?.name) {
      toast.error("That character has no name.");
      return;
    }
    const role = COUNCIL_ROLES.find((r) => r.id === normalizeCouncilRole(roleId));
    if (!role) return;
    const stats = char.stats || {};
    const abilities = Object.fromEntries(
      ["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((key) => [
        key,
        Number(stats[key] ?? char.abilities?.[key] ?? 10) || 10,
      ])
    );
    const slug = String(sourceId || char.id || char.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .slice(0, 48);
    const id = `npc_adv_${slug}`;
    const home =
      capital?.buildings?.find((building) => building.category === "Residential") ||
      capital?.buildings?.[0];
    const work =
      capital?.buildings?.find((building) => building.type === "Castle" || building.type === "Town Hall") ||
      capital?.buildings?.[0];
    const npc = {
      id,
      name: char.name,
      first: String(char.name).split(" ")[0] || char.name,
      last: String(char.name).split(" ").slice(1).join(" "),
      sex: char.sex || "",
      age: char.age || "",
      abilities,
      culture: char.race || char.culture || "Human",
      role: role.name,
      occupation: role.name,
      personality: {
        trait: char.personality?.trait || char.background || "An adventurer called to court.",
        ideal: char.personality?.ideal || "Service to the crown.",
        bond: char.personality?.bond || "The nation that gave them a chance.",
        flaw: char.personality?.flaw || "Too direct for court politics.",
        background:
          char.personality?.background ||
          char.background ||
          "A created character appointed to the royal council.",
      },
      settlementId: kingdom.capitalId,
      nationId: kingdom.nationId,
      homeBuildingId: home?.id || "",
      workBuildingId: work?.id || "",
      status: "Alive",
      notes: char.class ? `Adventurer · ${char.class} ${char.level || 1}` : "Adventurer",
      isAdventurer: true,
      characterRef: sourceId || char.id || "",
    };
    const npcs = [...(world.npcs || []).filter((entry) => entry.id !== id), npc];
    let council = (kingdom.council || []).map((member) =>
      normalizeCouncilRole(member.role) === role.id ? npc : member
    );
    if (!council.some((member) => normalizeCouncilRole(member.role) === role.id)) {
      council = [...council, npc];
    }
    onChange?.({
      ...world,
      npcs,
      kingdoms: world.kingdoms.map((entry) =>
        entry.id === kingdom.id ? { ...kingdom, council } : entry
      ),
    });
    toast.success(`${char.name} appointed as ${role.name}.`);
  };

  const appointSelectedAdventurer = () => {
    if (appointCharacterId === "__active__") {
      applyAdventurer(appointRole, character, `active_${character?.name || ""}`);
      return;
    }
    const save = savedCharacters.find((entry) => entry.id === appointCharacterId);
    applyAdventurer(appointRole, save?.character, save?.id || appointCharacterId);
  };

  const importAdventurerFile = async (file) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const char = data.character || data;
      applyAdventurer(appointRole, char, data.id || data.name || file.name);
    } catch {
      toast.error("That file is not a character or project export.");
    }
  };

  const canPay = (cost = {}) =>
    Object.entries(cost).every(([key, amount]) => (kingdom.counts?.[key] || 0) >= amount);

  const otherKingdoms = (world?.kingdoms || []).filter((item) => item.id !== kingdom.id);

  const relationOf = (other) => Number(kingdom.relations?.[other?.nationId] ?? 0);
  const noWar = (kingdom.flags?.noWarUntil || 0) > (kingdom.turn || 1);

  const sendCaravan = () => {
    if (!caravanTarget) {
      toast.error("Choose a destination kingdom first.");
      return;
    }
    const next = addCaravan(world, {
      fromKingdomId: kingdom.id,
      toKingdomId: caravanTarget,
      cargo: caravanCargo || "mixed goods",
    });
    onChange?.(next);
    toast.success("Caravan departed. Advance world time to move it.");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={kingdom.id} onValueChange={onSelect}>
          <SelectTrigger className="h-8 w-64 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {world.kingdoms.map((item) => (
              <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground">
          {nation?.name} · {nation?.government} · capital {capital?.name}
        </span>
        <div className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            title="Toggle the kingdom border outlines on the World Map"
            onClick={() =>
              onChange?.({ ...world, showBorders: world?.showBorders === false })
            }
          >
            {world?.showBorders === false ? (
              <Eye className="mr-1 h-3.5 w-3.5" />
            ) : (
              <EyeOff className="mr-1 h-3.5 w-3.5" />
            )}
            Borders
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={runTurn}>
            <Dices className="mr-1 h-3.5 w-3.5" /> Kingdom Turn
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={runAll}>
            Run all kingdoms
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={runMonth}>
            Run a month
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {[
          ["Economy", kingdom.stats.economy, kingdom.counts.ec],
          ["Military", kingdom.stats.military, kingdom.counts.mc],
          ["Influence", kingdom.stats.influence, kingdom.counts.ic],
          ["Prosperity", kingdom.stats.prosperity, kingdom.counts.pc],
        ].map(([label, stat, count]) => (
          <div key={label} className="rounded-md border bg-muted/20 p-1.5">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold">
              {stat} <span className="text-[10px] font-normal text-muted-foreground">+{count} counts</span>
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1">
            {[
              ["actions", "Actions"],
              ["council", "Council"],
              ["diplomacy", "Diplomacy"],
              ["decrees", "Decrees"],
              ["buildings", "Buildings & research"],
              ["units", "Armies & wars"],
              ["ledger", "Ledger"],
              ["log", "Turn log"],
            ].map(([id, label]) => (
              <Button
                key={id}
                size="sm"
                variant={tab === id ? "secondary" : "ghost"}
                className="h-7 text-xs"
                onClick={() => setTab(id)}
              >
                {label}
              </Button>
            ))}
            {tab === "actions" && (
              <Input
                className="ml-auto h-7 w-44 text-xs"
                placeholder="Filter actions…"
                value={actionQuery}
                onChange={(e) => setActionQuery(e.target.value)}
              />
            )}
          </div>

          {tab === "actions" && (
            <div className="space-y-1">
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant={actionCouncil === "all" ? "secondary" : "ghost"}
                  className="h-6 text-[10px]"
                  onClick={() => setActionCouncil("all")}
                >
                  All councils
                </Button>
                {COUNCIL_ACTION_GROUPS.map((group) => (
                  <Button
                    key={group.id}
                    size="sm"
                    variant={actionCouncil === group.id ? "secondary" : "ghost"}
                    className="h-6 text-[10px]"
                    onClick={() => setActionCouncil(group.id)}
                    title={group.detail}
                  >
                    {group.name}
                  </Button>
                ))}
              </div>
              <div className="max-h-[44vh] space-y-2 overflow-y-auto rounded-md border p-2">
                {groupedActions.map((group) => (
                  <div key={group.id} className="space-y-1">
                    <div className="sticky top-0 z-10 flex items-baseline gap-1 bg-background/95 px-1 py-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {group.name}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {group.detail} · {group.actions.length}
                      </span>
                    </div>
                    {group.actions.map((action) => (
                      <div key={action.id} className="flex flex-wrap items-center gap-1 rounded border px-1.5 py-1 text-[11px]">
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{action.label}</span>
                          <span className="block text-[9px] text-muted-foreground">{action.detail}</span>
                        </span>
                        <span className={`text-[9px] ${action.affordable ? "text-muted-foreground" : "text-destructive"}`}>
                          {Object.entries(action.cost || {}).map(([k, v]) => `${v} ${k.toUpperCase()}`).join(", ") || "Free"}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-1 text-[9px]"
                          disabled={!action.affordable}
                          onClick={() => apply(action)}
                        >
                          Do
                        </Button>
                      </div>
                    ))}
                  </div>
                ))}
                {shownActions.length === 0 && <p className="text-xs text-muted-foreground">No matching actions.</p>}
              </div>
            </div>
          )}

          {tab === "council" && (
            <div className="space-y-2">
              <div className="space-y-1 rounded-md border p-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Appoint an adventurer
                </p>
                <p className="text-[9px] text-muted-foreground">
                  Use the active character, a saved character, or import a character export.
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  <Select value={appointRole} onValueChange={setAppointRole}>
                    <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COUNCIL_ROLES.map((role) => (
                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={appointCharacterId} onValueChange={setAppointCharacterId}>
                    <SelectTrigger className="h-7 w-56 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__active__">
                        {character?.name ? `${character.name} (active)` : "Active character (none)"}
                      </SelectItem>
                      {savedCharacters
                        .filter((save) => save?.character?.name)
                        .map((save) => (
                          <SelectItem key={save.id} value={save.id}>
                            {save.character.name} — {save.name || "saved"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={appointCharacterId === "__active__" && !character?.name}
                    onClick={appointSelectedAdventurer}
                  >
                    Appoint
                  </Button>
                  <label className="inline-flex h-7 cursor-pointer items-center rounded border px-2 text-[10px] hover:bg-accent">
                    Import character…
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) importAdventurerFile(file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-1 rounded-md border p-2">
                {COUNCIL_ROLES.map((role) => {
                  const member = (kingdom.council || []).find(
                    (m) => normalizeCouncilRole(m.role) === role.id
                  );
                  const candidates = [
                    ...(world.npcs || []).filter(
                      (npc) =>
                        !npc.isAdventurer &&
                        (npc.settlementId === kingdom.capitalId || npc.nationId === kingdom.nationId)
                    ),
                    ...(member && !(world.npcs || []).some((npc) => npc.id === member.id)
                      ? [member]
                      : []),
                  ];
                  if (member?.isAdventurer && !candidates.some((npc) => npc.id === member.id)) {
                    candidates.unshift(member);
                  }
                  return (
                    <div key={role.id} className="grid items-center gap-1 rounded border p-1.5 text-[10px] sm:grid-cols-[100px_minmax(0,1fr)_70px]">
                      <span className="font-semibold">{role.name}</span>
                      <Select value={member?.id || ""} onValueChange={(value) => appoint(role.id, value)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Appoint…" /></SelectTrigger>
                        <SelectContent>
                          {candidates.slice(0, 80).map((npc) => (
                            <SelectItem key={npc.id} value={npc.id}>{npc.name} — {npc.occupation}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground">
                        {role.ability} {member?.abilities?.[role.ability] || "—"} ({councilAbility(kingdom, role.id) >= 0 ? "+" : ""}
                        {councilAbility(kingdom, role.id)})
                      </span>
                      {member?.isAdventurer && (
                        <span className="col-span-full text-[9px] text-primary">
                          Appointed adventurer{member.notes ? ` · ${member.notes}` : ""}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "diplomacy" && (
            <div className="max-h-[48vh] space-y-1 overflow-y-auto rounded-md border p-2">
              {otherKingdoms.map((other) => {
                const relation = relationOf(other);
                const atWar = (kingdom.wars || []).includes(other.id);
                const isVassal = (kingdom.vassals || []).includes(other.id);
                const allied = (kingdom.accords || []).some(
                  (accord) => accord.type === "alliance" && accord.kingdomId === other.id
                );
                return (
                  <div key={other.id} className="rounded border p-1.5 text-[10px]">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-semibold">{other.name}</span>
                      <span className={atWar ? "text-red-400" : relation >= 3 ? "text-green-400" : "text-muted-foreground"}>
                        {atWar ? "At war" : allied ? "Allied" : isVassal ? "Vassal" : `Relation ${relation >= 0 ? "+" : ""}${relation}`}
                      </span>
                      <span className="text-muted-foreground">
                        BCR {battlePower(kingdom)} vs {battlePower(other)}
                      </span>
                      <div className="ml-auto flex flex-wrap gap-1">
                        {atWar ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-1.5 text-[9px]"
                              onClick={() => apply({ id: `battle:${other.id}`, affordable: true, kind: "battle" })}
                            >
                              <Swords className="mr-1 h-3 w-3" /> Battle
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-1.5 text-[9px]"
                              disabled={!canPay({ ic: 8 })}
                              onClick={() => apply({ id: `peace:${other.id}`, affordable: canPay({ ic: 8 }), kind: "peace" })}
                            >
                              Peace (8 IC)
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-1.5 text-[9px]"
                            disabled={noWar}
                            title={noWar ? "A non-aggression pact is in force." : "Declare war."}
                            onClick={() => apply({ id: `war:${other.id}`, affordable: true, kind: "war" })}
                          >
                            Declare war
                          </Button>
                        )}
                      </div>
                    </div>

                    {!atWar && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {ACCORD_TYPES.map((accord) => {
                          const relationOk = relation >= accord.minRelation;
                          const strongerOk =
                            !accord.requiresStronger || battlePower(kingdom) >= battlePower(other) * 0.8;
                          const affordable = canPay(accord.cost);
                          return (
                            <Button
                              key={accord.id}
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[9px]"
                              title={`${accord.detail}${relationOk ? "" : ` Needs relation ${accord.minRelation}.`}`}
                              disabled={!affordable || !relationOk || !strongerOk}
                              onClick={() =>
                                apply({
                                  id: `accord:${other.id}:${accord.id}`,
                                  affordable: affordable && relationOk && strongerOk,
                                  kind: "accord",
                                })
                              }
                            >
                              <Handshake className="mr-1 h-3 w-3" /> {accord.name}
                            </Button>
                          );
                        })}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[9px]"
                          disabled={!canPay({ ec: 6 })}
                          title="Contested CHA check: +4 EC and +1 relation on success, -2 relation on failure."
                          onClick={() => apply({ id: `bluff:${other.id}`, affordable: canPay({ ec: 6 }), kind: "bluff" })}
                        >
                          Bluff trade
                        </Button>
                        {ESPIONAGE_MISSIONS.map((mission) => {
                          const discount = (kingdom.knownResearch || []).includes("res_espionage") ? 2 : 0;
                          const cost = { ...mission.cost, ic: Math.max(1, (mission.cost.ic || 0) - discount) };
                          return (
                            <Button
                              key={mission.id}
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[9px]"
                              title={mission.detail}
                              disabled={!canPay(cost)}
                              onClick={() =>
                                apply({
                                  id: `espionage:${other.id}:${mission.id}`,
                                  affordable: canPay(cost),
                                  kind: "espionage",
                                })
                              }
                            >
                              <Shield className="mr-1 h-3 w-3" /> {mission.name}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {otherKingdoms.length === 0 && (
                <p className="text-muted-foreground">No other kingdoms exist yet.</p>
              )}
            </div>
          )}

          {tab === "decrees" && (
            <div className="max-h-[48vh] space-y-1 overflow-y-auto rounded-md border p-2">
              {KINGDOM_DECREES.map((decree) => {
                const issued = (kingdom.decrees || []).some((entry) => (entry.id || entry) === decree.id);
                const affordable = canPay(decree.cost);
                return (
                  <div key={decree.id} className="flex flex-wrap items-center gap-1 rounded border px-1.5 py-1 text-[10px]">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{decree.name}</span>
                      <span className="block text-[9px] text-muted-foreground">{decree.detail}</span>
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {Object.entries(decree.cost || {}).map(([k, v]) => `${v} ${k.toUpperCase()}`).join(", ") || "Free"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-1.5 text-[9px]"
                      disabled={issued || !affordable}
                      onClick={() => apply({ id: `decree:${decree.id}`, affordable, kind: "decree" })}
                    >
                      {issued ? "Issued" : "Issue"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "buildings" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="max-h-[48vh] overflow-y-auto rounded-md border p-2 text-[10px]">
                <p className="mb-1 font-semibold">Buildings ({kingdom.buildings?.length || 0})</p>
                {(kingdom.buildings || []).map((building, index) => (
                  <p key={`${building.id}-${index}`} className="border-b py-0.5 last:border-0">
                    <span className="font-medium">{building.name}</span>{" "}
                    <span className="text-muted-foreground">{building.tier} {building.category}</span>
                  </p>
                ))}
                {(kingdom.construction || []).length > 0 && (
                  <>
                    <p className="mt-2 border-t pt-1 font-semibold">Under construction</p>
                    {(kingdom.construction || []).map((project, index) => (
                      <p key={`${project.id}-${index}`} className="border-b py-0.5 last:border-0">
                        <span className="font-medium">{project.name}</span>{" "}
                        <span className="text-muted-foreground">
                          {project.tier} · {project.monthsRemaining}/{project.months} month
                          {project.months === 1 ? "" : "s"} left
                        </span>
                      </p>
                    ))}
                  </>
                )}
              </div>
              <div className="max-h-[48vh] overflow-y-auto rounded-md border p-2 text-[10px]">
                <p className="mb-1 font-semibold">Known research ({kingdom.knownResearch?.length || 0})</p>
                {(kingdom.knownResearch || []).map((id) => {
                  const research = KINGDOM_RESEARCH.find((r) => r.id === id);
                  return <p key={id} className="border-b py-0.5 last:border-0">{research?.name || id}</p>;
                })}
                {(kingdom.knownResearch || []).length === 0 && <p className="text-muted-foreground">None yet.</p>}
              </div>
            </div>
          )}

          {tab === "units" && (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border p-2 text-[10px]">
                  <p className="font-semibold">Units ({kingdom.units?.length || 0})</p>
                  {(kingdom.units || []).map((unit) => (
                    <p key={unit.id} className="border-b py-0.5 last:border-0">
                      {unit.name} · BCR {unit.bcr} · {unit.mp} MP · {unit.damage}
                    </p>
                  ))}
                  {(kingdom.units || []).length === 0 && (
                    <p className="text-muted-foreground">No standing army; a levy forms when battle is joined.</p>
                  )}
                  <p className="mt-1 border-t pt-1 text-muted-foreground">
                    Battle power <span className="font-semibold text-foreground">{battlePower(kingdom)}</span>
                  </p>
                </div>
                <div className="rounded-md border p-2 text-[10px]">
                  <p className="font-semibold">Wars & trade</p>
                  <p>Wars: {(kingdom.wars || []).map((id) => world.kingdoms.find((k) => k.id === id)?.name || id).join(", ") || "None"}</p>
                  <p>Trade: {(kingdom.tradeRoutes || []).map((id) => world.kingdoms.find((k) => k.id === id)?.name || id).join(", ") || "None"}</p>
                  <p>Accords: {(kingdom.accords || []).length}</p>
                  <p>Decrees: {(kingdom.decrees || []).length}</p>
                  <p>Vassals: {(kingdom.vassals || []).map((id) => world.kingdoms.find((k) => k.id === id)?.name || id).join(", ") || "None"}</p>
                  {kingdom.vassalOf && (
                    <p className="text-amber-400">
                      Vassal of {world.kingdoms.find((k) => k.id === kingdom.vassalOf)?.name || kingdom.vassalOf}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-md border p-2 text-[10px]">
                <p className="font-semibold">Caravans</p>
                {(world.caravans || [])
                  .filter(
                    (caravan) =>
                      caravan.fromKingdomId === kingdom.id || caravan.toKingdomId === kingdom.id
                  )
                  .slice(-6)
                  .map((caravan) => {
                    const from = world.settlements.find((s) => s.id === caravan.fromSettlementId);
                    const to = world.settlements.find((s) => s.id === caravan.toSettlementId);
                    return (
                      <div key={caravan.id} className="border-b py-0.5 last:border-0">
                        <div className="flex justify-between">
                          <span className="truncate">
                            {from?.name || "?"} → {to?.name || "?"}
                          </span>
                          <span className="text-muted-foreground">
                            {caravan.status === "arrived" ? "arrived" : `${Math.round((caravan.progress || 0) * 100)}%`}
                          </span>
                        </div>
                        <div className="mt-0.5 h-1 overflow-hidden rounded bg-muted">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${(caravan.progress || 0) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <Select value={caravanTarget || "__none__"} onValueChange={(v) => setCaravanTarget(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-6 w-44 text-[10px]"><SelectValue placeholder="Destination" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Choose destination</SelectItem>
                      {otherKingdoms.map((other) => (
                        <SelectItem key={other.id} value={other.id}>{other.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-6 w-40 text-[10px]"
                    value={caravanCargo}
                    onChange={(e) => setCaravanCargo(e.target.value)}
                    placeholder="Cargo"
                  />
                  <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={sendCaravan} disabled={!caravanTarget}>
                    Send caravan
                  </Button>
                </div>
              </div>
            </div>
          )}

          {tab === "ledger" && (
            <div className="max-h-[48vh] space-y-2 overflow-y-auto rounded-md border p-2 text-[10px]">
              <div className="flex flex-wrap items-center gap-2 rounded border bg-muted/30 p-1.5">
                <span className="font-semibold">Treasury {fmt(kingdom.treasury)} gp</span>
                <span className="text-muted-foreground">
                  Counts and stats are uncapped.
                </span>
              </div>
              {(kingdom.ledger || []).slice().reverse().map((entry, index) => (
                <div key={index} className="rounded border p-1.5">
                  <div className="flex flex-wrap items-left gap-2">
                    <p className="font-semibold">
                      Turn {entry.turn} · {entry.month}/{entry.year}
                    </p>
                    <span className="text-emerald-400">+{fmt(entry.income)} gp</span>
                    <span className="text-red-400">−{fmt(entry.costs)} gp</span>
                    <span className={entry.net >= 0 ? "text-emerald-400" : "text-red-400"}>
                      net {entry.net >= 0 ? "+" : ""}
                      {fmt(entry.net)} gp
                    </span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {(entry.lines || []).map((line, lineIndex) => (
                      <div key={lineIndex} className="flex flex-wrap justify-between gap-1 border-b py-0.5 last:border-0">
                        <span>
                          <span className="text-muted-foreground">
                            {line.kind === "development" ? "Development" : "Settlement"} ·{" "}
                          </span>
                          {line.name}
                        </span>
                        <span className="text-muted-foreground">
                          +{fmt(line.income)} / −{fmt(line.upkeep)} ={" "}
                          <span className={line.net >= 0 ? "text-emerald-400" : "text-red-400"}>
                            {line.net >= 0 ? "+" : ""}
                            {fmt(line.net)} gp
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {(kingdom.ledger || []).length === 0 && (
                <p className="text-muted-foreground">
                  No ledger yet. Take a kingdom turn to record settlement and development income
                  and upkeep.
                </p>
              )}
            </div>
          )}

          {tab === "log" && (
            <div className="max-h-[48vh] space-y-2 overflow-y-auto rounded-md border p-2 text-[10px]">
              {(kingdom.log || []).slice().reverse().map((entry, index) => (
                <div key={index} className="rounded border p-1.5">
                  <p className="font-semibold">Turn {entry.turn} · Month {entry.month} · Year {entry.year}</p>
                  {(entry.lines || []).map((line, i) => (
                    <p key={i} className="text-muted-foreground">{line}</p>
                  ))}
                </div>
              ))}
              {(kingdom.log || []).length === 0 && <p className="text-muted-foreground">No turns taken yet.</p>}
            </div>
          )}
        </div>

        <aside className="space-y-2">
          <div className="rounded-md border p-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Crown</p>
            <p className="text-sm font-semibold">{kingdom.ruler?.name || "Vacant"}</p>
            <p className="text-[10px] text-muted-foreground">
              {kingdom.ruler?.personality?.trait} · {kingdom.ruler?.personality?.background}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Treasury {fmt(kingdom.treasury)} gp · Turn {kingdom.turn} · {kingdom.season}
            </p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Provinces</p>
            {(kingdom.provinces || []).map((province) => (
              <div key={province.id} className="flex justify-between gap-1 border-b py-0.5 text-[10px] last:border-0">
                <span className="truncate">{province.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {province.comfort} · loyalty {kingdom.loyalty?.[province.settlementId] ?? province.loyalty}
                </span>
              </div>
            ))}
          </div>
          <div className="rounded-md border p-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Resources</p>
            <div className="mt-1 grid grid-cols-2 gap-1 text-[10px]">
              {Object.entries(kingdom.resources || {}).map(([name, value]) => (
                <span key={name} className="flex justify-between rounded bg-muted/30 px-1 py-0.5">
                  <span className="capitalize">{name}</span>
                  <span className="font-medium">{value}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Diplomacy</p>
            <div className="mt-1 space-y-0.5 text-[10px]">
              {otherKingdoms.map((other) => (
                <div key={other.id} className="flex justify-between gap-1 border-b py-0.5 last:border-0">
                  <span className="truncate">{other.name}</span>
                  <span
                    className={
                      (kingdom.wars || []).includes(other.id)
                        ? "text-red-400"
                        : relationOf(other) >= 3
                          ? "text-green-400"
                          : "text-muted-foreground"
                    }
                  >
                    {(kingdom.wars || []).includes(other.id)
                      ? "war"
                      : `${relationOf(other) >= 0 ? "+" : ""}${relationOf(other)}`}
                  </span>
                </div>
              ))}
              {(kingdom.accords || []).length > 0 && (
                <p className="pt-1 text-muted-foreground">
                  {(kingdom.accords || []).map((accord) => accord.name || accord.type).join(", ")}
                </p>
              )}
              {(kingdom.decrees || []).length > 0 && (
                <p className="text-muted-foreground">
                  Decrees: {(kingdom.decrees || []).map((decree) => decree.name || decree).join(", ")}
                </p>
              )}
            </div>
          </div>
          <div className="rounded-md border p-2">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recent events</p>
              <span className="text-[9px] text-muted-foreground">
                {(kingdom.activeEvents || []).length} active
              </span>
            </div>
            <div className="mt-1 max-h-72 space-y-1 overflow-y-auto">
              {(kingdom.activeEvents || []).map((active) => {
                const cost = eventResolutionCost(active);
                return (
                  <div
                    key={active.id}
                    className={`rounded border p-1 text-[10px] ${
                      active.positive ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-semibold">{active.name}</p>
                      <span className={active.positive ? "text-emerald-400" : "text-amber-400"}>
                        {active.positive ? "Boon" : "Task"}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{active.ongoing || active.effect}</p>
                    {active.goal && (
                      <p className="mt-0.5">
                        <span className="font-medium">Goal:</span> {active.goal}
                      </p>
                    )}
                    {active.resolveWith && (
                      <p className="mt-0.5">
                        <span className="font-medium">Resolution:</span> {cost} {active.resolveLabel}
                        {active.weeksUnresolved > 0 && (
                          <span className="text-muted-foreground">
                            {" "}· base {active.baseCost} + {active.weeksUnresolved} week{active.weeksUnresolved === 1 ? "" : "s"}
                          </span>
                        )}
                      </p>
                    )}
                    {active.monthsRemaining != null && (
                      <p className="text-muted-foreground">
                        {active.monthsRemaining} month{active.monthsRemaining === 1 ? "" : "s"} remaining
                      </p>
                    )}
                    {active.resolveWith && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1 h-6 text-[10px]"
                        onClick={() => resolveEvent(active.id)}
                      >
                        Resolve · spend {cost} {active.resolveLabel}
                      </Button>
                    )}
                  </div>
                );
              })}
              {(kingdom.eventHistory || [])
                .filter(
                  (entry) =>
                    entry.event?.name &&
                    entry.event.name !== "All is well" &&
                    !(kingdom.activeEvents || []).some((active) => active.id === entry.id)
                )
                .slice(-6)
                .reverse()
                .map((entry, index) => (
                  <p key={entry.id || index} className="border-b py-0.5 text-[10px] last:border-0">
                    <span className="font-medium">{entry.event?.name}</span>{" "}
                    <span className="text-muted-foreground">{entry.event?.effect}</span>
                    <span className="ml-1 text-[9px] uppercase tracking-wide text-muted-foreground/70">
                      {entry.status || "occurred"}
                    </span>
                  </p>
                ))}
              {!(kingdom.activeEvents || []).length &&
                !(kingdom.eventHistory || []).some(
                  (entry) => entry.event?.name && entry.event.name !== "All is well"
                ) && (
                  <p className="text-[10px] text-muted-foreground">
                    No recent events. Run a kingdom turn to see what happens.
                  </p>
                )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
