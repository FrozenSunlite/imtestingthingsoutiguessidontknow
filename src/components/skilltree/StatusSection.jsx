import {
  useTree,
  aggregateResources,
  statVars,
  profBonusFor,
} from "@/lib/treeStore";
import { derivedSheet, EXERTION_EFFECTS } from "@/lib/resources";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";

// Six-stage tracker used by both Exhaustion (2024) and Exertion (2014-style).
// Stages fill yellow → orange → red as the count rises.
function StageTrack({ label, value, max = 6, onChange, note }) {
  const stages = Math.max(0, Math.min(max, Math.round(Number(value) || 0)));
  const tones = [
    "bg-white dark:bg-muted",
    "bg-yellow-300",
    "bg-yellow-400",
    "bg-orange-500",
    "bg-orange-600",
    "bg-red-600",
    "bg-red-700",
  ];
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground">{label}</Label>
        <span className="text-[10px] text-muted-foreground">{stages} / {max}</span>
      </div>
      <div className="mt-1 flex items-center gap-1">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const filled = stages >= n;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${label} stage ${n}`}
              onClick={() => onChange(stages === n ? n - 1 : n)}
              className={`flex h-8 flex-1 items-center justify-center rounded border border-border text-xs font-semibold transition-colors ${
                filled ? tones[n] || tones[tones.length - 1] : "bg-white dark:bg-muted"
              } ${filled ? "text-white" : "text-muted-foreground"}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      {note && <p className="mt-1 text-[10px] text-muted-foreground">{note}</p>}
    </div>
  );
}

// Inspiration slots plus the Exhaustion and Exertion tracks. Shared by the
// Edit sheet's status card and the View character sheet's conditions card.
export function ConditionTracks() {
  const { mergedTree: tree, character, setCharacter, settings } = useTree();
  const levels = settings?.library?.levels || [];
  const aggregated = aggregateResources(tree, character, levels);
  const profBonus = profBonusFor(character.level || 1, levels);
  const stats = statVars(character, tree);
  const sheet = derivedSheet(character, tree, levels, aggregated, profBonus, stats, settings?.library);
  const set = (patch) => setCharacter({ ...character, ...patch });

  const inspSlots = Math.max(1, Math.round(sheet.Inspiration?.slots ?? 1));
  const inspFilled = Math.max(0, Math.min(inspSlots, Number(character.inspiration) || 0));
  const exhaustion = sheet.Exhaustion ? Math.round(sheet.Exhaustion.final) : 0;
  const exhaustionAdds = Number(sheet.Exhaustion?.adds) || 0;
  const penalty = sheet.Exhaustion ? sheet.Exhaustion.penalty : 0;
  const exertion = sheet.Exertion ? Math.round(sheet.Exertion.final) : 0;
  const exertionAdds = Number(sheet.Exertion?.adds) || 0;

  return (
    <div>
      <div className="text-center">
        <Label className="text-[10px] text-muted-foreground">
          Inspiration {inspSlots > 1 ? `(${inspFilled}/${inspSlots})` : ""}
        </Label>
        <div className="mt-0.5 flex items-center justify-center gap-1.5">
          {Array.from({ length: inspSlots }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Inspiration ${i + 1}`}
              onClick={() => set({ inspiration: inspFilled > i ? i : i + 1 })}
              className={`flex h-7 w-7 items-center justify-center rounded border transition-colors ${
                inspFilled > i
                  ? "border-sky-500 bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                  : "border-border bg-white dark:bg-muted"
              }`}
            >
              {inspFilled > i && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
        {inspSlots > 1 && (
          <p className="mt-0.5 text-[9px] text-muted-foreground">Talents grant extra slots</p>
        )}
      </div>

      <StageTrack
        label="Exhaustion"
        value={exhaustion}
        onChange={(n) => set({ exhaustion: Math.max(0, n - exhaustionAdds) })}
        note={`${penalty > 0 ? `−${penalty} to d20 tests · ` : ""}−5 ft speed per stage · max 6`}
      />

      <StageTrack
        label="Exertion"
        value={exertion}
        onChange={(n) => set({ exertion: Math.max(0, n - exertionAdds) })}
        note="2014-style effects below; speed and HP max are applied automatically."
      />
      {exertion > 0 && (
        <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
          {EXERTION_EFFECTS.slice(0, exertion).map((effect, i) => (
            <li key={effect}>
              {i + 1}. {effect}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Initiative readout, the condition tracks, and the active-status chips.
export function StatusSection() {
  const { mergedTree: tree, character, setCharacter, settings } = useTree();
  const levels = settings?.library?.levels || [];
  const aggregated = aggregateResources(tree, character, levels);
  const profBonus = profBonusFor(character.level || 1, levels);
  const stats = statVars(character, tree);
  const sheet = derivedSheet(character, tree, levels, aggregated, profBonus, stats, settings?.library);
  const set = (patch) => setCharacter({ ...character, ...patch });
  const init = sheet.Initiative ? sheet.Initiative.final : 0;

  return (
    <div className="rounded-md border p-3">
      <div className="text-center">
        <Label className="text-[10px] text-muted-foreground">Initiative</Label>
        <div className="mt-0.5 flex items-center justify-center gap-1">
          <span className="font-mono text-lg font-bold">
            {init >= 0 ? `+${init}` : init}
          </span>
          {sheet.Initiative && sheet.Initiative.adds !== 0 && (
            <span className="text-[9px] text-violet-500">
              {sheet.Initiative.adds > 0 ? "+" : ""}
              {sheet.Initiative.adds} nodes
            </span>
          )}
        </div>
      </div>

      <ConditionTracks />

      {(() => {
        // Active status effects, toggled from the Reference Library's list.
        // Actions can require one of these or grant one when used.
        const statuses = (settings?.library?.statusEffects || []).filter((s) => s?.name);
        if (!statuses.length) return null;
        const active = character.activeStatuses || [];
        const kindClass = {
          buff: "border-emerald-400 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
          debuff: "border-red-400 bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
          condition: "border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
        };
        return (
          <div className="mt-3">
            <Label className="text-[10px] text-muted-foreground">Status Effects</Label>
            <div className="mt-1 flex flex-wrap gap-1">
              {statuses.map((s) => {
                const on = active.includes(s.name);
                const tooltip = [s.description, ...(s.effects || [])].filter(Boolean).join(" ");
                return (
                  <button
                    key={s.name}
                    type="button"
                    title={tooltip}
                    onClick={() =>
                      set({
                        activeStatuses: on
                          ? active.filter((n) => n !== s.name)
                          : [...active, s.name],
                      })
                    }
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      on
                        ? kindClass[s.kind] || kindClass.condition
                        : "border-border bg-white text-muted-foreground hover:bg-accent dark:bg-muted"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Toggle what the character is currently under — actions can require or grant these.
            </p>
          </div>
        );
      })()}
    </div>
  );
}
