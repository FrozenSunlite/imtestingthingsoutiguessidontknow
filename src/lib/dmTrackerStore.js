// The DM Screen's combat tracker persists in the browser between sessions.
export const DM_TRACKER_KEY = "skilltree:dmTracker";

export function loadDmTracker() {
  try {
    const saved = JSON.parse(localStorage.getItem(DM_TRACKER_KEY) || "null");
    if (saved && Array.isArray(saved.entries)) return saved;
  } catch {
    /* ignore */
  }
  return { round: 1, activeId: null, entries: [] };
}