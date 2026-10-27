import { useTree, levelGains } from "@/lib/treeStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Level-up hit point choice: take the fixed average (⌈die/2⌉ + 1, plus the
// CON modifier) or roll the hit die. The gain is added to the character's
// hit points, then the level and point-pool gains apply exactly like the
// old instant level-up.
export function LevelUpDialog({ open, onClose }) {
  const { character, setCharacter, setPools, settings } = useTree();
  const nextLevel = (Number(character.level) || 1) + 1;
  const dieSize = character.hitDiceSize || "d6";
  const sides = Number(String(dieSize).replace(/\D/g, "")) || 6;
  const conMod =
    Math.floor((((character.stats || {}).CON ?? 10) - 10) / 2) +
    (Number(character.modifiers?.ability?.CON) || 0);
  const average = Math.max(1, Math.floor(sides / 2) + 1) + conMod;

  const confirm = (gain) => {
    const g = levelGains(nextLevel, settings);
    // Hit dice default to +1 per level: when the count is unspecified it
    // becomes explicit on level-up, and every die gained this way uses the
    // current hit die size (an upgrade at this level applies to it too).
    const hdBlank = character.hitDiceCount == null || character.hitDiceCount === "";
    setCharacter({
      ...character,
      level: nextLevel,
      hitPoints: (Number(character.hitPoints) || 0) + gain,
      hitDiceCount: hdBlank ? nextLevel : (Number(character.hitDiceCount) || 0) + 1,
    });
    setPools((p) => ({
      ...p,
      talent: { ...p.talent, total: (p.talent.total || 0) + g.talentPoints },
      heritage: { ...p.heritage, total: (p.heritage.total || 0) + g.heritagePoints },
      attribute: { ...p.attribute, total: (p.attribute?.total ?? 72) + g.attributePoints },
    }));
    onClose();
  };

  const roll = () => {
    const r = 1 + Math.floor(Math.random() * sides);
    const gain = Math.max(1, r + conMod);
    confirm(gain);
    toast.success(`Rolled ${r} on 1${dieSize} → +${gain} HP`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Level Up to {nextLevel}</DialogTitle>
          <DialogDescription>
            Choose how to gain hit points from your hit die (1{dieSize}
            {conMod !== 0 ? ` ${conMod > 0 ? "+" : "−"} ${Math.abs(conMod)} CON` : ""}). You
            also gain +1 hit die at the current size.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => confirm(average)}>
            Take Average (+{average} HP)
          </Button>
          <Button onClick={roll}>Roll 1{dieSize}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}