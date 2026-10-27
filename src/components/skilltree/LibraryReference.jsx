import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  CONDITIONS,
  ACTIONS_IN_COMBAT,
  COVER,
  RESTING,
  DEATH_AND_DYING,
  EXHAUSTION,
} from "@/lib/dmReference";

// Quick-reference panel for the DM Screen: static rules tables plus the
// spell list pulled live from the reference library.
export function LibraryReference({ spells }) {
  const [q, setQ] = useState("");
  const matches = spells.filter((s) =>
    (s.name || "").toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="grid auto-rows-min gap-3 lg:grid-cols-2">
        <RefCard title="Conditions" items={CONDITIONS} />
        <RefCard title="Actions in Combat" items={ACTIONS_IN_COMBAT} />
        <RefCard title="Cover" items={COVER} />
        <RefCard title="Resting" items={RESTING} />
        <RefCard title="Death & Dying" items={DEATH_AND_DYING} />
        <RefCard title="Exhaustion" items={EXHAUSTION} />
      </div>

      <section className="rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Spell Library
          </h3>
          <Input
            className="h-8 w-48"
            placeholder="Search spells…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {matches.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {spells.length === 0 ? "No spells in the reference library yet." : "No matches."}
          </p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {matches.map((sp, i) => (
              <div key={i} className="rounded-md border p-2">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs font-semibold">{sp.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {[
                      sp.level === "cantrip" ? "Cantrip" : sp.level ? `${sp.level} level` : "",
                      sp.school,
                      sp.castingTime,
                      sp.range,
                      sp.duration,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                {sp.description && <p className="text-xs leading-snug">{sp.description}</p>}
                {sp.flavor && (
                  <p className="text-xs italic leading-snug text-muted-foreground">{sp.flavor}</p>
                )}
                {sp.upcast && (
                  <p className="text-[10px] text-muted-foreground">At higher levels: {sp.upcast}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// One quick-reference card: a title and name/rule rows.
function RefCard({ title, items }) {
  return (
    <section className="rounded-lg border p-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <dl className="mt-2 space-y-1.5">
        {items.map(([name, text]) => (
          <div key={name}>
            <dt className="text-xs font-semibold">{name}</dt>
            <dd className="text-xs leading-snug text-muted-foreground">{text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}