// Local persistence for Homebuilder plots. Plots are self-contained JSON
// documents; importing one into a character's sheet stores a snapshot copy on
// the character so saved characters travel with their properties.
import { blankPlot, clonePlot } from "./homestead";

const KEY = "skilltree:homestead";

export function loadPlots() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function savePlots(plots) {
  try {
    localStorage.setItem(KEY, JSON.stringify(plots));
  } catch {
    /* quota */
  }
}

export function newPlot(kind) {
  return blankPlot(kind);
}

// Fold plots from a character save into the store: existing plots (matched by
// id) are updated to the saved version, new ones are appended.
export function mergePlots(saved) {
  if (!Array.isArray(saved) || !saved.length) return loadPlots();
  const byId = new Map(loadPlots().map((p) => [p.id, p]));
  for (const p of saved) if (p && p.id) byId.set(p.id, p);
  const merged = [...byId.values()];
  savePlots(merged);
  return merged;
}

// Snapshot for a character sheet import: an independent deep copy stamped
// with when it was imported.
export function snapshotPlot(plot) {
  const snap = clonePlot(plot);
  snap.importedAt = new Date().toISOString();
  return snap;
}