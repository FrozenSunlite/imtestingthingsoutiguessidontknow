import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { matchesQuery } from "@/lib/textSearch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GripVertical, Plus, X } from "lucide-react";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { benefitDragProps } from "@/lib/benefits";
import { NameList } from "./shared";

// Reference Library tab: spell schools (Evocation…) and subschools
// (Dunamancy, Sangromancy…), optionally tied to a parent school.
export function SpellSchoolsTab() {
  const { settings, setSettings } = useTree();
  const lib = settings?.library || {};
  const setLib = (patch) =>
    setSettings((s) => ({ ...s, library: { ...s.library, ...patch } }));
  const schools = lib.spellSchools || [];
  const subschools = lib.spellSubschools || [];
  const [q, setQ] = useState("");

  const setSubs = (next) => setLib({ spellSubschools: next });
  const shown = subschools
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => matchesQuery(s?.name, q));

  return (
    <div className="space-y-2">
      <NameList
        label="Spell Schools"
        entries={schools}
        onChange={(n) => setLib({ spellSchools: n })}
        placeholder="School (e.g. Evocation)"
        dragCategory="spellSchool"
      />
      <div className="rounded-md border p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">
            Spell Subschools (e.g. Dunamancy, Sangromancy)
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSubs([...subschools, { name: "", parent: "" }])}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <InfoTip label="Filter subschools by name.">
          <Input
            className="mt-1 h-7"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </InfoTip>
        <div className="mt-1 space-y-1">
          {shown.map(({ s, i }) => (
            <div key={i} className="flex items-center gap-1">
              <span
                {...benefitDragProps("spellSubschool", s.name, { parent: s.parent })}
                className="cursor-grab active:cursor-grabbing"
                title="Drag onto a node to grant spells from this subschool"
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <InfoTip label="The subschool's name.">
                <Input
                  className="h-8 flex-1"
                  placeholder="Subschool (e.g. Dunamancy)"
                  value={s.name || ""}
                  onChange={(e) => {
                    const next = [...subschools];
                    next[i] = { ...s, name: e.target.value };
                    setSubs(next);
                  }}
                />
              </InfoTip>
              <Select
                value={s.parent || "__any__"}
                onValueChange={(v) => {
                  const next = [...subschools];
                  next[i] = { ...s, parent: v === "__any__" ? "" : v };
                  setSubs(next);
                }}
              >
                <InfoTip label="Parent school, or 'Any school' to allow it with any school.">
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue placeholder="Any school" />
                  </SelectTrigger>
                </InfoTip>
                <SelectContent>
                  <SelectItem value="__any__">Any school</SelectItem>
                  {schools.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSubs(subschools.filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {shown.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {q.trim() ? "No matches." : "Empty."}
            </p>
          )}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          A subschool with a parent school only appears for spells of that school.
        </p>
      </div>
    </div>
  );
}