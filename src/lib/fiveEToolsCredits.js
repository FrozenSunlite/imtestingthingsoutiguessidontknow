// Extract creator credits from 5eTools homebrew metadata. Brew files carry a
// `_meta.sources` array with authors; catalog file names also carry an author
// before the semicolon.
const addName = (out, value) => {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((v) => addName(out, v));
    return;
  }
  if (typeof value === "string") {
    const name = value.trim();
    if (name) out.add(name);
    return;
  }
  if (typeof value === "object") {
    addName(out, value.name);
  }
};

export function authorsFromBrew(raw, entry, info) {
  const out = new Set();
  (raw?._meta?.sources || []).forEach((source) => {
    if (Array.isArray(source?.authors) && source.authors.length) addName(out, source.authors);
    else addName(out, source?.convertedBy);
  });
  addName(out, entry?.author);
  addName(out, entry?.authors);
  addName(out, entry?._meta?.authors);
  if (info?.author) addName(out, info.author);
  return [...out];
}
