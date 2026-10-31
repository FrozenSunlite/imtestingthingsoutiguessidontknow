import { useLibList, ListHeader, EmptyNote, EntryCard } from "./shared";
import { benefitDragProps } from "@/lib/benefits";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/skilltree/InfoTip";

// Reference Library tabs for movement and sense TYPES (names only — the
// values live on the character sheet and in node resources). Types defined
// here appear as extra rows in the View page's Speed and Senses sections.
function TypeListTab({ libKey, addLabel, placeholder, tip, dragCategory }) {
  const { items, add, patch, remove, query, setQuery, shown } = useLibList(libKey);
  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() => add({ name: "", description: "" })}
        addLabel={addLabel}
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
            dragProps={
              dragCategory
                ? benefitDragProps(dragCategory, e.name, {
                    description: e.description,
                    image: e.image,
                  })
                : undefined
            }
          >
            <InfoTip label={tip}>
              <Input
                className="h-8"
                placeholder={placeholder}
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

export function SpeedTypesTab() {
  return (
    <TypeListTab
      libKey="speedTypes"
      addLabel="Add speed type"
      placeholder="Speed type (e.g. Levitating)"
      tip="Extra speed type shown on the sheet — nodes add to it with a resource named “<Type> Speed”."
      dragCategory="speed"
    />
  );
}

export function SensesLibraryTab() {
  return (
    <TypeListTab
      libKey="senses"
      addLabel="Add sense"
      placeholder="Sense (e.g. Lifesense)"
      tip="Extra sense shown on the sheet — nodes add to it with a resource named after the sense."
      dragCategory="sense"
    />
  );
}