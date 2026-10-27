// Configurable hotkey combos: stored as strings like "ctrl+shift+e".

export const DEFAULT_HOTKEYS = {
  undo: "ctrl+z",
  redo: "ctrl+y",
  rotateRight: "ctrl+e",
  rotateLeft: "ctrl+q",
  flipH: "ctrl+f",
  flipV: "ctrl+g",
  delete: "delete",
  copy: "ctrl+c",
  cut: "ctrl+x",
  paste: "ctrl+v",
  selectAll: "ctrl+a",
  selectAllTab: "ctrl+shift+a",
};

export function comboFromEvent(e) {
  const k = (e.key || "").toLowerCase();
  if (["control", "shift", "alt", "meta"].includes(k)) return null;
  const parts = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  if (e.metaKey) parts.push("meta");
  const key = k === " " ? "space" : k;
  parts.push(key);
  return parts.join("+");
}

export function comboMatches(e, combo) {
  if (!combo) return false;
  const parts = String(combo).toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const k = (e.key || "").toLowerCase();
  const norm = k === " " ? "space" : k;
  if (norm !== key) return false;
  return (
    e.ctrlKey === parts.includes("ctrl") &&
    e.shiftKey === parts.includes("shift") &&
    e.altKey === parts.includes("alt") &&
    e.metaKey === parts.includes("meta")
  );
}

export function formatCombo(combo) {
  if (!combo) return "—";
  return String(combo)
    .split("+")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("+");
}