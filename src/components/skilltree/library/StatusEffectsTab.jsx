import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { matchesQuery } from "@/lib/textSearch";
import { ListHeader, EmptyNote, NameList } from "./shared";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { InfoTip } from "@/components/skilltree/InfoTip";

// Reference Library tab: status effects a character can receive or grant
// (burning, charmed, frightened…). Each carries a kind, a description and
// the concrete effects it applies while active.
export function StatusEffectsTab() {
  const { settings, setSettings } = useTree();
  const statusEffects = settings?.library?.statusEffects || [];
  const setStatusEffects = (next) =>
    setSettings((s) => ({ ...s, library: { ...s.library, statusEffects: next } }));
  const [q, setQ] = useState("");

  const filtered = statusEffects
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => matchesQuery(e?.name, q));
  const add = () =>
    setStatusEffects([
      ...statusEffects,
      { name: "", kind: "condition", description: "", effects: [] },
    ]);
  const patch = (i, p) => {
    const next = [...statusEffects];
    next[i] = { ...next[i], ...p };
    setStatusEffects(next);
  };
  const remove = (i) => setStatusEffects(statusEffects.filter((_, j) => j !== i));

  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={add}
        addLabel="Add status effect"
        query={q}
        setQuery={setQ}
        searchPlaceholder="Search statuses…"
      />
      {filtered.length === 0 ? (
        <EmptyNote items={statusEffects} query={q} />
      ) : (
        filtered.map(({ e, i }) => (
          <div key={i} className="space-y-1.5 rounded-md border p-2">
            <div className="flex items-center gap-1.5">
              <InfoTip label="The status effect's name, e.g. Burning.">
                <Input
                  className="h-8 flex-1"
                  placeholder="Status name (e.g. Burning)"
                  value={e.name || ""}
                  onChange={(ev) => patch(i, { name: ev.target.value })}
                />
              </InfoTip>
              <Select value={e.kind || "condition"} onValueChange={(v) => patch(i, { kind: v })}>
                <InfoTip label="A buff helps the character; a debuff or condition hinders them.">
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                </InfoTip>
                <SelectContent>
                  <SelectItem value="condition">Condition</SelectItem>
                  <SelectItem value="buff">Buff</SelectItem>
                  <SelectItem value="debuff">Debuff</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" onClick={() => remove(i)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <InfoTip label="What being under this status means — shown on the sheet.">
              <Textarea
                className="min-h-12 text-xs"
                placeholder="What does this status do?"
                value={e.description || ""}
                onChange={(ev) => patch(i, { description: ev.target.value })}
              />
            </InfoTip>
            <NameList
              label="Effects while active"
              entries={e.effects || []}
              onChange={(n) => patch(i, { effects: n })}
              placeholder="Effect (e.g. Disadvantage on attack rolls)"
            />
          </div>
        ))
      )}
      <p className="text-[10px] text-muted-foreground">
        Active statuses are toggled on the character sheet; actions can require or grant them.
      </p>
    </div>
  );
}