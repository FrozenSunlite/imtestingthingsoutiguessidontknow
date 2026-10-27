import {
  useTree,
  aggregateResources,
  statVars,
  profBonusFor,
} from "@/lib/treeStore";
import { derivedSheet } from "@/lib/resources";
import { Label } from "@/components/ui/label";
import { Check, Minus, Plus } from "lucide-react";

// Initiative readout, two Inspiration checkmark boxes, and a six-stage
// Exhaustion tracker (white → yellow → orange → red) with the −2 per stage
// d20-test penalty.
export function StatusSection() {
  const { mergedTree: tree, character, setCharacter, settings } = useTree();
  const levels = settings?.library?.levels || [];
  const aggregated = aggregateResources(tree, character, levels);
  const profBonus = profBonusFor(character.level || 1, levels);
  const stats = statVars(character, tree);
  const sheet = derivedSheet(character, tree, levels, aggregated, profBonus, stats, settings?.library);

  const set = (patch) => setCharacter({ ...character, ...patch });
  const inspiration = Number(character.inspiration) || 0;
  const exhaustion = sheet.Exhaustion ? Math.round(sheet.Exhaustion.final) : 0;
  const penalty = sheet.Exhaustion ? sheet.Exhaustion.penalty : 0;
  const init = sheet.Initiative ? sheet.Initiative.final : 0;

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-center">
          <Label className="text-[10px] text-muted-foreground">Initiative</Label>
          <div className="mt-0.5 flex items-center gap-1">
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

        <div className="text-center">
          <Label className="text-[10px] text-muted-foreground">Inspiration</Label>
          <div className="mt-0.5 flex items-center justify-center gap-1.5">
            <button
              type="button"
              aria-label="Remove Inspiration"
              onClick={() => set({ inspiration: Math.max(0, inspiration - 1) })}
              className="flex h-6 w-6 items-center justify-center rounded border border-border bg-white text-muted-foreground transition-colors hover:bg-accent dark:bg-muted"
            >
              <Minus className="h-3 w-3" />
            </button>
            {[0, 1].map((i) => (
              <button
                key={i}
                type="button"
                aria-label={`Inspiration ${i + 1}`}
                onClick={() => set({ inspiration: inspiration === i + 1 ? i : i + 1 })}
                className={`flex h-7 w-7 items-center justify-center rounded border transition-colors ${
                  inspiration > i
                    ? "border-sky-500 bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                    : "border-border bg-white dark:bg-muted"
                }`}
              >
                {inspiration > i && <Check className="h-4 w-4" />}
              </button>
            ))}
            <button
              type="button"
              aria-label="Add Inspiration"
              onClick={() => set({ inspiration: Math.min(2, inspiration + 1) })}
              className="flex h-6 w-6 items-center justify-center rounded border border-border bg-white text-muted-foreground transition-colors hover:bg-accent dark:bg-muted"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-muted-foreground">Exhaustion</Label>
          <span className="text-[10px] text-muted-foreground">
            {exhaustion} / 6{penalty > 0 ? ` · −${penalty} to d20 tests` : ""}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            aria-label="Reduce Exhaustion"
            onClick={() => set({ exhaustion: Math.max(0, exhaustion - 1) })}
            className="flex h-8 w-6 shrink-0 items-center justify-center rounded border border-border bg-white text-muted-foreground transition-colors hover:bg-accent dark:bg-muted"
          >
            <Minus className="h-3 w-3" />
          </button>
          {[1, 2, 3, 4, 5, 6].map((n) => {
            const filled = exhaustion >= n;
            const color = !filled
              ? "bg-white dark:bg-muted"
              : n <= 2
              ? "bg-yellow-400"
              : n <= 4
              ? "bg-orange-500"
              : "bg-red-600";
            return (
              <button
                key={n}
                type="button"
                aria-label={`Exhaustion stage ${n}`}
                onClick={() => set({ exhaustion: exhaustion === n ? n - 1 : n })}
                className={`flex h-8 flex-1 items-center justify-center rounded border border-border text-xs font-semibold transition-colors ${color} ${
                  filled ? "text-white" : "text-muted-foreground"
                }`}
              >
                {n}
              </button>
            );
          })}
          <button
            type="button"
            aria-label="Add Exhaustion"
            onClick={() => set({ exhaustion: Math.min(6, exhaustion + 1) })}
            className="flex h-8 w-6 shrink-0 items-center justify-center rounded border border-border bg-white text-muted-foreground transition-colors hover:bg-accent dark:bg-muted"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Each stage: −2 to every d20 test (applied to Initiative automatically).
        </p>
      </div>

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