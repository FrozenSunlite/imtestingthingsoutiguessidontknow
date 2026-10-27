import { useState } from "react";
import { useTree, aggregateResources, statVars } from "@/lib/treeStore";
import { statOr10 } from "@/lib/skills";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PlusBadge } from "@/components/skilltree/PlusBadge";
import { RestDialog } from "@/components/skilltree/RestDialog";
import { Moon, Sun } from "lucide-react";

const signed = (n) => (n >= 0 ? `+${n}` : String(n));

// Hit Points card for the View page: current HP with quick editing, max HP
// (editable base + talent contributions), an auto-calculator that values
// every level at the hit die's average, and short/long rest buttons.
export function HitPointsCard() {
  const { mergedTree: tree, character, setCharacter, settings } = useTree();
  const [rest, setRest] = useState(null);
  const levels = settings?.library?.levels || [];
  const stats = statVars(character, tree);
  const aggregated = aggregateResources(tree, character, levels);
  const hpAdds = Number((aggregated.find((e) => e.name === "Hit Points") || {}).uses) || 0;
  const base = Number(character.hitPoints) || 0;
  const maxHp = Math.max(0, base + hpAdds);
  const dieSize = character.hitDiceSize || "d6";
  const sides = Number(String(dieSize).replace(/\D/g, "")) || 6;
  const conMod =
    Math.floor((statOr10(stats.CON) - 10) / 2) +
    (Number(character.modifiers?.ability?.CON) || 0);
  const level = Number(character.level) || 1;
  const perLevel = Math.max(1, Math.floor(sides / 2) + 1) + conMod;
  const auto = Math.max(0, sides + conMod + (level - 1) * perLevel);
  const currentHp = character.currentHp == null ? maxHp : Number(character.currentHp) || 0;
  const setCurrent = (v) =>
    setCharacter({ ...character, currentHp: Math.max(0, Number(v) || 0) });
  // Temporary pools: extra hit points that absorb damage but never count
  // toward the maximum, and extra hit dice that can be spent on demand or
  // during a short rest instead of the character's own dice.
  const tempHp = Number(character.tempHp) || 0;
  const setTempHp = (v) => setCharacter({ ...character, tempHp: Math.max(0, Number(v) || 0) });
  // Barrier HP: a pool that sits above Temp HP (e.g. an Abjurer's ward) —
  // it absorbs damage first, and talents grant extra via the "Barrier" resource.
  const barrierAdds =
    Number((aggregated.find((e) => e.name === "Barrier") || {}).uses) || 0;
  const barrierHp = Number(character.barrierHp) || 0;
  const setBarrierHp = (v) =>
    setCharacter({ ...character, barrierHp: Math.max(0, Number(v) || 0) });
  const tempHd = Number(character.tempHitDice) || 0;
  const setTempHd = (v) => setCharacter({ ...character, tempHitDice: Math.max(0, Number(v) || 0) });

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Hit Points
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-accent/40 p-3">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            Current HP
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 shrink-0"
              title="−1 HP"
              onClick={() => setCurrent(currentHp - 1)}
            >
              −
            </Button>
            <Input
              type="number"
              className="h-8 text-center"
              value={currentHp}
              onChange={(e) => setCurrent(e.target.value)}
            />
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 shrink-0"
              title="+1 HP"
              onClick={() => setCurrent(currentHp + 1)}
            >
              +
            </Button>
          </div>
          <Progress
            value={maxHp ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0}
            className="mt-2 h-2"
          />
          <div className="mt-1 text-[10px] text-muted-foreground">
            {currentHp} / {maxHp}
          </div>
        </div>

        <div className="rounded-xl border bg-accent/40 p-3">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            Max HP
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Input
              type="number"
              className="h-8 w-20"
              title="Base hit points (talent contributions add on top)"
              value={base}
              onChange={(e) =>
                setCharacter({
                  ...character,
                  hitPoints: e.target.value === "" ? 0 : Number(e.target.value) || 0,
                })
              }
            />
            {hpAdds !== 0 && <PlusBadge value={hpAdds} />}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 w-full"
            title={`Level 1: full 1${dieSize} ${signed(conMod)} CON · each level after: average ${perLevel} HP`}
            onClick={() => setCharacter({ ...character, hitPoints: auto })}
          >
            Use auto ({auto})
          </Button>
          <div className="mt-1 text-[10px] text-muted-foreground">
            Auto from averages: {auto}
          </div>
        </div>

        <div className="rounded-xl border bg-accent/40 p-3">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            Temp HP
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 shrink-0"
              title="−1 temp HP"
              onClick={() => setTempHp(tempHp - 1)}
            >
              −
            </Button>
            <Input
              type="number"
              className="h-8 text-center"
              value={tempHp}
              onChange={(e) => setTempHp(e.target.value)}
            />
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 shrink-0"
              title="+1 temp HP"
              onClick={() => setTempHp(tempHp + 1)}
            >
              +
            </Button>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            Absorbs damage first; not counted in max HP.
          </p>
        </div>

        <div className="rounded-xl border bg-accent/40 p-3">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            Barrier HP
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 shrink-0"
              title="−1 barrier HP"
              onClick={() => setBarrierHp(barrierHp - 1)}
            >
              −
            </Button>
            <Input
              type="number"
              className="h-8 text-center"
              value={barrierHp}
              onChange={(e) => setBarrierHp(e.target.value)}
            />
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 shrink-0"
              title="+1 barrier HP"
              onClick={() => setBarrierHp(barrierHp + 1)}
            >
              +
            </Button>
            {barrierAdds !== 0 && <PlusBadge value={barrierAdds} />}
          </div>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            Sits above Temp HP — absorbs damage before Temp HP (e.g. a ward). Talents add via the
            "Barrier" resource.
          </p>
        </div>

        <div className="rounded-xl border bg-accent/40 p-3">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            Temp hit dice
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 shrink-0"
              title="−1 temp hit die"
              onClick={() => setTempHd(tempHd - 1)}
            >
              −
            </Button>
            <Input
              type="number"
              className="h-8 text-center"
              value={tempHd}
              onChange={(e) => setTempHd(e.target.value)}
            />
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 shrink-0"
              title="+1 temp hit die"
              onClick={() => setTempHd(tempHd + 1)}
            >
              +
            </Button>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            Extra dice (1{dieSize} {signed(conMod)} CON each) — spend on demand
            or during a short rest; not counted in max HP.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border bg-accent/40 p-3">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            Rest
          </div>
          <Button size="sm" variant="outline" onClick={() => setRest("short")}>
            <Sun className="mr-1 h-4 w-4" /> Short rest
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRest("long")}>
            <Moon className="mr-1 h-4 w-4" /> Long rest
          </Button>
          <p className="text-[10px] leading-snug text-muted-foreground">
            Long rest fully heals and restores hit dice; a short rest may spend
            hit dice. Both log downtime actions.
          </p>
        </div>
      </div>
      <RestDialog mode={rest} onClose={() => setRest(null)} />
    </section>
  );
}