import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { plotTotals, plotUpkeep, STATIONS, plotBoundary } from "@/lib/homestead";

// Right-panel totals for the active plot: gold, build time, spaces and basic
// facility counts against the comfort level's guideline, the expandable land
// boundary (25 gp × the boundary's new size), plus monthly upkeep.
export default function HomesteadSummary({ plot, update }) {
  const t = plotTotals(plot);
  const up = plotUpkeep(plot);
  const st = STATIONS[plot.comfort] || STATIONS.modest;
  const isLand = plot.ownership === "land";
  const land = (STATIONS[plot.landTier] || st).land;
  const upkeepTotal = Math.round((up.utilities + up.taxes + up.staff + up.privies) * 100) / 100;
  const cap = isLand ? land.spaces : null;
  const boundary = plotBoundary(plot);
  const tiles = plot.landTiles || 0;
  const landGold = plot.landGold ?? tiles * 25;
  const wallSpaces = (plot.walls || []).reduce((n, wl) => n + wl.w * wl.h, 0);
  // Claimed Bastion special facilities on the plot (they bypass gold/time).
  const specials = (plot.facilities || []).filter((f) => f.bastion);

  // Buying a tile costs 25 gp × the boundary's new size in that direction —
  // 2×2 → 3×2 is 75 gp, 3×2 → 4×2 is 100 gp, 4×2 → 4×3 is 125 gp, and so on.
  const expandCost = (dir) => 25 * (plotBoundary(plot)[dir] + 1);
  const expand = (dir) => {
    const cost = expandCost(dir);
    update((p) => ({
      ...p,
      boundary: { ...plotBoundary(p), [dir]: plotBoundary(p)[dir] + 1 },
      landTiles: (p.landTiles || 0) + 1,
      landGold: (p.landGold ?? (p.landTiles || 0) * 25) + cost,
    }));
  };

  // Sell a purchased tile back: 25 gp each, refused while anything sits
  // outside the smaller boundary.
  const shrink = (dir) => {
    if (!(plot.landTiles > 0)) {
      toast("You only own the tiles that came with the plot — sell a tile you bought first.");
      return;
    }
    const b = plotBoundary(plot);
    const w = dir === "w" ? b.w - 1 : b.w;
    const h = dir === "h" ? b.h - 1 : b.h;
    if (w < 2 || h < 2) {
      toast("A boundary can't shrink below 2×2 spaces.");
      return;
    }
    const outside =
      (plot.facilities || []).some((f) => f.x + f.w > w || f.y + f.h > h) ||
      (plot.furnishings || []).some((fu) =>
        !(plot.facilities || []).some((f) => f.id === fu.facilityId) && (fu.x + fu.w > w || fu.y + fu.h > h)
      ) ||
      (plot.connections || []).some((c) => c.x >= w || c.y >= h) ||
      (plot.walls || []).some((wl) => wl.x + wl.w > w || wl.y + wl.h > h);
    if (outside) {
      toast("Move the items outside the smaller boundary before selling this tile.");
      return;
    }
    update((p) => ({
      ...p,
      boundary: { ...plotBoundary(p), ...(dir === "w" ? { w } : { h }) },
      landTiles: Math.max(0, (p.landTiles || 0) - 1),
      landGold: Math.max(0, (p.landGold ?? (p.landTiles || 0) * 25) - 25),
    }));
    toast("Sold a land tile — 25 gp back.");
  };

  return (
    <div className="space-y-1.5 rounded-lg border bg-accent/30 p-3 text-xs">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Property summary</p>
      <Stat label="Construction cost" value={`${t.gp.toLocaleString()} gp`} />
      <Stat label="Build time" value={`${t.weeks} week${t.weeks === 1 ? "" : "s"}`} />
      <Stat
        label={isLand ? "Spaces developed" : "Spaces used"}
        value={cap != null ? `${t.spaces.toLocaleString()} / ${land.spaces.toLocaleString()}` : `${t.spaces.toLocaleString()}`}
      />
      {tiles > 0 && (
        <Stat label={`Land tiles (${tiles})`} value={`${landGold.toLocaleString()} gp spent`} />
      )}
      {!isLand && (
        <div className="pt-0.5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Basic facilities (V / R / C)</p>
          <p className="text-xs font-medium">
            {t.facCounts.Vast} / {t.facCounts.Roomy} / {t.facCounts.Cramped}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Guide for {st.label}: {st.fac[0]} / {st.fac[1]} / {st.fac[2]}
          </p>
        </div>
      )}
      {specials.length > 0 && (
        <div className="pt-0.5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Special facilities</p>
          <ul className="mt-0.5 space-y-0.5">
            {specials.map((f) => (
              <li key={f.id} className="flex items-baseline justify-between gap-2">
                <span className="truncate font-medium">{f.name || f.type}</span>
                <span className="shrink-0 text-muted-foreground">Lv {f.level}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-1 border-t pt-1.5" />
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Property boundary</p>
      <Stat label="Owned land" value={`${boundary.w} × ${boundary.h} spaces`} />
      <div className="grid grid-cols-2 gap-1">
        <Button variant="outline" size="sm" className="h-6 px-1 text-[10px]" onClick={() => expand("w")}>
          +1 wide · {expandCost("w")} gp
        </Button>
        <Button variant="outline" size="sm" className="h-6 px-1 text-[10px]" onClick={() => expand("h")}>
          +1 tall · {expandCost("h")} gp
        </Button>
        <Button variant="outline" size="sm" className="h-6 px-1 text-[10px]" onClick={() => shrink("w")}>
          −1 wide (sell)
        </Button>
        <Button variant="outline" size="sm" className="h-6 px-1 text-[10px]" onClick={() => shrink("h")}>
          −1 tall (sell)
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        A new tile costs 25 gp × the boundary's new size in that direction — 2×2 → 3×2 is 75 gp, 3×2 → 4×2 is 100 gp, 4×2 → 4×3 is 125 gp, and so on. Shrinking sells a purchased tile back for 25 gp — nothing may sit outside the smaller boundary.
      </p>
      {wallSpaces > 0 && (
        <Stat label="Walls & fences" value={`${wallSpaces} space${wallSpaces === 1 ? "" : "s"}`} />
      )}
      <div className="mt-1 border-t pt-1.5" />
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Monthly upkeep</p>
      <Stat label="Property value" value={`${up.value.toLocaleString()} gp`} />
      <Stat label="Utilities (0.25%)" value={`${up.utilities.toLocaleString()} gp`} />
      <Stat label="Taxes (1%)" value={`${up.taxes.toLocaleString()} gp`} />
      {plot.staff > 0 && <Stat label={`Staff (${plot.staff})`} value={`${up.staff} gp`} />}
      {up.privies > 0 && <Stat label="Privy cleaning" value={`${up.privies} gp`} />}
      <Stat label="Total / month" value={`${upkeepTotal.toLocaleString()} gp`} font />
      {plot.ownership === "mortgaged" && (
        <p className="mt-1 border-t pt-1.5 text-[11px] text-muted-foreground">
          Mortgage: {plot.mortgagePaid || 0} / {plot.mortgageTotal || 0} gp paid — {(plot.mortgageTotal || 0) - (plot.mortgagePaid || 0)} gp remains.
        </p>
      )}
    </div>
  );
}

const Stat = ({ label, value, font }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-muted-foreground">{label}</span>
    <span className={font ? "font-semibold" : ""}>{value}</span>
  </div>
);