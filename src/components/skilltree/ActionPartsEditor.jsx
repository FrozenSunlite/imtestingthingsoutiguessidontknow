import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { Switch } from "@/components/ui/switch";
import { X } from "lucide-react";

const STATS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
const FALLBACK_DAMAGE_TYPES = [
  "Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic",
  "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder",
];
const PART_LABELS = {
  attack: "Attack",
  save: "Saving throw",
  damage: "Damage",
  heal: "Healing",
  temp: "Temporary HP",
  effect: "Status / effect",
  note: "Note",
};

const newPart = (type) => {
  if (type === "attack") return { type, label: "", kind: "weapon", ability: "", bonus: "" };
  if (type === "save") return { type, ability: "DEX", dcMode: "spell", dc: "", onSuccess: "half" };
  if (type === "damage") return { type, dice: "", damageType: "", ability: "", bonus: "" };
  if (type === "heal") return { type, dice: "", ability: "", bonus: "" };
  if (type === "temp") return { type, dice: "", bonus: "" };
  if (type === "effect") return { type, status: "", duration: "", note: "" };
  return { type: "note", text: "" };
};

// Composer for structured action parts: attacks, saves, damage, healing,
// temporary hit points, statuses and free notes. The same editor is used for
// library actions and for actions granted by tree nodes.
export function ActionPartsEditor({ parts = [], onChange, statuses = [], damageTypes = [] }) {
  const types = [...new Set([...FALLBACK_DAMAGE_TYPES, ...(damageTypes || [])])];
  const list = Array.isArray(parts) ? parts : [];
  const patch = (i, p) => onChange(list.map((part, j) => (j === i ? { ...part, ...p } : part)));
  const remove = (i) => onChange(list.filter((_, j) => j !== i));
  const add = (type) => onChange([...list, newPart(type)]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <InfoTip label="Structured parts of this action: its attack, save, damage, healing, applied status and notes. They appear as readable chips and roll buttons on the sheet.">
          <Label className="text-[10px] text-muted-foreground">Combat parts</Label>
        </InfoTip>
        <Select value="" onValueChange={add}>
          <SelectTrigger className="h-7 w-36 text-xs">
            <SelectValue placeholder="Add part…" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PART_LABELS).map(([type, label]) => (
              <SelectItem key={type} value={type}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {list.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          No structured parts yet — add an attack, save or damage to make it rollable.
        </p>
      )}

      {list.map((part, i) => (
        <div key={i} className="space-y-1 rounded border p-1.5">
          <div className="flex items-center gap-1">
            <span className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {PART_LABELS[part.type] || part.type}
            </span>
            <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => remove(i)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {part.type === "attack" && (
            <div className="grid grid-cols-2 gap-1">
              <Input
                className="h-7 text-xs"
                placeholder="Label (e.g. Talon)"
                value={part.label || ""}
                onChange={(e) => patch(i, { label: e.target.value })}
              />
              <Select value={part.kind || "weapon"} onValueChange={(v) => patch(i, { kind: v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weapon">Weapon attack</SelectItem>
                  <SelectItem value="spell">Spell attack</SelectItem>
                  <SelectItem value="unarmed">Unarmed strike</SelectItem>
                  <SelectItem value="other">Other attack</SelectItem>
                </SelectContent>
              </Select>
              <Select value={part.ability || "__none__"} onValueChange={(v) => patch(i, { ability: v === "__none__" ? "" : v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Ability" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Default ability</SelectItem>
                  {STATS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                className="h-7 text-xs"
                placeholder="Extra bonus (formula)"
                value={part.bonus || ""}
                onChange={(e) => patch(i, { bonus: e.target.value })}
              />
            </div>
          )}

          {part.type === "save" && (
            <div className="grid grid-cols-2 gap-1">
              <Select value={part.ability || "DEX"} onValueChange={(v) => patch(i, { ability: v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={part.dcMode || "spell"} onValueChange={(v) => patch(i, { dcMode: v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="spell">Spell save DC</SelectItem>
                  <SelectItem value="fixed">Fixed DC</SelectItem>
                </SelectContent>
              </Select>
              {part.dcMode === "fixed" && (
                <Input
                  className="h-7 text-xs"
                  type="number"
                  placeholder="DC"
                  value={part.dc ?? ""}
                  onChange={(e) => patch(i, { dc: e.target.value })}
                />
              )}
              <Select value={part.onSuccess || "half"} onValueChange={(v) => patch(i, { onSuccess: v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="half">Half on success</SelectItem>
                  <SelectItem value="none">No damage on success</SelectItem>
                  <SelectItem value="negates">Negates effect</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(part.type === "damage" || part.type === "heal" || part.type === "temp") && (
            <div className="grid grid-cols-2 gap-1">
              <Input
                className="h-7 text-xs"
                placeholder="Dice (e.g. 2d6)"
                value={part.dice || ""}
                onChange={(e) => patch(i, { dice: e.target.value })}
              />
              {part.type === "damage" ? (
                <Select
                  value={part.damageType || "__none__"}
                  onValueChange={(v) => patch(i, { damageType: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No type</SelectItem>
                    {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-7 text-xs"
                  placeholder="Bonus (formula)"
                  value={part.bonus || ""}
                  onChange={(e) => patch(i, { bonus: e.target.value })}
                />
              )}
              {part.type !== "temp" && (
                <Select
                  value={part.ability || "__none__"}
                  onValueChange={(v) => patch(i, { ability: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Add ability mod" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No ability mod</SelectItem>
                    {STATS.map((s) => <SelectItem key={s} value={s}>{s} modifier</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {part.type === "damage" && (
                <Input
                  className="h-7 text-xs"
                  placeholder="Bonus (formula)"
                  value={part.bonus || ""}
                  onChange={(e) => patch(i, { bonus: e.target.value })}
                />
              )}
            </div>
          )}

          {part.type === "effect" && (
            <div className="grid grid-cols-2 gap-1">
              <Select
                value={part.status || "__none__"}
                onValueChange={(v) => patch(i, { status: v === "__none__" ? "" : v })}
              >
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No status</SelectItem>
                  {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                className="h-7 text-xs"
                placeholder="Duration (e.g. 1 minute)"
                value={part.duration || ""}
                onChange={(e) => patch(i, { duration: e.target.value })}
              />
              <Input
                className="col-span-2 h-7 text-xs"
                placeholder="Effect note"
                value={part.note || ""}
                onChange={(e) => patch(i, { note: e.target.value })}
              />
            </div>
          )}

          {part.type === "note" && (
            <Textarea
              className="min-h-12 text-xs"
              placeholder="Extra note shown on the sheet"
              value={part.text || ""}
              onChange={(e) => patch(i, { text: e.target.value })}
            />
          )}
        </div>
      ))}

    </div>
  );
}

// Target, range, duration and concentration for an action. Kept separate from
// the parts so both the library editor and node editor can place it wherever
// it fits.
export function ActionTargetingFields({ action, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      <Input
        className="h-7 text-xs"
        placeholder="Target (e.g. one creature)"
        value={action.target || ""}
        onChange={(e) => onChange({ target: e.target.value })}
      />
      <Input
        className="h-7 text-xs"
        placeholder="Range (e.g. 6 spaces)"
        value={action.range || ""}
        onChange={(e) => onChange({ range: e.target.value })}
      />
      <Input
        className="h-7 text-xs"
        placeholder="Duration (e.g. 1 minute)"
        value={action.duration || ""}
        onChange={(e) => onChange({ duration: e.target.value })}
      />
      <label className="flex h-7 items-center gap-1.5 text-[10px] text-muted-foreground">
        <Switch
          checked={!!action.concentration}
          onCheckedChange={(v) => onChange({ concentration: v })}
        />
        Concentration
      </label>
    </div>
  );
}
