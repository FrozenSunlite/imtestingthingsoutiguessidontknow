import { useLibList, ListHeader, EntryCard, EmptyNote } from "./shared";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/skilltree/InfoTip";

// Weapon Properties: a name plus a free-form description of what it does.
export function WeaponPropertiesTab() {
  const { items, add, patch, remove, query, setQuery, shown } = useLibList("properties");

  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() => add({ name: "", description: "" })}
        addLabel="Add property"
        query={query}
        setQuery={setQuery}
        searchPlaceholder="Search properties…"
      />
      {shown.length === 0 ? (
        <EmptyNote items={items} query={query} />
      ) : (
        shown.map(({ e, i }) => (
          <EntryCard key={i} entry={e} onPatch={(p) => patch(i, p)} onDelete={() => remove(i)}>
            <InfoTip label="The property's name, e.g. Finesse.">
              <Input
                value={e.name || ""}
                placeholder="Property name"
                onChange={(ev) => patch(i, { name: ev.target.value })}
              />
            </InfoTip>
          </EntryCard>
        ))
      )}
    </div>
  );
}