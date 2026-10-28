// Import provenance and rollback.
//
// Every imported record is tagged with `importSource` (an import session id)
// and a short label. The library keeps a small history so a whole import can be
// removed later without touching hand-made entries. Objects are plain JSON, so
// tags survive project saves.
let sequence = 0;

export function newImportId() {
  sequence += 1;
  return `imp_${Date.now().toString(36)}_${sequence.toString(36)}_${Math.floor(
    Math.random() * 1e4
  ).toString(36)}`;
}

export function tagImported(value, importId, meta = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return {
    ...value,
    importSource: importId,
    importLabel: meta.label || value.importLabel || "",
    importRoot: meta.root || value.importRoot || "",
    importedAt: meta.at || value.importedAt || new Date().toISOString(),
  };
}

export function recordImport(library, record) {
  if (!library || !record?.id) return library;
  const history = Array.isArray(library.importHistory) ? [...library.importHistory] : [];
  history.unshift({
    id: record.id,
    at: record.at || new Date().toISOString(),
    label: record.label || "Import",
    root: record.root || "",
    category: record.category || "",
    count: Number(record.count) || 0,
    tabs: [...(record.tabs || [])],
    tabIds: [...(record.tabIds || [])],
  });
  return {
    ...library,
    importHistory: history.slice(0, 24),
  };
}

const withoutSource = (arr, importId) =>
  Array.isArray(arr) ? arr.filter((value) => value?.importSource !== importId) : arr;

// Remove every record tagged with one import session. Returns the new library
// and the tab ids that belonged to the import so the caller can delete them.
export function removeImportFromLibrary(library, importId) {
  if (!library || !importId) return { library, tabIds: [] };
  const next = { ...library };
  Object.keys(next).forEach((key) => {
    if (key === "lists" || key === "fiveETools" || key === "importHistory") return;
    if (Array.isArray(next[key])) next[key] = withoutSource(next[key], importId);
  });
  if (next.lists && typeof next.lists === "object") {
    const lists = { ...next.lists };
    Object.keys(lists).forEach((key) => {
      if (Array.isArray(lists[key])) lists[key] = withoutSource(lists[key], importId);
    });
    next.lists = lists;
  }
  if (next.fiveETools && typeof next.fiveETools === "object") {
    const map = { ...next.fiveETools };
    Object.keys(map).forEach((key) => {
      map[key] = withoutSource(map[key], importId);
      if (Array.isArray(map[key]) && map[key].length === 0) delete map[key];
    });
    next.fiveETools = map;
  }
  const record = (next.importHistory || []).find((h) => h.id === importId);
  next.importHistory = (next.importHistory || []).filter((h) => h.id !== importId);
  return { library: next, tabIds: record?.tabIds || [] };
}

export function importedCount(library) {
  let count = 0;
  const visit = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((value) => {
      if (value?.importSource) count += 1;
    });
  };
  Object.values(library || {}).forEach(visit);
  Object.values(library?.lists || {}).forEach(visit);
  Object.values(library?.fiveETools || {}).forEach(visit);
  visit(library?.fiveEToolsBooks);
  return count;
}
