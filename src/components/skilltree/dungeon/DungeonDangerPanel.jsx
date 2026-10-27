import { analyzeDungeon } from "@/lib/dungeonAnalysis";

const DANGER_STYLE = {
  Trivial: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  Easy: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Balanced: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  Hard: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  Deadly: "bg-red-500/15 text-red-700 dark:text-red-300",
};

// Compact danger/reward readout for the Dungeon Generator. It uses the dungeon
// rank, the current party level, generated room spawns and loot hints.
export function DungeonDangerPanel({ dungeon, partyLevel, monsters = [], rank = "E" }) {
  const source = dungeon || { rank, rooms: [] };
  const analysis = analyzeDungeon(source, partyLevel, monsters);
  const { danger, loot, monsters: profile, payout } = analysis;

  return (
    <div className="space-y-1.5 rounded-md border p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Danger Calculator
        </p>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${DANGER_STYLE[danger.label] || ""}`}>
          {danger.label}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Party level {danger.partyLevel} · rank {danger.rank} levels {danger.levelRange.min}–
        {danger.levelRange.max} · boss CR {danger.crMin}–{danger.crMax}
      </p>
      <p className="text-[10px] leading-snug">{danger.reason}</p>
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="rounded bg-muted/40 px-1.5 py-1">
          <p className="font-semibold text-muted-foreground">Loot</p>
          <p className="leading-snug">{loot.tier}</p>
          {loot.seen.length > 0 && (
            <p className="leading-snug text-muted-foreground">In rooms: {loot.seen.join(", ")}</p>
          )}
        </div>
        <div className="rounded bg-muted/40 px-1.5 py-1">
          <p className="font-semibold text-muted-foreground">Gold / downtime</p>
          <p className="leading-snug">{payout.text}</p>
        </div>
      </div>
      <div className="rounded bg-muted/40 px-1.5 py-1 text-[10px]">
        <p className="font-semibold text-muted-foreground">Primary monsters</p>
        {profile.length ? (
          <p className="leading-snug">
            {profile.slice(0, 4).map((entry) => `${entry.type} (${entry.count})`).join(" · ")}
          </p>
        ) : (
          <p className="text-muted-foreground">
            No typed monsters yet — add monsters to the project or import them.
          </p>
        )}
      </div>
    </div>
  );
}
