// Copy / paste / delete helpers for Homebuilder selections. Pure functions:
// they take the plot (and a floor id for floor-bound items) and return either
// a new plot, a cleaned-up selection, or null when nothing matches / fits.
import {
  furnishingByName, plotBoundary, overlaps, containingFacility,
  floorFacilities, floorFurnishings, floorConnections, floorWalls, uid,
} from "./homestead";

const clone = (x) => JSON.parse(JSON.stringify(x));

// Does a placed item of this kind still exist on the plot?
const exists = (plot, kind, id) =>
  kind === "facility" ? (plot.facilities || []).some((x) => x.id === id)
  : kind === "furnishing" ? (plot.furnishings || []).some((x) => x.id === id)
  : kind === "connection" ? (plot.connections || []).some((x) => x.id === id)
  : kind === "wall" ? (plot.walls || []).some((x) => x.id === id)
  : false;

// The selection with deleted items dropped; null when nothing remains.
export function selectionValid(plot, selection) {
  if (!plot || !selection) return null;
  if (selection.kind === "multi") {
    const items = selection.items.filter((i) => exists(plot, i.kind, i.id));
    return items.length === selection.items.length
      ? selection
      : items.length ? { kind: "multi", items } : null;
  }
  return exists(plot, selection.kind, selection.id) ? selection : null;
}

// Remove every selected item from the plot: a Tower takes its upper storeys,
// the furnishings inside deleted facilities, and its built-in staircases.
export function deleteSelectionFromPlot(plot, selection) {
  if (!plot || !selection) return plot;
  const items = selection.kind === "multi" ? selection.items : [selection];
  const facIds = new Set(items.filter((i) => i.kind === "facility").map((i) => i.id));
  for (const f of plot.facilities || []) if (f.stackOf && facIds.has(f.stackOf)) facIds.add(f.id);
  const furIds = new Set(items.filter((i) => i.kind === "furnishing").map((i) => i.id));
  const conIds = new Set(items.filter((i) => i.kind === "connection").map((i) => i.id));
  const walIds = new Set(items.filter((i) => i.kind === "wall").map((i) => i.id));
  const goneFurs = new Set((plot.furnishings || []).filter((fu) => facIds.has(fu.facilityId)).map((fu) => fu.id));
  const stack = (plot.facilities || []).filter((f) => facIds.has(f.id));
  const stairIds = new Set((plot.connections || []).filter((c) =>
    c.type === "Staircase" &&
    stack.some((x) => x.floorId === c.floorId && c.x >= x.x && c.x < x.x + x.w && c.y >= x.y && c.y < x.y + x.h)
  ).map((s) => s.id));
  return {
    ...plot,
    facilities: (plot.facilities || []).filter((x) => !facIds.has(x.id)),
    furnishings: (plot.furnishings || []).filter((x) => !furIds.has(x.id) && !goneFurs.has(x.id)),
    connections: (plot.connections || []).filter((c) => !conIds.has(c.id) && !stairIds.has(c.id)),
    walls: (plot.walls || []).filter((x) => !walIds.has(x.id)),
  };
}

// Deep-clone the selected items that live on the given floor — the clipboard.
// Loose furnishings ride along; furnishings inside a facility only when that
// facility sits on this floor.
export function copySelection(plot, selection, floorId) {
  if (!plot || !selection) return null;
  const items = selection.kind === "multi" ? selection.items : [selection];
  const out = [];
  for (const sel of items) {
    if (sel.kind === "facility") {
      const f = (plot.facilities || []).find((x) => x.id === sel.id && x.floorId === floorId);
      if (f) out.push({ kind: "facility", item: clone(f) });
    } else if (sel.kind === "furnishing") {
      const fu = (plot.furnishings || []).find((x) => x.id === sel.id);
      if (!fu) continue;
      const fac = (plot.facilities || []).find((x) => x.id === fu.facilityId);
      if (!fac || fac.floorId === floorId) out.push({ kind: "furnishing", item: clone(fu) });
    } else if (sel.kind === "connection") {
      const c = (plot.connections || []).find((x) => x.id === sel.id && x.floorId === floorId);
      if (c) out.push({ kind: "connection", item: clone(c) });
    } else if (sel.kind === "wall") {
      const wl = (plot.walls || []).find((x) => x.id === sel.id && x.floorId === floorId);
      if (wl) out.push({ kind: "wall", item: clone(wl) });
    }
  }
  return out.length ? out : null;
}

// A thin interior wall (or a door drawn on its model) may sit on the
// boundary's edge grid lines — the line lies between squares, so a run one
// row past the edge is still on the land.
export function wallLineInBounds(item, boundary) {
  return item.h === 1
    ? item.y >= 0 && item.y <= boundary.h && item.x >= 0 && item.x + item.w <= boundary.w
    : item.x >= 0 && item.x <= boundary.w && item.y >= 0 && item.y + item.h <= boundary.h;
}

