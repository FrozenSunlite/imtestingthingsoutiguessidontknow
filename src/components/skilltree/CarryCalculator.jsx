import { useTree } from "@/lib/treeStore";
import { sizeShift, SIZE_LADDER, SIZE_MULT, encumbranceInfo } from "@/lib/resources";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SIZES = [
  ["tiny", "Tiny"],
  ["small", "Small"],
  ["medium", "Medium"],
  ["large", "Large"],
  ["huge", "Huge"],
  ["gargantuan", "Gargantuan"],
];



export function CarryCalculator({ character, setCharacter }) {
  const { mergedTree: tree } = useTree();
  const str = Number(character.stats?.STR) || 0;
  const level = Number(character.level) || 1;
  const prof = 2 + Math.floor((level - 1) / 4);
  const strMod = Math.floor((str - 10) / 2);
  const countAs = character.sizeCountAs || "medium";
  const idx = SIZE_LADDER.indexOf(countAs);
  const shifted =
    SIZE_LADDER[Math.min(SIZE_LADDER.length - 1, Math.max(0, (idx < 0 ? 2 : idx) + sizeShift(tree, "Count as Size")))] ||
    "medium";
  const mult = SIZE_MULT[shifted] ?? 1;
  const carry = str * 15 * mult;
  const push = str * 30 * mult;
  const grappleDC = 8 + prof + strMod;
  const enc = encumbranceInfo(character, tree);

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">Push, Pull, Carry & Grapple</Label>
        <Select value={countAs} onValueChange={(v) => setCharacter({ ...character, sizeCountAs: v })}>
          <SelectTrigger className="h-8 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SIZES.map(([v, l]) => (
              <SelectItem key={v} value={v}>
                Count as: {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Powerful Build or similar? Count yourself as one size larger here.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
        <div className="rounded bg-muted/50 px-2 py-1">
          <span className="text-muted-foreground">Carry</span>{" "}
          <span className="font-mono font-medium">{carry.toLocaleString()} lb</span>
        </div>
        <div className="rounded bg-muted/50 px-2 py-1">
          <span className="text-muted-foreground">Push / Drag / Lift</span>{" "}
          <span className="font-mono font-medium">{push.toLocaleString()} lb</span>
        </div>
        <div className="rounded bg-muted/50 px-2 py-1">
          <span className="text-muted-foreground">Grapple DC</span>{" "}
          <span className="font-mono font-medium">{grappleDC}</span>
        </div>
        <div className="rounded bg-muted/50 px-2 py-1 text-muted-foreground">
          Can grapple up to one size larger than {countAs}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Switch
          checked={!!character.trackEncumbrance}
          onCheckedChange={(v) => setCharacter({ ...character, trackEncumbrance: v })}
        />
        <span className="text-xs">Track encumbrance (auto speed penalties)</span>
      </div>
      {character.trackEncumbrance && (
        <div className="mt-1.5 space-y-1">
          <div className="flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-xs">
            <span className="text-muted-foreground">Carried weight</span>
            <span
              className={`font-mono font-medium ${
                enc.weight > enc.light ? "text-orange-600 dark:text-orange-400" : ""
              }`}
            >
              {Math.round(enc.weight * 10) / 10} lb
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Light {Math.round(enc.light)} lb · Heavy {Math.round(enc.heavy)} lb · Max{" "}
            {Math.round(enc.max)} lb — past Light −2 spaces of speed, past Heavy −4 spaces.
          </p>
          {enc.penalty > 0 && (
            <p className="text-[10px] font-medium text-orange-600 dark:text-orange-400">
              Encumbered: −{enc.penalty} spaces of speed (applied to Speed above).
            </p>
          )}
        </div>
      )}
    </div>
  );
}