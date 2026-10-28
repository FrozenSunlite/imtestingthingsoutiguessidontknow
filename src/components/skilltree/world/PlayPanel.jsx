import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Backpack,
  Coins,
  Compass,
  Footprints,
  Hammer,
  MapPin,
  ScrollText,
  ShieldAlert,
  Swords,
  Tent,
  Users,
} from "lucide-react";
import {
  DOWNTIME_ACTIONS,
  abandonDelve,
  buyGood,
  claimTravelVictory,
  clearDelveRoom,
  clearPendingEncounter,
  destinationOptions,
  ensurePlayer,
  exploreDelveRoom,
  marketFor,
  performDowntime,
  playerKingdom,
  playerSettlement,
  rumorsFor,
  sellGood,
  startDelve,
  travelTo,
} from "@/lib/player";
import {
  acceptQuest,
  advanceQuest,
  completeQuest,
  questsForSettlement,
} from "@/lib/questGen";
import { timeLabel } from "@/lib/worldSim";

const fmt = (value) => Number(value || 0).toLocaleString();

function Card({ title, icon: Icon, children, className = "" }) {
  return (
    <div className={`rounded-md border p-2 ${className}`}>
      <div className="flex items-center gap-1">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <p className="text-xs font-semibold">{title}</p>
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function PlayPanel({
  world,
  character,
  settings,
  onChange,
  onStartCombat,
  onOpenKingdom,
}) {
  const player = world?.player || ensurePlayer(world, character).player;
  const settlement = playerSettlement(world, player);
  const kingdom = playerKingdom(world, player);
  const destinations = useMemo(
    () => destinationOptions(world, player),
    [world, player]
  );
  const [destinationId, setDestinationId] = useState("");
  const market = useMemo(
    () => (settlement ? marketFor(world, settlement.id, player) : null),
    [world, settlement?.id, player]
  );
  const rumors = useMemo(
    () => (settlement ? rumorsFor(world, settlement.id) : []),
    [world, settlement?.id]
  );
  const localQuests = useMemo(
    () =>
      settlement
        ? questsForSettlement(world, settlement.id)
            .filter((quest) => quest.status !== "complete")
            .slice(0, 8)
        : [],
    [world, settlement?.id]
  );
  const pending = player?.pendingEncounter || null;
  const combatWon =
    world?.combat?.finished && world?.combat?.winner === "party";
  const combatLost =
    world?.combat?.finished && world?.combat?.winner === "enemy";
  const delve = player?.delve || null;

  useEffect(() => {
    if (!destinations.length) {
      setDestinationId("");
      return;
    }
    if (!destinations.some((item) => item.settlement.id === destinationId)) {
      setDestinationId(destinations[0].settlement.id);
    }
  }, [destinations, destinationId]);

  const commit = (nextWorld) => onChange?.(nextWorld);

  const handleTravel = () => {
    const result = travelTo(world, destinationId, {
      character,
      monsters: settings?.library?.monsters || [],
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    commit(result.world);
    toast.success(
      `Arrived at ${result.destination?.name || "your destination"} after ${result.days} day${result.days === 1 ? "" : "s"} (${result.cost} gp).`
    );
    if (result.encounter) {
      toast.warning("An encounter found you on the road. Open the encounter card.");
    }
  };

  const handleFightPending = () => {
    if (!pending?.rows?.length) return;
    commit({ ...world, combat: null });
    onStartCombat?.(pending.rows, pending.name);
    toast.info("Encounter staged. Fight it out, then return to Play to claim the result.");
  };

  const handleClaimPending = () => {
    const result = claimTravelVictory(world, { character });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    commit(result.world);
    toast.success(result.message);
  };

  const handleRetreat = () => {
    commit(clearPendingEncounter(world));
    toast.info("You slipped away from the encounter.");
  };

  const handleBuy = (good) => {
    const result = buyGood(world, settlement.id, good.id, 1);
    if (result.error) toast.error(result.error);
    else {
      commit(result.world);
      toast.success(result.message);
    }
  };

  const handleSell = (good) => {
    const result = sellGood(world, settlement.id, good.id, 1);
    if (result.error) toast.error(result.error);
    else {
      commit(result.world);
      toast.success(result.message);
    }
  };

  const handleDowntime = (action) => {
    const result = performDowntime(world, action.id, { character });
    if (result.error) toast.error(result.error);
    else {
      commit(result.world);
      toast.success(result.message);
    }
  };

  const handleQuest = (quest) => {
    if (quest.status === "available" || quest.status === "rumored") {
      commit(acceptQuest(world, quest.id));
      toast.success(`Accepted: ${quest.title}`);
      return;
    }
    if (quest.status === "active") {
      commit(advanceQuest(world, quest.id));
      toast.success(`Advanced: ${quest.title}`);
      return;
    }
    if (quest.status === "ready") {
      const reward = Number(quest.rewardGold) || 0;
      const next = completeQuest(world, quest.id);
      const withPlayer = ensurePlayer(next, character);
      commit({
        ...withPlayer,
        player: {
          ...withPlayer.player,
          gold: withPlayer.player.gold + reward,
          log: [
            ...(withPlayer.player.log || []),
            {
              at: new Date().toISOString(),
              text: `Completed ${quest.title} and collected ${reward} gp.`,
            },
          ],
        },
      });
      toast.success(`Completed ${quest.title}: +${reward} gp.`);
    }
  };

  const handleStartDelve = () => {
    const result = startDelve(world, {
      character,
      monsters: settings?.library?.monsters || [],
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    commit(result.world);
    toast.success(`Delve started: ${result.delve.name} (rank ${result.delve.rank}).`);
  };

  const handleExploreRoom = (room) => {
    const result = exploreDelveRoom(world, room.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.empty) {
      const cleared = clearDelveRoom(result.world, room.id);
      commit(cleared.world);
      toast.success(cleared.message);
      return;
    }
    commit({ ...result.world, combat: null });
    onStartCombat?.(result.monsters, `${delve?.name || "Delve"} - ${room.name}`);
    toast.info("Room encounter staged. Return to Play to clear the room after the fight.");
  };

  const handleClearRoom = (room) => {
    const result = clearDelveRoom(world, room.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    commit({ ...result.world, combat: null });
    toast.success(result.message);
  };

  const handleAbandonDelve = () => {
    commit(abandonDelve(world));
    toast.info("You left the delve.");
  };

  const selectedDestination = destinations.find(
    (item) => item.settlement.id === destinationId
  );
  const travelCost = selectedDestination
    ? Math.max(1, Math.round(selectedDestination.days * 1.5))
    : 0;

  return (
    <div className="space-y-2">
      <div className="rounded-md border bg-muted/20 p-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {player.name} <span className="text-muted-foreground">· level {player.level}</span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              {settlement ? `${settlement.name} · ${settlement.typeLabel}` : "On the road"} ·{" "}
              {kingdom?.name || "no kingdom"} · {timeLabel(world)}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1 rounded border px-1.5 py-1">
              <Coins className="h-3 w-3" /> {fmt(player.gold)} gp
            </span>
            <span className="flex items-center gap-1 rounded border px-1.5 py-1">
              <Backpack className="h-3 w-3" />{" "}
              {(player.inventory || []).reduce(
                (sum, item) => sum + (Number(item.qty) || 0),
                0
              )}{" "}
              items
            </span>
            <span className="flex items-center gap-1 rounded border px-1.5 py-1">
              <Users className="h-3 w-3" /> party of 4
            </span>
          </div>
        </div>
      </div>

      {pending && (
        <Card
          title={combatWon ? "Road victory" : "Encounter on the road"}
          icon={Swords}
          className="border-amber-500/40 bg-amber-500/5"
        >
          <p className="text-[11px]">{pending.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {(pending.rows || [])
              .map((row) => `${row.count} x ${row.monster}`)
              .join(", ") || "Something is waiting on the road."}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {combatWon ? (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleClaimPending}>
                Claim victory
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleFightPending}>
                <Swords className="mr-1 h-3.5 w-3.5" /> Fight
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleRetreat}>
              {combatLost ? "Retreat" : "Avoid"}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
        <div className="space-y-2">
          <Card title="Travel" icon={Compass}>
            <div className="flex flex-wrap items-end gap-1">
              <div className="min-w-0 flex-1">
                <p className="mb-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                  Destination
                </p>
                <Select value={destinationId} onValueChange={setDestinationId}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Choose a destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinations.map(({ settlement: place, days }) => (
                      <SelectItem key={place.id} value={place.id}>
                        {place.name} · {days} day{days === 1 ? "" : "s"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={handleTravel}
                disabled={!destinationId || !destinations.length}
              >
                <Footprints className="mr-1 h-3.5 w-3.5" /> Travel
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {selectedDestination
                ? `${selectedDestination.days} day${selectedDestination.days === 1 ? "" : "s"} · about ${travelCost} gp · ${selectedDestination.distance} map units. Travel advances the world clock and can trigger a road encounter.`
                : "No other settlements are known."}
            </p>
          </Card>

          {settlement && (
            <>
              <Card title={`Market · ${settlement.name}`} icon={Coins}>
                {market?.notes?.length > 0 && (
                  <ul className="mb-1 space-y-0.5 text-[10px] text-amber-300">
                    {market.notes.map((note) => (
                      <li key={note}>• {note}</li>
                    ))}
                  </ul>
                )}
                <div className="max-h-56 overflow-y-auto">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-2 text-[9px] uppercase tracking-wide text-muted-foreground">
                    <span>Good</span>
                    <span>Buy</span>
                    <span>Sell</span>
                  </div>
                  {(market?.goods || []).map((good) => (
                    <div
                      key={good.id}
                      className="mt-0.5 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 border-b py-0.5 text-[10px] last:border-0"
                    >
                      <span className="min-w-0 truncate" title={good.name}>
                        {good.name}
                        <span className="ml-1 text-muted-foreground">
                          ({good.owned} owned · {good.qty} stock)
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1 text-[9px]"
                        onClick={() => handleBuy(good)}
                        disabled={good.qty < 1 || player.gold < good.buy}
                      >
                        {good.buy} gp
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1 text-[9px]"
                        onClick={() => handleSell(good)}
                        disabled={good.owned < 1}
                      >
                        {good.sell} gp
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid gap-2 sm:grid-cols-2">
                <Card title="Downtime" icon={Hammer}>
                  <div className="space-y-1">
                    {DOWNTIME_ACTIONS.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className="w-full rounded border px-1.5 py-1 text-left text-[10px] hover:bg-accent"
                        onClick={() => handleDowntime(action)}
                        disabled={player.gold < action.cost}
                        title={action.detail}
                      >
                        <span className="font-medium">{action.label}</span>
                        <span className="ml-1 text-muted-foreground">
                          {action.days}d{action.cost ? ` · ${action.cost} gp` : ""}
                        </span>
                        <span className="block text-[9px] text-muted-foreground">
                          {action.detail}
                        </span>
                      </button>
                    ))}
                  </div>
                </Card>

                <Card title="Rumors" icon={ScrollText}>
                  <div className="max-h-56 space-y-1 overflow-y-auto">
                    {rumors.map((rumor, index) => (
                      <p key={index} className="rounded bg-muted/30 px-1.5 py-1 text-[10px]">
                        {rumor}
                      </p>
                    ))}
                    {rumors.length === 0 && (
                      <p className="text-[10px] text-muted-foreground">No rumors yet.</p>
                    )}
                  </div>
                </Card>
              </div>

              <Card title="Quest board" icon={ScrollText}>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {localQuests.map((quest) => (
                    <div
                      key={quest.id}
                      className="flex flex-wrap items-center gap-1 rounded border px-1.5 py-1 text-[10px]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{quest.title}</p>
                        <p className="truncate text-muted-foreground">
                          {quest.summary || quest.description || quest.type}
                        </p>
                      </div>
                      <span className="text-muted-foreground">{quest.status}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[9px]"
                        onClick={() => handleQuest(quest)}
                      >
                        {quest.status === "available" && "Accept"}
                        {quest.status === "active" && "Advance"}
                        {quest.status === "ready" && "Complete"}
                        {quest.status === "rumored" && "Accept"}
                      </Button>
                    </div>
                  ))}
                  {localQuests.length === 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      No local quests. Check the Quests tab for the full board.
                    </p>
                  )}
                </div>
              </Card>

              <Card title="Delve" icon={Tent}>
                {!delve && (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] text-muted-foreground">
                      Search the ruins, barrows and caves near {settlement.name}. A delve scales to your level and can bring coin, loot and danger.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={handleStartDelve}
                    >
                      <Swords className="mr-1 h-3.5 w-3.5" /> Search for a delve
                    </Button>
                  </div>
                )}
                {delve && (
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <p className="text-[11px] font-medium">
                        {delve.name} <span className="text-muted-foreground">· rank {delve.rank}</span>
                      </p>
                      <span className="ml-auto text-[9px] text-muted-foreground">
                        {delve.rooms.filter((room) => room.cleared).length}/{delve.rooms.length} cleared ·{" "}
                        {delve.payout?.text || ""}
                      </span>
                    </div>
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {delve.rooms.map((room) => (
                        <div
                          key={room.id}
                          className="flex flex-wrap items-center gap-1 rounded border px-1.5 py-1 text-[10px]"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">
                              {room.name} <span className="text-muted-foreground">· {room.category}</span>
                            </p>
                            <p className="truncate text-muted-foreground">
                              {room.spawns?.join(", ") || "Quiet room"}
                              {room.loot?.length ? ` · Loot: ${room.loot.join(", ")}` : ""}
                            </p>
                          </div>
                          {room.cleared ? (
                            <span className="text-emerald-400">cleared</span>
                          ) : room.inProgress && combatWon ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[9px]"
                              onClick={() => handleClearRoom(room)}
                            >
                              Clear room
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[9px]"
                              onClick={() => handleExploreRoom(room)}
                            >
                              {room.inProgress ? "Fight again" : "Explore"}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {delve.completed && (
                        <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] text-emerald-300">
                          Delve complete
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[9px]"
                        onClick={handleAbandonDelve}
                      >
                        Leave delve
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Card title="Pack" icon={Backpack}>
            <div className="max-h-52 space-y-0.5 overflow-y-auto text-[10px]">
              {(player.inventory || []).map((item) => (
                <div key={item.id} className="flex justify-between gap-1 border-b py-0.5 last:border-0">
                  <span className="truncate">{item.name}</span>
                  <span className="text-muted-foreground">x{item.qty}</span>
                </div>
              ))}
              {(player.inventory || []).length === 0 && (
                <p className="text-muted-foreground">Nothing but lint and courage.</p>
              )}
            </div>
          </Card>

          <Card title="Journal" icon={MapPin}>
            <div className="max-h-64 space-y-1 overflow-y-auto text-[10px]">
              {(player.log || [])
                .slice(-12)
                .reverse()
                .map((entry, index) => (
                  <p key={index} className="border-b py-0.5 text-muted-foreground last:border-0">
                    {entry.text}
                  </p>
                ))}
              {(player.log || []).length === 0 && (
                <p className="text-muted-foreground">Your story starts here.</p>
              )}
            </div>
          </Card>

          {kingdom && (
            <Card title="Kingdom" icon={ShieldAlert}>
              <p className="text-[10px]">
                {kingdom.name} · {kingdom.government} · turn {kingdom.turn}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {(kingdom.activeEvents || []).length} active event
                {(kingdom.activeEvents || []).length === 1 ? "" : "s"} ·{" "}
                {(kingdom.construction || []).length} project
                {(kingdom.construction || []).length === 1 ? "" : "s"} underway
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 h-6 text-[9px]"
                onClick={() => onOpenKingdom?.(kingdom.id)}
              >
                Open Kingdoms
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
