import { livingStyle, STATIONS, LIVING_QUALITY } from "@/lib/homestead";

// Living quality: what standard of living the property's general size
// supports when used as a primary residence, with the Food, Rest and
// Recovery effects that level grants. The level comes from the living-style
// calculator (the built rooms and the property's comfort tier).
export default function LivingQualityPanel({ plot }) {
  const s = livingStyle(plot);
  const q = LIVING_QUALITY[s.overall] || LIVING_QUALITY.modest;
  const st = STATIONS[s.overall] || STATIONS.modest;
  const fq = LIVING_QUALITY[s.food] || LIVING_QUALITY.squalid;
  const rows = [
    ["Food", s.food === s.overall ? q.food : fq.food],
    ["Rest", q.rest],
    ["Recovery", q.recovery],
  ];
  return (
    <div className="space-y-1.5 rounded-lg border bg-accent/30 p-3 text-xs">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Living quality</p>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground">Residence</span>
        <span className="font-semibold">{st.label}</span>
      </div>
      {rows.map(([label, text]) => (
        <div key={label}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-[11px] leading-relaxed">{text}</p>
        </div>
      ))}
      {q.note && <p className="text-[10px] leading-relaxed text-muted-foreground">{q.note}</p>}
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Resting outside of a property always uses Squalid. The level follows the living
        style the built rooms support — more bedrooms, a kitchen and better facilities raise it.
      </p>
    </div>
  );
}