import { useTree } from "@/lib/treeStore";
import { damageAffinities } from "@/lib/resources";
import { InfoTip } from "@/components/skilltree/InfoTip";

// Damage resistances / immunities / vulnerabilities, shown as three columns
// under Combat & Core. States come from the character's manual toggles and
// from invested nodes' resources named "Resistance: Fire", "Immunity: Fire",
// "Vulnerability: Fire" (etc.). Immunity and vulnerability override
// resistance when both apply.
const COLUMNS = [
  ["resist", "Resistance", "bg-sky-500/15 border-sky-500/40 text-sky-600 dark:text-sky-300"],
  ["immune", "Immunity", "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-300"],
  ["vuln", "Vulnerability", "bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-300"],
];
// Manual cycle order when a chip is clicked.
const NEXT = { none: "resist", resist: "immune", immune: "vuln", vuln: "none" };

export function DamageAffinitiesSection() {
  const { mergedTree: tree, character, setCharacter, settings } = useTree();
  const { states, claims } = damageAffinities(character, tree, settings?.library);
  const libTypes = (settings?.library?.damageTypes || []).filter(Boolean);
  const claimed = Object.keys(states);
  const types = [...new Set([...libTypes, ...claimed])].sort((a, b) =>
    a.localeCompare(b)
  );

  const states_ = character.damageStates || {};
  const cycle = (type) => {
    const cur = states_[type] || "none";
    const next = { ...states_, [type]: NEXT[cur] || "resist" };
    if (next[type] === "none") delete next[type];
    setCharacter({ ...character, damageStates: next });
  };

  const chipFor = (type, cls) => {
    const manual = states_[type] && states_[type] !== "none";
    const fromNode = claims[type] && Object.keys(claims[type].from).includes("talent");
    return (
      <button
        key={type}
        type="button"
        title={`${type} — click to cycle your own state (resist → immune → vulnerable → none)${
          fromNode ? " · also granted by a talent" : ""
        }`}
        onClick={() => cycle(type)}
        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${cls} ${
          manual ? "font-bold" : ""
        }`}
      >
        {type}
      </button>
    );
  };

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Damage Resistance
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {COLUMNS.map(([kind, label, cls]) => (
          <div key={kind} className="rounded-xl border bg-accent/40 p-3">
            <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
              {label}
            </div>
            <div className="flex flex-wrap gap-1">
              {types
                .filter((t) => states[t] === kind)
                .map((t) => chipFor(t, cls))}
              {!types.some((t) => states[t] === kind) && (
                <span className="text-[10px] text-muted-foreground">None.</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
          No state
        </div>
        <div className="flex flex-wrap gap-1">
          {types.filter((t) => !states[t]).map((t) => chipFor(t, "border bg-accent/40 text-muted-foreground"))}
          {!types.some((t) => !states[t]) && (
            <span className="text-[10px] text-muted-foreground">
              Every damage type has a state. Add more in the Damage Types tab of the Reference
              Library.
            </span>
          )}
        </div>
      </div>
      <InfoTip
        label="Click a damage type to cycle your own resistance → immunity → vulnerability → none. Talents grant their own states with resources named e.g. “Resistance: Fire”; immunity and vulnerability override resistance."
      >
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
          Click a damage type to cycle your own state. Talents grant states via resources named
          "Resistance: Fire", "Immunity: Fire" or "Vulnerability: Fire"; immunity and
          vulnerability override resistance.
        </p>
      </InfoTip>
    </section>
  );
}