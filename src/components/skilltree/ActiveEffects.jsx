import { useTree, aggregateResources, statVars, profBonusFor } from "@/lib/treeStore";
import {
  buildVars,
  numericResourceMap,
  resolveResourceValue,
} from "@/lib/resources";
import { Switch } from "@/components/ui/switch";

// Active Effects: every invested talent's toggleable resource, listed with a
// switch. On = the value applies (fed into aggregation); off = purely latent.
export function ActiveEffects() {
  const { mergedTree: tree, character, setCharacter, settings } = useTree();
  const active = character.activeToggles || [];
  const rows = [];
  (tree?.nodes || []).forEach((n) => {
    if ((n.currentPoints || 0) <= 0) return;
    (n.resources || []).forEach((r, i) => {
      if (r.toggle && r.name) rows.push({ key: `${n.id}:${i}`, node: n, r });
    });
  });
  if (rows.length === 0) return null;

  const levels = settings?.library?.levels || [];
  const stats = statVars(character, tree);
  const profBonus = profBonusFor(character.level || 1, levels);
  const aggregated = aggregateResources(tree, character, levels);
  const vars = buildVars(
    character.level || 1,
    stats,
    profBonus,
    numericResourceMap(aggregated),
    character.hitDiceSize
  );
  const toggle = (key) =>
    setCharacter({
      ...character,
      activeToggles: active.includes(key)
        ? active.filter((k) => k !== key)
        : [...active, key],
    });

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="mb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Active Effects
      </h2>
      <p className="mb-2 text-[10px] text-muted-foreground">
        Toggleable talents: switch on to apply the value temporarily, off to
        remove it from the sheet.
      </p>
      <div className="space-y-1">
        {rows.map(({ key, node, r }) => {
          const on = active.includes(key);
          const v = resolveResourceValue(r, vars);
          const dice = Number(r.diceCount)
            ? ` + ${r.diceCount}${r.diceSize || "d6"}`
            : "";
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-2 rounded-lg border bg-accent/40 px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <span className="text-xs font-medium">{r.name}</span>
                <span className="ml-1.5 truncate text-[10px] text-muted-foreground">
                  {node.name}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {v.text}
                  {dice}
                </span>
                <Switch checked={on} onCheckedChange={() => toggle(key)} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}