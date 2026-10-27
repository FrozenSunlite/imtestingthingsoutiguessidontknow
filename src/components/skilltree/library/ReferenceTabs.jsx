import { useTree } from "@/lib/treeStore";
import { NameList } from "./shared";

// Simple reference lists: damage types (for weapons, spells and effects),
// adventuring-gear categories (for the gear tab's category picker) and
// languages (for language proficiencies and requirements).
export function LanguagesTab() {
  const { settings, setSettings } = useTree();
  const lib = settings.library;
  const setList = (key, next) =>
    setSettings((s) => ({ ...s, library: { ...s.library, lists: { ...s.library.lists, [key]: next } } }));
  return (
    <NameList
      label="Languages (suggestions for language proficiencies and requirements)"
      entries={lib.lists?.languages || []}
      onChange={(next) => setList("languages", next)}
      placeholder="e.g. Elvish"
    />
  );
}
export function DamageTypesTab() {
  const { settings, setSettings } = useTree();
  const lib = settings.library;
  const setLib = (patch) => setSettings((s) => ({ ...s, library: { ...s.library, ...patch } }));
  return (
    <NameList
      label="Damage types"
      entries={lib.damageTypes || []}
      onChange={(next) => setLib({ damageTypes: next })}
      placeholder="e.g. Fire"
    />
  );
}

export function GearCategoriesTab() {
  const { settings, setSettings } = useTree();
  const lib = settings.library;
  const setLib = (patch) => setSettings((s) => ({ ...s, library: { ...s.library, ...patch } }));
  return (
    <NameList
      label="Adventuring gear categories"
      entries={lib.adventureGearCategories || []}
      onChange={(next) => setLib({ adventureGearCategories: next })}
      placeholder="e.g. Tools"
    />
  );
}