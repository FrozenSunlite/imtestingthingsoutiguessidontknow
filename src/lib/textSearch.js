// Unicode-safe, failsafe text matching for every search box in the app.
// Handles any value type (numbers, objects) without throwing, and folds case,
// full-width forms, accents and compatibility variants so that e.g. "Pokémon"
// matches "pokemon", "Ｓｐｅｌｌ" matches "spell", Cyrillic matches caselessly
// (Москва ≍ москва), and kanji/kana/emoji are normalized identically on both
// sides of the comparison.
export function normText(value) {
  let s;
  try {
    s = String(value ?? "");
  } catch {
    s = "";
  }
  return s
    .normalize("NFKC") // full-width → ASCII, compatibility variants, emoji presentation
    .toLowerCase() // Cyrillic, Greek, Latin case folding
    .normalize("NFD") // split accented characters into base + marks
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics (é → e)
    .replace(/\s+/g, " ")
    .trim();
}

// Library entries come as strings, {name}, {name, description} or (from older
// imports) a nested name object. Return a printable title without ever handing
// an object to React.
export function entryName(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    const name = value.name;
    if (typeof name === "string" || typeof name === "number") return String(name);
    if (name && typeof name === "object") return entryName(name);
  }
  return "";
}

// True when `value` contains the search `query` (empty query matches all).
export function matchesQuery(value, query) {
  const q = normText(query);
  if (!q) return true;
  return normText(value).includes(q);
}