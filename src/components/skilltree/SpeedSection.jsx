import { Input } from "@/components/ui/input";
import { CapacityBar } from "./CapacityBar";

// One movement cell: the final value (base + talent contributions) in spaces
// plus a small input for the character's base value.
function MovementCell({ label, final, base, adds, notes, onBase, unit = "spaces" }) {
  return (
    <div className="rounded-xl border bg-accent/40 px-3 py-2.5 text-center">
      <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-bold leading-tight">
        {final}
        <span className="ml-1 text-[10px] font-normal text-muted-foreground">{unit}</span>
      </div>
      {Number(adds) > 0 && (
        <div className="text-[10px] font-semibold text-emerald-600">+{adds} from talents</div>
      )}
      {(notes || []).map((n) => (
        <div key={n} className="text-[10px] text-orange-500">
          {n}
        </div>
      ))}
      <Input
        type="number"
        className="mx-auto mt-1.5 h-7 w-16 text-center text-xs"
        title={`Base ${String(label).toLowerCase()}`}
        value={base}
        onChange={(e) => onBase(e.target.value)}
      />
    </div>
  );
}

// View-page "Speed" section, shown above Hit Points: every speed type in
// spaces (Standard, Climbing, Swimming, Flying, Burrowing — more types can be
// defined in the Reference Library), horizontal and vertical jump distance,
// and the encumbrance bar. Each row's final value includes talent and node
// contributions (resource name = the row label, e.g. "Climbing Speed").
export function SpeedSection({ sheet, character, setCharacter, tree, types, enc }) {
  const speedCell = (t) => {
    const isStd = t === "Standard";
    const d = isStd ? sheet["Speed"] || {} : sheet[`${t} Speed`] || {};
    const base = isStd ? character.speed ?? 6 : (character.speeds || {})[t] ?? 0;
    const notes = [];
    if (isStd && d.encPenalty > 0) notes.push(`−${d.encPenalty} encumbered`);
    if (isStd && d.smallPenalty > 0) notes.push(`−${d.smallPenalty} small`);
    if (isStd && d.exhaustPenalty > 0) notes.push(`−${d.exhaustPenalty} exhaustion`);
    if (isStd && d.exertPenalty > 0) notes.push(`−${d.exertPenalty} exertion`);
    return (
      <MovementCell
        key={t}
        label={t}
        final={d.final ?? base}
        base={base}
        adds={d.adds || 0}
        notes={notes}
        onBase={(v) =>
          isStd
            ? setCharacter({ ...character, speed: Math.max(0, Number(v) || 0) })
            : setCharacter({
                ...character,
                speeds: { ...(character.speeds || {}), [t]: Math.max(0, Number(v) || 0) },
              })
        }
      />
    );
  };
  const jumpCell = (label, field, dflt) => {
    const d = sheet[label] || {};
    const base = character[field] ?? dflt;
    return (
      <MovementCell
        key={label}
        label={label}
        final={d.final ?? base}
        base={base}
        adds={d.adds || 0}
        onBase={(v) => setCharacter({ ...character, [field]: Math.max(0, Number(v) || 0) })}
      />
    );
  };
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Speed
      </h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        {(types || []).map(speedCell)}
        {jumpCell("Horizontal Jump", "jumpH", 2)}
        {jumpCell("Vertical Jump", "jumpV", 1)}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <CapacityBar character={character} tree={tree} carried={enc.weight} capacity={enc.max} />
        </div>
        <span className="whitespace-nowrap text-[11px] text-muted-foreground">
          {Math.round(enc.weight)} / {enc.light} light · {enc.heavy} heavy · {enc.max} max
        </span>
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Encumbrance: −2 spaces of speed past light load, −4 past heavy. Toggle tracking in the
        Carry calculator (Inventory tab).
      </p>
    </section>
  );
}