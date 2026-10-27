import { useState } from "react";
import {
  useTree,
  aggregateResources,
  statVars,
  profBonusFor,
  pushActivityLog,
} from "@/lib/treeStore";
import {
  buildVars,
  collectActions,
  mergeLibraryActions,
  numericResourceMap,
  restRestore,
} from "@/lib/resources";
import { statOr10 } from "@/lib/skills";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Moon, Sun } from "lucide-react";

const signed = (n) => (n >= 0 ? `+${n}` : String(n));

// The short/long rest dialog. A long rest restores hit points and hit dice
// fully and recharges long- and short-rest uses; a short rest recharges
// short-rest uses and may spend hit dice to heal. Either way, downtime
// actions taken during the rest are logged on the character.
export function RestDialog({ mode, onClose }) {
  const { mergedTree: tree, character, setCharacter, settings } = useTree();
  const [downtime, setDowntime] = useState("");
  const [dice, setDice] = useState(0);
  const [tempDice, setTempDice] = useState(0);
  const levels = settings?.library?.levels || [];
  const profBonus = profBonusFor(character.level || 1, levels);
  const stats = statVars(character, tree);
  const aggregated = aggregateResources(tree, character, levels);
  const vars = buildVars(
    character.level || 1,
    stats,
    profBonus,
    numericResourceMap(aggregated),
    character.hitDiceSize
  );
  const actions = mergeLibraryActions(
    settings?.library?.actions || [],
    collectActions(tree, vars),
    vars
  );
  const dieSize = character.hitDiceSize || "d6";
  const sides = Number(String(dieSize).replace(/\D/g, "")) || 6;
  const conMod =
    Math.floor((statOr10(stats.CON) - 10) / 2) +
    (Number(character.modifiers?.ability?.CON) || 0);
  const hdHeal = Math.max(1, Math.floor(sides / 2) + 1 + conMod);
  const hpAdds = Number((aggregated.find((e) => e.name === "Hit Points") || {}).uses) || 0;
  const maxHp = (Number(character.hitPoints) || 0) + hpAdds;
  const currentHp = character.currentHp == null ? maxHp : Number(character.currentHp) || 0;
  const hdTotal =
    Number((aggregated.find((e) => e.name === "Hit Dice") || {}).final) || level1(character);
  const hdSpent = Number(character.hitDiceSpent) || 0;
  const hdLeft = Math.max(0, hdTotal - hdSpent);
  const tempHdTotal = Number(character.tempHitDice) || 0;
  if (!mode) return null;

  const spend = Math.max(0, Math.min(dice, hdLeft));
  const tempSpend = Math.max(0, Math.min(tempDice, tempHdTotal));

  const confirm = () => {
    const patch = { actionUses: restRestore(actions, character.actionUses || {}, mode) };
    // Recharge wondrous item charges whose recharge time matches this rest.
    patch.inventory = (character.inventory || []).map((it) => {
      if (it.chargesMax === "" || it.chargesMax == null) return it;
      const rec = String(it.recharge || "").toLowerCase();
      const isLong = rec.includes("long") || rec.includes("dawn") || rec.includes("day");
      const isShort = rec.includes("short") || rec.includes("hour");
      const restore = mode === "long" ? isLong || isShort : isShort && !isLong;
      return restore ? { ...it, chargesCurrent: Number(it.chargesMax) } : it;
    });
    if (mode === "long") {
      patch.currentHp = maxHp;
      patch.hitDiceSpent = 0;
    } else {
      const heal = (spend + tempSpend) * hdHeal;
      if (heal > 0) patch.currentHp = Math.min(maxHp, currentHp + heal);
      if (spend > 0) patch.hitDiceSpent = hdSpent + spend;
      // Temp hit dice are a separate, non-restoring pool: spent dice are
      // simply gone.
      if (tempSpend > 0) patch.tempHitDice = tempHdTotal - tempSpend;
    }
    let next = { ...character, ...patch };
    next = pushActivityLog(
      next,
      mode === "long"
        ? "Took a long rest — hit points and hit dice fully restored."
        : `Took a short rest${
            spend > 0 ? ` — spent ${spend} hit die${spend > 1 ? "s" : ""}` : ""
          }${tempSpend > 0 ? `${spend > 0 ? " and" : " — spent"} ${tempSpend} temp hit die${tempSpend > 1 ? "s" : ""}` : ""}${
            spend + tempSpend > 0 ? ` for ${(spend + tempSpend) * hdHeal} HP` : ""
          }.`
    );
    // Notes typed during the rest land in the activity log, not the dialog.
    const text = downtime.trim();
    if (text)
      next = pushActivityLog(next, `${mode === "long" ? "Long" : "Short"} rest downtime — ${text}`);
    setCharacter(next);
    toast.success(mode === "long" ? "Long rest complete" : "Short rest complete");
    setDowntime("");
    setDice(0);
    setTempDice(0);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "long" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            Take a {mode} rest
          </DialogTitle>
          <DialogDescription>
            {mode === "long"
              ? `Restores hit points (${currentHp} → ${maxHp}) and all hit dice, and recharges long- and short-rest uses.`
              : `Recharges short-rest uses. Hit points ${currentHp}/${maxHp} · ${hdLeft} hit die${tempHdTotal ? ` + ${tempHdTotal} temp` : ""} left.`}
          </DialogDescription>
        </DialogHeader>
        {mode === "short" && (
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-[10px] text-muted-foreground">Spend hit dice</Label>
            <Input
              type="number"
              min="0"
              max={hdLeft}
              className="h-8 w-20"
              value={dice}
              onChange={(e) =>
                setDice(Math.max(0, Math.min(hdLeft, Number(e.target.value) || 0)))
              }
            />
            <span className="text-[10px] text-muted-foreground">
              × {hdHeal} HP each (avg on 1{dieSize} {signed(conMod)} CON)
            </span>
          </div>
        )}
        {mode === "short" && tempHdTotal > 0 && (
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-[10px] text-muted-foreground">
              Spend temp hit dice
            </Label>
            <Input
              type="number"
              min="0"
              max={tempHdTotal}
              className="h-8 w-20"
              value={tempDice}
              onChange={(e) =>
                setTempDice(Math.max(0, Math.min(tempHdTotal, Number(e.target.value) || 0)))
              }
            />
            <span className="text-[10px] text-muted-foreground">
              {tempHdTotal} left — × {hdHeal} HP each, separate from your own dice
            </span>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            {mode === "long" ? "Long rest downtime actions" : "Short rest downtime actions"}
          </Label>
          <Textarea
            rows={3}
            placeholder="What did you do during the rest? (train, craft, tinker, study…)"
            value={downtime}
            onChange={(e) => setDowntime(e.target.value)}
          />
        </div>
        <Button onClick={confirm}>
          {mode === "long" ? "Finish long rest" : "Finish short rest"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function level1(character) {
  return Number(character.hitDiceCount) || Number(character.level) || 1;
}