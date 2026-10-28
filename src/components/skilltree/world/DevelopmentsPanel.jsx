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
  DEVELOPMENT_BY_ID,
  DEVELOPMENT_TERRAIN_LABELS,
  WORLD_DEVELOPMENTS,
  canAffordDevelopment,
  developmentCostText,
  placeDevelopment,
} from "@/lib/worldDevelopments";
import { Construction, MapPin, ScrollText } from "lucide-react";

const STATUS_LABEL = {
  building: "Under construction",
  built: "Built",
  destroyed: "Destroyed",
};

export function DevelopmentsPanel({ world, onChange, onShowMap, onOpenSettlement }) {
  const [kingdomId, setKingdomId] = useState("");
  const [typeId, setTypeId] = useState(WORLD_DEVELOPMENTS[0]?.id || "");
  const [filter, setFilter] = useState("__all__");

  useEffect(() => {
    if (!kingdomId && world?.kingdoms?.length) setKingdomId(world.kingdoms[0].id);
  }, [world, kingdomId]);

  const kingdom = (world?.kingdoms || []).find((item) => item.id === kingdomId) || null;
  const development = DEVELOPMENT_BY_ID[typeId] || null;
  const affordable = kingdom && development ? canAffordDevelopment(kingdom, development) : false;

  const developments = useMemo(() => {
    const list = [...(world?.developments || [])];
    return list
      .filter((entry) => filter === "__all__" || entry.kingdomId === filter)
      .sort((a, b) => {
        const status = (a.status === "building" ? 0 : 1) - (b.status === "building" ? 0 : 1);
        if (status !== 0) return status;
        return (b.builtTurn || 0) - (a.builtTurn || 0);
      });
  }, [world, filter]);

  if (!(world?.kingdoms || []).length) {
    return <p className="text-xs text-muted-foreground">Generate a setting before planting world developments.</p>;
  }

  const build = () => {
    if (!kingdom || !development) return;
    const result = placeDevelopment(world, kingdom.id, development.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onChange?.(result.world);
    toast.success(
      `${development.name} planted on the world map (${development.months} month${development.months === 1 ? "" : "s"}).`
    );
  };

  return (
    <div className="space-y-2">
      <div className="rounded-md border bg-muted/20 p-2 text-[10px] text-muted-foreground">
        <p className="font-semibold text-foreground">World-map developments</p>
        <p>
          These are separate plots planted by a nation, not buildings inside a town or city. Each
          occupies a world-map space. Highways, toll booths and bridge forts need a road or river;
          villages and towns found a new settlement when construction finishes.
        </p>
      </div>

      <div className="grid gap-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-2 rounded-md border p-2">
          <div className="flex items-center gap-1">
            <Construction className="h-3.5 w-3.5" />
            <p className="text-xs font-semibold">Plant a development</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Kingdom</p>
            <Select value={kingdomId} onValueChange={setKingdomId}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {world.kingdoms.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Development</p>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WORLD_DEVELOPMENTS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · {item.months} month{item.months === 1 ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {development && (
            <div className="space-y-1 rounded border p-1.5 text-[10px]">
              <div className="flex flex-wrap gap-2">
                <span className="font-semibold">{development.name}</span>
                <span className="text-muted-foreground">{development.category}</span>
                <span className="ml-auto">{developmentCostText(development)}</span>
              </div>
              <p className="text-muted-foreground">{development.benefit}</p>
              <div className="flex flex-wrap gap-2 text-[9px] text-muted-foreground">
                <span>
                  Terrain: {DEVELOPMENT_TERRAIN_LABELS[development.terrain] || development.terrain}
                </span>
                <span>Build: {development.months} month{development.months === 1 ? "" : "s"}</span>
                {development.tech != null && <span>Tech: {development.tech}+</span>}
                {development.requiresRoute && <span>Requires highway/road</span>}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-6 text-[10px]" disabled={!affordable} onClick={build}>
                  Plant development
                </Button>
                <span className={affordable ? "text-muted-foreground" : "text-destructive"}>
                  {affordable
                    ? "The kingdom can pay the cost."
                    : `Needs ${developmentCostText(development)} in the kingdom counts.`}
                </span>
              </div>
            </div>
          )}
          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={onShowMap}>
            <MapPin className="mr-1 h-3 w-3" /> Show on world map
          </Button>
        </div>

        <div className="space-y-1 rounded-md border p-2">
          <div className="flex flex-wrap items-center gap-1">
            <p className="text-xs font-semibold">Planted plots ({developments.length})</p>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="ml-auto h-6 w-44 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All kingdoms</SelectItem>
                {world.kingdoms.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-[56vh] space-y-1 overflow-y-auto">
            {developments.map((entry) => {
              const nation = world.nations.find((item) => item.id === entry.nationId);
              const settlement = world.settlements.find((item) => item.id === entry.settlementId);
              return (
                <div key={entry.id} className="rounded border p-1.5 text-[10px]">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="font-semibold">{entry.name}</span>
                    <span className="text-muted-foreground">{entry.category}</span>
                    <span
                      className={`rounded px-1 py-0.5 text-[9px] ${
                        entry.status === "building"
                          ? "bg-amber-500/15 text-amber-400"
                          : entry.status === "destroyed"
                            ? "bg-red-500/15 text-red-400"
                            : "bg-green-500/15 text-green-400"
                      }`}
                    >
                      {STATUS_LABEL[entry.status] || entry.status}
                      {entry.status === "building" ? ` · ${entry.monthsRemaining}/${entry.months}` : ""}
                    </span>
                    <span className="ml-auto text-muted-foreground">{nation?.name || ""}</span>
                  </div>
                  <p className="text-muted-foreground">{entry.benefit}</p>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-[9px] text-muted-foreground">
                    <span>
                      {entry.biomeLabel || entry.biome} · {entry.terrain}
                    </span>
                    <span>
                      Map {Math.round(entry.x)}, {Math.round(entry.y)}
                    </span>
                    {entry.mpDamage ? <span>MP damage {entry.mpDamage}</span> : null}
                    {entry.armor ? <span>Armor {entry.armor}</span> : null}
                    {settlement && (
                      <button
                        type="button"
                        className="underline"
                        onClick={() => onOpenSettlement?.(settlement.id)}
                      >
                        Open {settlement.name}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {developments.length === 0 && (
              <p className="p-2 text-[10px] text-muted-foreground">
                No developments planted yet. Choose a kingdom and development above.
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="flex items-center gap-1 text-[9px] text-muted-foreground">
        <ScrollText className="h-3 w-3" /> Developments advance during kingdom turns. Villages and
        towns create a new settlement when their build time completes.
      </p>
    </div>
  );
}
