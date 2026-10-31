import { useLibList, ListHeader, EntryCard, EmptyNote } from "./shared";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { importImage } from "@/lib/imageStore";
import { benefitDragProps } from "@/lib/benefits";
import { ImagePlus } from "lucide-react";

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
          <EntryCard
            key={i}
            entry={e}
            onPatch={(p) => patch(i, p)}
            onDelete={() => remove(i)}
            dragProps={benefitDragProps("mastery", e.name, {
              description: e.description,
              image: e.image,
            })}
          >
            <InfoTip label="The mastery's name, e.g. Sap or Topple.">
              <Input
                value={e.name || ""}
                placeholder="Mastery name"
                onChange={(ev) => patch(i, { name: ev.target.value })}
              />
            </InfoTip>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent">
                <ImagePlus className="h-3.5 w-3.5" /> Upload image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (ev) => {
                    const file = ev.target.files?.[0];
                    ev.target.value = "";
                    if (!file) return;
                    try {
                      const url = await importImage(file);
                      if (url) patch(i, { image: url });
                    } catch {
                      /* unsupported image */
                    }
                  }}
                />
              </label>
              <Input
                className="h-7 min-w-0 flex-1 text-[11px]"
                placeholder="Image URL or /images/…"
                value={e.image || ""}
                onChange={(ev) => patch(i, { image: ev.target.value })}
              />
            </div>
          </EntryCard>
        ))
      )}
    </div>
  );
}
