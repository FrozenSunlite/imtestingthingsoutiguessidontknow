import { useLibList, ListHeader, EmptyNote, EntryCard } from "./shared";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/skilltree/InfoTip";

// Reference Library tab: the list of creature types a node resource can
// grant or replace (Humanoid, Fey, Monstrosity, Aberration, …).
export function CreatureTypesTab() {
  const { items, add, patch, remove, query, setQuery, shown } = useLibList("creatureTypes");
  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() => add({ name: "", description: "" })}
        addLabel="Add creature type"
        query={query}
        setQuery={setQuery}
        searchPlaceholder="Search types…"
      />
      {shown.length === 0 ? (
        <EmptyNote items={items} query={query} />
      ) : (
        shown.map(({ e, i }) => (
          <EntryCard
            key={i}
            entry={e}
            onPatch={(p) => patch(i, p)}
            onDelete={() => remove(i)}
          >
            <InfoTip label="Creature type, e.g. Aberration.">
              <Input
                className="h-8"
                placeholder="Type (e.g. Aberration)"
                value={e.name || ""}
                onChange={(ev) => patch(i, { name: ev.target.value })}
              />
            </InfoTip>
          </EntryCard>
        ))
      )}
    </div>
  );
}