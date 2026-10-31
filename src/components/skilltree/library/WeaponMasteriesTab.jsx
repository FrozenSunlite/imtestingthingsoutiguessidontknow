import { useLibList, ListHeader, EntryCard, EmptyNote } from "./shared";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/skilltree/InfoTip";

// 2024 Weapon Masteries: a name plus the rules text applied when a weapon with
// that mastery hits (Sap, Vex, Topple, etc.). Weapons reference these by name.
export function WeaponMasteriesTab() {
  const { items, add, patch, remove, query, setQuery, shown } = useLibList("weaponMasteries");

  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() => add({ name: "", description: "" })}
        addLabel="Add mastery"
        query={query}
        setQuery={setQuery}
        searchPlaceholder="Search masteries…"
      />
      {shown.length === 0 ? (
        <EmptyNote items={items} query={query} />
      ) : (
        shown.map(({ e, i }) => (
          <EntryCard key={i} entry={e} onPatch={(p) => patch(i, p)} onDelete={() => remove(i)}>
            <InfoTip label="The mastery's name, e.g. Sap or Topple.">
              <Input
                value={e.name || ""}
                placeholder="Mastery name"
                onChange={(ev) => patch(i, { name: ev.target.value })}
              />
            </InfoTip>
          </EntryCard>
        ))
      )}
    </div>
  );
}
