import { useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEVEL_MODES,
  TABLE_SAVE_MODES,
  TABLE_RANGE_MODES,
  filterSpells,
} from "@/lib/benefits";

const DEFAULT_TABLE = {
  source: "spells",
  mode: "choose",
  count: 1,
  die: "d20",
  optionsText: "",
  filters: {
    schools: [],
    levelMode: "any",
    level: "",
    subschool: "",
    castingTime: "",
    duration: "",
    save: "any",
    range: "any",
    target: "",
    area: "",
    effect: "",
    materials: "",
  },
};

// Build a "choose N" or "roll" table for a node benefit. Spell tables store
// the full filter set; custom tables use a plain list of options.
export function BenefitTableDialog({ open, onClose, onSave, spells = [], schools = [] }) {
  const [name, setName] = useState("");
  const [table, setTable] = useState(DEFAULT_TABLE);
  const matches = useMemo(
    () => filterSpells(spells, table.filters),
    [spells, table.filters]
  );

  if (!open) return null;
  const patch = (p) => setTable((t) => ({ ...t, ...p }));
  const patchFilter = (p) =>
    setTable((t) => ({ ...t, filters: { ...t.filters, ...p } }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create a benefit table</DialogTitle>
          <DialogDescription>
            Choose options or roll on a table. Spell tables filter the spell library by school,
            level, subschool, casting time, duration, save/attack, range, target, area, effect and
            materials.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Table name</Label>
              <Input
                className="h-8"
                placeholder="e.g. Arcane Talent Spells"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Options come from</Label>
              <Select
                value={table.source}
                onValueChange={(v) => patch({ source: v })}
              >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="spells">Spell library</SelectItem>
                  <SelectItem value="custom">Custom list</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">How many</Label>
              <Select value={table.mode} onValueChange={(v) => patch({ mode: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="choose">Choose N</SelectItem>
                  <SelectItem value="roll">Roll a die</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {table.mode === "choose" ? (
              <div className="space-y-1">
                <Label className="text-[10px]">Choices</Label>
                <Input
                  className="h-8"
                  type="number"
                  min={1}
                  value={table.count}
                  onChange={(e) =>
                    patch({ count: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-[10px]">Die</Label>
                <Select value={table.die} onValueChange={(v) => patch({ die: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["d4", "d6", "d8", "d10", "d12", "d20", "d100"].map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="self-end pb-1 text-[10px] text-muted-foreground">
              {table.source === "spells"
                ? `${matches.length} spell${matches.length === 1 ? "" : "s"} match`
                : `${String(table.optionsText || "").split(/\r?\n/).filter((s) => s.trim()).length} options`}
            </div>
          </div>

          {table.source === "spells" ? (
            <div className="space-y-2 rounded-md border p-2">
              <div>
                <Label className="text-[10px]">Schools</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {schools.map((school) => {
                    const on = table.filters.schools.includes(school);
                    return (
                      <button
                        key={school}
                        type="button"
                        onClick={() =>
                          patchFilter({
                            schools: on
                              ? table.filters.schools.filter((s) => s !== school)
                              : [...table.filters.schools, school],
                          })
                        }
                        className={`rounded border px-1.5 py-0.5 text-[10px] ${
                          on ? "border-primary bg-primary/10" : "hover:bg-accent"
                        }`}
                      >
                        {school}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Level relation</Label>
                  <Select
                    value={table.filters.levelMode}
                    onValueChange={(v) => patchFilter({ levelMode: v })}
                  >
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEVEL_MODES.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Level (0 = cantrip)</Label>
                  <Input
                    className="h-8"
                    type="number"
                    min={0}
                    value={table.filters.level}
                    onChange={(e) => patchFilter({ level: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Subschool</Label>
                  <Input
                    className="h-8"
                    placeholder="e.g. Dunamancy"
                    value={table.filters.subschool}
                    onChange={(e) => patchFilter({ subschool: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Casting time</Label>
                  <Input
                    className="h-8"
                    placeholder="Action, Bonus…"
                    value={table.filters.castingTime}
                    onChange={(e) => patchFilter({ castingTime: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Duration</Label>
                  <Input
                    className="h-8"
                    placeholder="Instant, 1 minute…"
                    value={table.filters.duration}
                    onChange={(e) => patchFilter({ duration: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Save / attack</Label>
                  <Select
                    value={table.filters.save}
                    onValueChange={(v) => patchFilter({ save: v })}
                  >
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TABLE_SAVE_MODES.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Melee / ranged</Label>
                  <Select
                    value={table.filters.range}
                    onValueChange={(v) => patchFilter({ range: v })}
                  >
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TABLE_RANGE_MODES.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Target</Label>
                  <Input
                    className="h-8"
                    placeholder="e.g. one creature"
                    value={table.filters.target}
                    onChange={(e) => patchFilter({ target: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Area of effect</Label>
                  <Input
                    className="h-8"
                    placeholder="e.g. 20-foot cone"
                    value={table.filters.area}
                    onChange={(e) => patchFilter({ area: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Effect</Label>
                  <Input
                    className="h-8"
                    placeholder="e.g. damage, healing"
                    value={table.filters.effect}
                    onChange={(e) => patchFilter({ effect: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Casting materials</Label>
                  <Input
                    className="h-8"
                    placeholder="e.g. a bit of fleece"
                    value={table.filters.materials}
                    onChange={(e) => patchFilter({ materials: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-[10px]">Options (one per line)</Label>
              <Textarea
                className="min-h-24"
                placeholder={"Fire Bolt\nMagic Missile\nShield"}
                value={table.optionsText}
                onChange={(e) => patch({ optionsText: e.target.value })}
              />
            </div>
          )}

          <div className="flex justify-end gap-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={!name.trim()}
              onClick={() => {
                onSave({ name: name.trim(), table });
                onClose();
              }}
            >
              Add table
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
