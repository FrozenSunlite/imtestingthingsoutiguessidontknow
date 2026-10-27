import { bastionFacilityByName, furnishingByName, plotKinds } from "@/lib/homestead";
import { BASTION_ORDERS } from "@/lib/homesteadBastionOrders";
import { businessActions } from "@/lib/homesteadTurns";
import { laborNeeds, laborAssigned } from "@/lib/homesteadLabor";

// The benefits the plot grants, in three sections: every furnishing's rules
// text (Housing), each claimed Bastion special facility's order effect
// (Bastion), and the business earnings the placed rooms unlock (Business).
export default function HomesteadBenefits({ plot }) {
  const byType = new Map();
  const groups = [];
  const add = (type) => {
    const def = furnishingByName(type);
    if (!def) return;
    if (!byType.has(type)) {
      byType.set(type, { def, count: 0 });
      groups.push(byType.get(type));
    }
    byType.get(type).count++;
  };
  for (const fu of plot.furnishings || []) add(fu.type);
  for (const f of plot.facilities || []) {
    for (const key of ["attic", "floor", "cellar"]) {
      for (const it of f[key]?.items || []) add(it.type);
    }
  }

  // Claimed Bastion special facilities with their documented order effect.
  const specials = (plot.facilities || []).filter((f) => f.bastion && BASTION_ORDERS[f.bastion]);
  // Business benefits: the weekly earnings/actions the placed rooms unlock.
  const bizActions = plotKinds(plot).includes("business") ? businessActions(plot) : [];

  // Staffing: rooms that need hirelings only grant their benefits while the
  // required workers are assigned (Labor panel).
  const rows = laborNeeds(plot);
  const rowById = new Map(rows.map((n) => [n.id, n]));
  const shortOfType = (type) => {
    const inst = (plot.furnishings || []).filter((fu) => fu.type === type);
    const short = inst.filter((fu) => {
      const row = rowById.get(fu.id);
      return row && laborAssigned(plot, fu.id) < row.need;
    }).length;
    if (type === "Animal Pen") {
      const pool = rows.find((n) => n.id === "__animal-pens");
      return pool && laborAssigned(plot, pool.id) < pool.need ? inst.length : short;
    }
    return short;
  };

  if (!groups.length && !specials.length && !bizActions.length) {
    return (
      <div className="space-y-1.5 rounded-lg border bg-accent/30 p-3 text-xs">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Benefits</p>
        <p className="text-[11px] text-muted-foreground">Place furnishings and special facilities to see the benefits they grant.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-lg border bg-accent/30 p-3 text-xs">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Benefits</p>
      {groups.length > 0 && (
        <div className="space-y-1.5">
          {groups.map((g) => {
            const short = shortOfType(g.def.name);
            return (
              <div key={g.def.name}>
                <p className="font-medium">{g.def.name}{g.count > 1 ? ` × ${g.count}` : ""}</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{g.def.benefits}</p>
                {short > 0 && (
                  <p className="text-[10px] text-destructive">
                    {short} not fully staffed — assign workers in the Labor panel to gain these benefits.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {specials.length > 0 && (
        <div className="border-t pt-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Bastion benefits</p>
          <div className="mt-1 space-y-1.5">
            {specials.map((f) => {
              const o = BASTION_ORDERS[f.bastion];
              const short = (bastionFacilityByName(f.bastion)?.hirelings || 0) - laborAssigned(plot, f.id);
              return (
                <div key={f.id}>
                  <p className="flex items-baseline justify-between gap-2 font-medium">
                    <span className="truncate">{f.name || f.type}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">Lv {f.level} · {o.order}</span>
                  </p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{o.effect}</p>
                  {short > 0 && (
                    <p className="text-[10px] text-destructive">
                      Needs {short} more hireling{short === 1 ? "" : "s"} assigned — benefits are suspended until staffed.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {bizActions.length > 0 && (
        <div className="border-t pt-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Business benefits</p>
          <div className="mt-1 space-y-1.5">
            {bizActions.map((a) => (
              <div key={a.id}>
                <p className="flex items-baseline justify-between gap-2 font-medium">
                  <span className="truncate">{a.name}</span>
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{a.order}</span>
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}