import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { matchesQuery } from "@/lib/textSearch";
import { Plus } from "lucide-react";

const LEVELS = [
  ["cantrip", "Cantrip"],
  ["1", "1st level"],
  ["2", "2nd level"],
  ["3", "3rd level"],
  ["4", "4th level"],
  ["5", "5th level"],
  ["6", "6th level"],
  ["7", "7th level"],
  ["8", "8th level"],
  ["9", "9th level"],
];

// Searchable "Add from library" picker for spells: filter by name, school and
// level, then click a row to add it to the character's spell list.
export function SpellLibraryPicker({ spells, onPick }) {
  const [q, setQ] = useState("");
  const [school, setSchool] = useState("all");
  const [level, setLevel] = useState("all");
  const schools = [...new Set(spells.map((s) => s.school).filter(Boolean))].sort();
  const shown = spells.filter(
    (sp) =>
      (!q.trim() || matchesQuery(sp.name, q)) &&
      (school === "all" || (sp.school || "") === school) &&
      (level === "all" || (sp.level || "cantrip") === level)
  );
  return (
    <div className="space-y-1.5 rounded-md border p-2">
      <Label className="text-[10px] text-muted-foreground">Add from library</Label>
      <div className="flex flex-wrap gap-1.5">
        <Input
          className="h-8 min-w-32 flex-1"
          placeholder="Search spells by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={school} onValueChange={setSchool}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All schools</SelectItem>
            {schools.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {LEVELS.map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="max-h-44 space-y-0.5 overflow-y-auto">
        {shown.map((sp, i) => (
          <div
            key={sp.name + i}
            className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent"
          >
            <span className="flex-1 truncate text-xs">{sp.name}</span>
            <span className="text-[10px] text-muted-foreground">
              {[
                (sp.level || "cantrip") === "cantrip" ? "Cantrip" : `${sp.level} lvl`,
                sp.school,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <Button size="sm" variant="ghost" title="Add spell" onClick={() => onPick(sp)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {shown.length === 0 && (
          <p className="py-2 text-center text-xs text-muted-foreground">No spells match.</p>
        )}
      </div>
    </div>
  );
}