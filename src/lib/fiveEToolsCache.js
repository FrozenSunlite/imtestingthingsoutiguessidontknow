// Raw 5eTools source files fetched by the Reference Index. Kept out of the
// working library until the user opts to include them in a save.
const sources = new Map();

export function cacheFiveEToolsSource(path, data) {
  if (path) sources.set(path, data);
}

export function getFiveEToolsSources() {
  return Object.fromEntries(sources.entries());
}

export function restoreFiveEToolsSources(obj) {
  if (!obj || typeof obj !== "object") return;
  Object.entries(obj).forEach(([path, data]) => sources.set(path, data));
}

export function cachedFiveEToolsSource(path) {
  return sources.get(path);
}
