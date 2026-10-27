import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { Plus, X } from "lucide-react";
import { STATS } from "@/lib/skills";

// Ability-score prerequisite editor: rows of { stat, min }, checked against
// the character's effective scores at invest time.
export function AbilityReqEditor({
  reqs = [],
  onChange,
  label = "Ability Score Requirement",
  info,
  compact = false,
}) {
  return (
    <div className="space-y-1">
      <InfoTip
        label={
          info ||
          "Ability scores (after bonuses and modifiers) the character needs before investing."
        }
      >
        <Label className={compact ? "text-[10px]" : ""}>{label}</Label>
      </InfoTip>
      {reqs.map((r, i) => (
        <div key={i} className="flex items-center gap-1">
          <Select
            value={r.stat || "STR"}
            onValueChange={(v) => {
              const arr = [...reqs];
              arr[i] = { ...r, stat: v };
              onChange(arr);
            }}
          >
            <SelectTrigger className={compact ? "h-7 w-20" : "h-8 w-24"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className={compact ? "h-7 w-16" : "h-8 w-20"}
            type="number"
            min={1}
            value={r.min ?? 10}
            onChange={(e) => {
              const arr = [...reqs];
              arr[i] = { ...r, min: Math.max(1, Number(e.target.value) || 1) };
              onChange(arr);
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-1.5"
            onClick={() => onChange(reqs.filter((_, j) => j !== i))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        className={compact ? "h-7" : ""}
        onClick={() => onChange([...reqs, { stat: "STR", min: 10 }])}
      >
        <Plus className="mr-1 h-4 w-4" /> Add requirement
      </Button>
    </div>
  );
}