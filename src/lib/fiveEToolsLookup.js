// Lazy loader for 5eTools' generated spell→class/subclass lookup. Current
// data files no longer put a `classes` object on each spell, so the Reference
// Index reads this lookup to show which classes can cast a previewed spell.
let cache = null;
let pending = null;

export async function loadSpellLookup() {
  if (cache) return cache;
  if (!pending) {
    pending = fetch("/api/5etools/file?root=data&path=generated%2Fgendata-spell-source-lookup.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        cache = data && typeof data === "object" ? data : null;
        return cache;
      })
      .catch(() => null)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

const addAll = (set, map) => {
  Object.values(map || {}).forEach((classes) => {
    Object.keys(classes || {}).forEach((name) => set.add(name));
  });
};

export function spellClassNames(entry, lookup) {
  if (!lookup || !entry?.name) return "";
  const name = String(entry.name).toLowerCase();
  const classes = new Set();
  Object.values(lookup).forEach((spells) => {
    const data =
      spells?.[name] ||
      Object.entries(spells || {}).find(([k]) => k.toLowerCase() === name)?.[1];
    if (data) addAll(classes, data.class);
  });
  return Array.from(classes).sort().join(", ");
}
