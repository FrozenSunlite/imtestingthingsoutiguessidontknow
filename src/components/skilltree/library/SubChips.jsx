import { cn } from "@/lib/utils";

// A row of small category chips with an "All" chip first — used to split a
// library tab into sub-pages (per rarity, armor type, vehicle category…).
export function SubChips({ values, value, onChange, className }) {
  const all = ["__all__", ...(values || []).filter(Boolean)];
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {all.map((v) => {
        const active = (value || "__all__") === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-accent/40 text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {v === "__all__" ? "All" : v}
          </button>
        );
      })}
    </div>
  );
}

// True when the entry passes the sub-chip filter ("__all__" shows everything).
export function matchesSub(value, filter) {
  return !filter || filter === "__all__" || (value || "") === filter;
}