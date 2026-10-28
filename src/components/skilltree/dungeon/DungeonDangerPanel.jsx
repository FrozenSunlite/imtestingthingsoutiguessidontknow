import { analyzeDungeon } from "@/lib/dungeonAnalysis";
import { CURRENCY_OPTIONS } from "@/lib/currency";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DANGER_STYLE = {
  Trivial: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  Easy: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Balanced: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  Hard: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  Deadly: "bg-red-500/15 text-red-700 dark:text-red-300",
};

// Compact danger/reward readout for the Dungeon Builder. It uses the dungeon
// rank, the current party level, generated room spawns and loot hints. The
// reward currency is project-wide so the Architect pays out the same unit.
export function DungeonDangerPanel({
  dungeon,
  partyLevel,
  monsters = [],
  rank = "E",
  currency = "gp",
  onCurrencyChange,
}) {
  const source = dungeon || { rank, rooms: [] };
  const analysis = analyzeDungeon(source, partyLevel, monsters, currency);
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
        Highest level {danger.partyLevel} · rank {danger.rank} levels {danger.levelRange.min}–
        {danger.levelRange.max} · boss CR {dungeon?.encounterScale?.bossCR ?? `${danger.crMin}–${danger.crMax}`}
      </p>
      <p className="text-[10px] leading-snug">{danger.reason}</p>
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="rounded bg-muted/40 px-1.5 py-1">
          <p className="font-semibold text-muted-foreground">Loot</p>
          <p className="leading-snug">{loot.tier}</p>
          {loot.seen.length > 0 && (
            <p className="leading-snug text-muted-foreground">In rooms: {loot.seen.join(", ")}</p>
          )}
          {loot.harvest.length > 0 && (
            <p className="leading-snug text-cyan-700 dark:text-cyan-300">
              Harvest: {loot.harvest.slice(0, 5).join(", ")}
            </p>
          )}
        </div>
        <div className="rounded bg-muted/40 px-1.5 py-1">
          <div className="flex items-center justify-between gap-1">
            <p className="font-semibold text-muted-foreground">Reward / downtime</p>
            {onCurrencyChange && (
              <Select value={currency || "gp"} onValueChange={onCurrencyChange}>
                <SelectTrigger className="h-5 w-14 px-1 text-[9px]" title="Reward currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((coin) => (
                    <SelectItem key={coin.value} value={coin.value}>
                      {coin.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
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
