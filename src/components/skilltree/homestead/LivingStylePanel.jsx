import { livingStyle, STATIONS } from "@/lib/homestead";

// Living style calculator: what standard of living the built rooms support —
// beds, food quality, kitchen capacity, hygiene and storage — shown beside
// the property summary.
export default function LivingStylePanel({ plot }) {
  const s = livingStyle(plot);
  const st = STATIONS[s.overall] || STATIONS.modest;
  const foodSt = STATIONS[s.food] || STATIONS.modest;
  const hygieneBits = [
    s.hygiene.bathhouse && `${s.hygiene.bathhouse} bathhouse${s.hygiene.bathhouse > 1 ? "s" : ""}`,
    s.hygiene.washateria && `${s.hygiene.washateria} washateria${s.hygiene.washateria > 1 ? "s" : ""}`,
    s.hygiene.privy && `${s.hygiene.privy} privy${s.hygiene.privy > 1 ? "s" : ""}`,
  ].filter(Boolean);

  return (
    <div className="space-y-1.5 rounded-lg border bg-accent/30 p-3 text-xs">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Living style</p>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground">Overall</span>
        <span className="font-semibold">{st.label}</span>
      </div>
      <Stat label="Beds (residents)" value={s.beds} />
      {s.kitchenSpaces > 0 ? (
        <Stat label="Kitchen feeds" value={`up to ${s.kitchenSupports} residents`} />
      ) : (
        <p className="text-[11px] font-medium text-destructive">No Kitchen — food drops to Squalid.</p>
      )}
      <Stat label="Food quality" value={foodSt.label} />
      {s.foodFloor === "poor" && s.food !== "poor" && s.food !== "squalid" && (
        <p className="text-[10px] text-muted-foreground">Hens keep it at Poor or better.</p>
      )}
      {s.rationsPerWeek > 0 && (
        <Stat label="Homegrown rations" value={`${s.rationsPerWeek} / week`} />
      )}
      <Stat
        label="Hygiene"
        value={hygieneBits.length ? hygieneBits.join(" · ") : "none built"}
      />
      {s.storageLbs > 0 && <Stat label="Storage" value={`${s.storageLbs.toLocaleString()} lbs`} />}
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Calculated from the placed rooms: one resident per Bedroom space (bunks double it),
        a Kitchen feeds two residents per space, and without one food quality sits at Squalid.
      </p>
    </div>
  );
}

const Stat = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-muted-foreground">{label}</span>
    <span>{value}</span>
  </div>
);