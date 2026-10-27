import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dices, Trash2 } from "lucide-react";

const DICE = [4, 6, 8, 10, 12, 20, 100];
const signed = (n) => (n >= 0 ? `+${n}` : String(n));

// A plain dice roller for monsters and NPCs — no character sheet attached.
// Rolls land in a local history rather than a character's activity log.
export function DmDiceRoller() {
  const [count, setCount] = useState(1);
  const [mod, setMod] = useState("0");
  const [rolls, setRolls] = useState([]);

  const roll = (size) => {
    const n = Math.max(1, Math.min(20, Math.round(Number(count) || 1)));
    const r = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * size));
    const m = Number(mod) || 0;
    const total = r.reduce((a, b) => a + b, 0) + m;
    const label = `${n}d${size}${m ? signed(m) : ""}`;
    setRolls((prev) => [{ label, total, rolls: r.join(", ") }, ...prev].slice(0, 15));
  };

  return (
    <section className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dice Roller</h3>
        {rolls.length > 0 && (
          <button
            className="text-muted-foreground hover:text-foreground"
            title="Clear roll history"
            onClick={() => setRolls([])}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="mt-2 flex items-end gap-1.5">
        <div className="w-14 space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Dice</label>
          <Input type="number" min={1} max={20} className="h-8" value={count} onChange={(e) => setCount(e.target.value)} />
        </div>
        <div className="w-16 space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Mod</label>
          <Input type="number" className="h-8" value={mod} onChange={(e) => setMod(e.target.value)} />
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {DICE.map((d) => (
          <Button key={d} size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => roll(d)}>
            <Dices className="h-3 w-3" /> d{d}
          </Button>
        ))}
      </div>
      <label className="mt-2 block text-[10px] text-muted-foreground">Recent rolls</label>
      <div className="mt-1 max-h-64 space-y-0.5 overflow-y-auto rounded-md bg-muted/50 p-2">
        {rolls.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">No rolls yet.</p>
        ) : (
          rolls.map((r, i) => (
            <p key={i} className={i === 0 ? "text-xs font-medium" : "text-xs text-muted-foreground"}>
              {r.label} → <span className="font-semibold">{r.total}</span> [{r.rolls}]
            </p>
          ))
        )}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        The player's roller is on the View screen.
      </p>
    </section>
  );
}