// Would a pasted copy of one item fit at its (already offset) position?
function pasteFits(plot, floorId, boundary, kind, item) {
  if (item.x < 0 || item.y < 0) return false;
  if (kind === "facility") {
    if (item.x + item.w > boundary.w || item.y + item.h > boundary.h) return false;
    return !floorFacilities(plot, floorId).some((f) => overlaps(item, f));
  }
  if (kind === "furnishing") {
    const def = furnishingByName(item.type) || {};
    if (item.x + item.w > boundary.w || item.y + item.h > boundary.h) return false;
    const fac = containingFacility(plot, floorId, item);
    if (!fac && !def.outdoor) return false;
    if (floorFurnishings(plot, floorId).some((f) => overlaps(item, f))) return false;
    if (!fac && floorFacilities(plot, floorId).some((f) => overlaps(item, f))) return false;
    return true;
  }
  if (kind === "connection") {
    if (item.x >= boundary.w || item.y >= boundary.h) return false;
    return !floorConnections(plot, floorId).some((c) => c.type === item.type && c.x === item.x && c.y === item.y);
  }
  // wall
  if (item.type === "Interior Wall") return wallLineInBounds(item, boundary);
  if (item.x + item.w > boundary.w || item.y + item.h > boundary.h) return false;
  return (
    !floorWalls(plot, floorId).some((wl) => overlaps(item, wl)) &&
    !floorFacilities(plot, floorId).some((f) => overlaps(item, f)) &&
    !floorFurnishings(plot, floorId).some((fu) => overlaps(item, fu))
  );
}

// Paste the clipboard onto a floor, trying nearby offsets until every item
// fits. Returns { plot, selection } with the pasted items selected, or null
// when no nearby spot is free.
export function pasteClipboard(clipboard, plot, floorId) {
  if (!plot || !clipboard?.length) return null;
  const boundary = plotBoundary(plot);
  const minx = Math.min(...clipboard.map((e) => e.item.x));
  const miny = Math.min(...clipboard.map((e) => e.item.y));
  const bboxW = Math.max(...clipboard.map((e) => e.item.x + (e.item.w ?? 1))) - minx;
  const bboxH = Math.max(...clipboard.map((e) => e.item.y + (e.item.h ?? 1))) - miny;
  const offsets = [[1, 1], [2, 1], [1, 2], [2, 2], [0, 1], [1, 0], [3, 1], [1, 3], [2, 3], [3, 2], [3, 3], [0, 0]];
  for (const [dx, dy] of offsets) {
    if (minx + dx < 0 || miny + dy < 0) continue;
    if (minx + dx + bboxW > boundary.w || miny + dy + bboxH > boundary.h) continue;
    if (!clipboard.every(({ kind, item }) =>
      pasteFits(plot, floorId, boundary, kind, { ...item, x: item.x + dx, y: item.y + dy })
    )) continue;

    // Facilities first, so cloned furnishings can be re-pointed at the
    // facility copies they ride inside.
    const facIds = new Map(); // old facility id → pasted clone id
    const pastedFac = [];
    for (const { kind, item } of clipboard) {
      if (kind !== "facility") continue;
      const c = clone(item);
      c.id = uid();
      c.x = item.x + dx;
      c.y = item.y + dy;
      c.floorId = floorId;
      for (const key of ["attic", "floor", "cellar"])
        if (c[key]?.items) c[key] = { ...c[key], items: c[key].items.map((it) => ({ ...it, id: uid() })) };
      facIds.set(item.id, c.id);
      pastedFac.push(c);
    }
    const pastedRest = [];
    for (const { kind, item } of clipboard) {
      if (kind === "facility") continue;
      const c = clone(item);
      c.id = uid();
      c.x = item.x + dx;
      c.y = item.y + dy;
      if (kind === "furnishing") {
        const mapped = facIds.get(c.facilityId);
        if (mapped) c.facilityId = mapped;
        else {
          const fac = [...pastedFac, ...floorFacilities(plot, floorId)].find((f) =>
            c.x >= f.x && c.y >= f.y && c.x + c.w <= f.x + f.w && c.y + c.h <= f.y + f.h
          );
          c.facilityId = fac ? fac.id : null;
        }
      } else {
        c.floorId = floorId;
      }
      pastedRest.push({ kind, item: c });
    }
    const pasted = [
      ...pastedFac.map((item) => ({ kind: "facility", item })),
      ...pastedRest,
    ];
    return {
      plot: {
        ...plot,
        facilities: [...(plot.facilities || []), ...pastedFac],
        furnishings: [...(plot.furnishings || []), ...pastedRest.filter((e) => e.kind === "furnishing").map((e) => e.item)],
        connections: [...(plot.connections || []), ...pastedRest.filter((e) => e.kind === "connection").map((e) => e.item)],
        walls: [...(plot.walls || []), ...pastedRest.filter((e) => e.kind === "wall").map((e) => e.item)],
      },
      selection: { kind: "multi", items: pasted.map((e) => ({ kind: e.kind, id: e.item.id })) },
    };
  }
  return null;
}