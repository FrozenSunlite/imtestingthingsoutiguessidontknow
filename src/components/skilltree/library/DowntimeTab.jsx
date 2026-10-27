import { useLibList, ListHeader, EmptyNote, EntryCard } from "./shared";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/skilltree/InfoTip";

// Downtime Actions tab: each entry is an activity a character performs between
// adventures. It carries either a time requirement (e.g. "8 hours") or a cost
// in Downtime Action Points — a number or a formula that can scale with
// proficiency, e.g. "prof", "prof * 2".
export function DowntimeTab() {
  const d = useLibList("downtimeActions");
  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() => d.add({ name: "", time: "", cost: "", description: "" })}
        addLabel="Add downtime action"
        query={d.query}
        setQuery={d.setQuery}
        searchPlaceholder="Search downtime actions…"
      />
      <EmptyNote items={d.items} query={d.query} />
      {d.shown.map(({ e, i }) => (
        <EntryCard key={i} entry={e} onPatch={(p) => d.patch(i, p)} onDelete={() => d.remove(i)}>
          <div className="grid grid-cols-2 gap-1.5">
            <InfoTip label="The downtime action's display name, e.g. Training.">
              <Input
                className="h-8"
                placeholder="Name"
                value={e.name || ""}
                onChange={(ev) => d.patch(i, { name: ev.target.value })}
              />
            </InfoTip>
            <InfoTip label="How long the activity takes, e.g. 8 hours, 3 days, 1 workweek.">
              <Input
                className="h-8"
                placeholder="Time requirement"
                value={e.time || ""}
                onChange={(ev) => d.patch(i, { time: ev.target.value })}
              />
            </InfoTip>
            <InfoTip label="Cost in Downtime Action Points — a number or a formula that scales with proficiency bonus, e.g. prof or prof * 2.">
              <Input
                className="h-8"
                placeholder="DAP cost (e.g. prof * 2)"
                value={e.cost || ""}
                onChange={(ev) => d.patch(i, { cost: ev.target.value })}
              />
            </InfoTip>
          </div>
        </EntryCard>
      ))}
      <p className="text-[10px] text-muted-foreground">
        Downtime Action Costs are written in Downtime Action Points (DAP) — a number or a formula
        such as "prof" or "prof * 2", so the cost scales with the character's proficiency bonus.
      </p>
    </div>
  );
}