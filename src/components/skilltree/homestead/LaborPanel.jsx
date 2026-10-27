import { Button } from "@/components/ui/button";
import { laborNeeds, laborAssigned, laborAssignedTotal } from "@/lib/homesteadLabor";

// Labor assigner: spreads the plot's hired staff across the locations that
// need workers — business rooms, Bastion facilities and staffed home rooms.
// An action or order only runs once its location is fully staffed.
export default function LaborPanel({ plot, update }) {
  const needs = laborNeeds(plot);
  const free = (plot.staff || 0) - laborAssignedTotal(plot);

  const assign = (row, delta) =>
    update((p) => {
      const labor = { ...(p.labor || {}) };
      const val = labor[row.id] || 0;
      let next = val + delta;
      if (delta > 0 && free <= 0) return p; // no unassigned workers left
      next = Math.max(0, Math.min(next, row.need));
      if (next === val) return p;
      labor[row.id] = next;
      return { ...p, labor };
    });

  return (
    <div className="space-y-1.5 rounded-lg border bg-accent/30 p-3 text-xs">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Labor</p>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground">Hired staff</span>
        <span className="font-semibold">{plot.staff || 0}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground">Unassigned</span>
        <span className="font-semibold">{free}</span>
      </div>
      {(plot.staff || 0) === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Hire staff in the Property settings panel, then assign them here.
        </p>
      )}
      {needs.length === 0 ? (
        (plot.staff || 0) > 0 && (
          <p className="text-[11px] text-muted-foreground">No placed location needs workers yet.</p>
        )
      ) : (
        <div className="space-y-1 border-t pt-1.5">
          {needs.map((row) => {
            const have = laborAssigned(plot, row.id);
            return (
              <div key={row.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.label}</p>
                  <p className="text-[10px] text-muted-foreground">needs {row.need} · {row.kind}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline" size="sm" className="h-5 w-5 p-0 text-[10px]"
                    disabled={have === 0} onClick={() => assign(row, -1)}
                  >
                    −
                  </Button>
                  <span className="w-4 text-center font-medium">{have}</span>
                  <Button
                    variant="outline" size="sm" className="h-5 w-5 p-0 text-[10px]"
                    disabled={free <= 0 || have >= row.need} onClick={() => assign(row, 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        Business, Bastion and home actions run only when their location is fully staffed.
      </p>
    </div>
  );
}