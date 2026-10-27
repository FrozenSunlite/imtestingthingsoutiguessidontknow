import { Input } from "@/components/ui/input";

// View-page "Senses" section, shown above Hit Points: sense ranges with
// talent and node contributions. Nodes modify a sense by adding a resource
// named after it (e.g. "Darkvision"); new sense types can be defined in the
// Reference Library.
export function SensesSection({ sheet, character, setCharacter, senses }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Senses
      </h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {(senses || []).map((s) => {
          const d = sheet[s] || {};
          const base = (character.senses || {})[s] ?? 0;
          return (
            <div key={s} className="rounded-xl border bg-accent/40 px-3 py-2.5 text-center">
              <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                {s}
              </div>
              <div className="mt-0.5 text-lg font-bold leading-tight">
                {d.final ?? base}{" "}
                <span className="text-[10px] font-medium text-muted-foreground">spaces</span>
              </div>
              {Number(d.adds) > 0 && (
                <div className="text-[10px] font-semibold text-emerald-600">
                  +{d.adds} from talents
                </div>
              )}
              <Input
                type="number"
                className="mx-auto mt-1.5 h-7 w-16 text-center text-xs"
                title={`Base ${String(s).toLowerCase()} range`}
                value={base}
                onChange={(e) =>
                  setCharacter({
                    ...character,
                    senses: { ...(character.senses || {}), [s]: Math.max(0, Number(e.target.value) || 0) },
                  })
                }
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}