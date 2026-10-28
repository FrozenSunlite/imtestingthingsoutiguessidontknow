import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Crosshair, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CELL,
  FACILITY_TYPES,
  furnishingByName,
  floorFacilities,
  floorFurnishings,
  floorConnections,
  floorWalls,
  containingFacility,
  overlaps,
  plotHasKind,
  plotBoundary,
  uid,
  ATTACHMENTS,
  ordinal,
  firstFitRoom,
  bastionFacilityByName,
  knownBastionFacilities,
  countedBastionFacilities,
  doorHostSpans,
  doorFits,
} from "@/lib/homestead";
import HomesteadContextMenu from "./HomesteadContextMenu";
import { floorTexture } from "@/lib/worldAssets";
import { BASTION_ORDERS } from "@/lib/homesteadBastionOrders";
import { wallLineInBounds } from "@/lib/homesteadEdit";

const OPENING_TYPES = new Set(["Doorway", "Double Door", "Gate", "Window"]);
const isOpening = (type) => OPENING_TYPES.has(type);
const clampOpeningRun = (run, type) => {
  const max = type === "Double Door" || type === "Gate" ? 2 : 1;
  const horiz = (run.w || 0) >= (run.h || 0);
  return horiz
    ? { ...run, w: Math.min(run.w || 1, max), h: 1 }
    : { ...run, w: 1, h: Math.min(run.h || 1, max) };
};

// Facilities sit at the very bottom of each building's stack, heavily
// transparent so the rooms (furnishings) placed inside them stay readable.
const FAC_FILL = {
  Cramped: "fill-cyan-500/10 stroke-cyan-400/70",
  Roomy: "fill-sky-500/10 stroke-sky-400/70",
  Vast: "fill-indigo-500/10 stroke-indigo-400/70",
  Courtyard: "fill-emerald-500/5 stroke-emerald-500/60",
  Porch: "fill-amber-500/10 stroke-amber-500/60",
  Balcony: "fill-amber-500/10 stroke-amber-500/60",
  Tower: "fill-fuchsia-500/10 stroke-fuchsia-500/60",
};
const CAT_FILL = {
  Living: "fill-cyan-500/30 stroke-cyan-400/80",
  Social: "fill-amber-500/30 stroke-amber-400/80",
  Storage: "fill-slate-500/30 stroke-slate-400/80",
  Business: "fill-fuchsia-500/30 stroke-fuchsia-400/80",
  Outdoor: "fill-emerald-500/25 stroke-emerald-400/80",
  Misc: "fill-violet-500/30 stroke-violet-400/80",
};

// Only basic facilities can take Cellar / Floor / Attic attachments.
const ATTACHABLE = ["Cramped", "Roomy", "Vast"];

// Colours for rooms placed inside a facility's attached storeys.
const SLOT_STYLE = {
  cellar: "fill-violet-500/25 stroke-violet-400/80",
  floor: "fill-sky-500/25 stroke-sky-400/80",
  attic: "fill-amber-500/25 stroke-amber-400/80",
};

// The plot floor-plan canvas: an SVG grid of 1-space cells with pan/zoom.
// Facilities and attachments are placed first, furnishings live inside them
// (outdoor furnishings may sit loose on the floor), and connections tie
// facilities together. Placement follows the active palette tool; items drag
// to move with cell snapping and collision checks, and resizable items have
// draggable edge handles. Left-drag or middle-drag pans; the middle button
// never places. Right-clicking a basic facility offers Cellar / Floor / Attic.
export default function HomesteadCanvas({ plot, floor, tool, setTool, selection, onSelect, update }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState({ x: -160, y: -160 });
  const [drag, setDrag] = useState(null); // { kind, id, offX, offY, x, y }
  const [resize, setResize] = useState(null); // { kind, id, edge, x, y, w, h }
  const [hover, setHover] = useState(null);
  const [info, setInfo] = useState(null); // { x, y, title, lines } — hover benefits window
  const [marquee, setMarquee] = useState(null); // rubber-band box, in cells
  const [wallGhost, setWallGhost] = useState(null); // wall run being drawn, in cells
  const [menu, setMenu] = useState(null); // { x, y, kind, id, type, title } — right-click menu
  const [rot, setRot] = useState(false); // R flips the placement ghost 90°
  const [placeDrag, setPlaceDrag] = useState(null); // box being sized for placement
  const [gesturing, setGesturing] = useState(false);

  // Camera mirrors: the window listeners and wheel handler read fresh values
  // through refs, so no stale closure can stall panning or zooming.
  const viewRef = useRef(view); viewRef.current = view;
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const sizeRef = useRef(size); sizeRef.current = size;
  const gestureRef = useRef(null); // active pan / drag / resize gesture

  useLayoutEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      if (el) setSize({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Non-passive wheel zoom, centered on the cursor — registered once, reading
  // the camera through refs so it never works from stale state.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e) => {
      e.preventDefault();
      const v = viewRef.current, z = zoomRef.current, s = sizeRef.current;
      const rect = svg.getBoundingClientRect();
      const wx = v.x + ((e.clientX - rect.left) / rect.width) * (s.w / z);
      const wy = v.y + ((e.clientY - rect.top) / rect.height) * (s.h / z);
      const nz = Math.min(2.5, Math.max(0.4, z * (e.deltaY > 0 ? 0.9 : 1.11)));
      setView({ x: wx - (wx - v.x) * (z / nz), y: wy - (wy - v.y) * (z / nz) });
      setZoom(nz);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // R while a placement tool is active rotates the ghost 90°; a new tool
  // always starts unrotated.
  useEffect(() => {
    setRot(false);
  }, [tool?.kind, tool?.type]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key !== "r" && e.key !== "R") || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (tool) setRot((r) => !r);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const viewW = size.w / zoom;
  const viewH = size.h / zoom;

  const toCell = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const wx = view.x + ((e.clientX - rect.left) / rect.width) * viewW;
    const wy = view.y + ((e.clientY - rect.top) / rect.height) * viewH;
    return { x: Math.floor(wx / CELL), y: Math.floor(wy / CELL) };
  };

  const boundary = plotBoundary(plot);
  const inBounds = (r) =>
    r.x >= 0 && r.y >= 0 && r.x + r.w <= boundary.w && r.y + r.h <= boundary.h;

  const facs = floorFacilities(plot, floor.id);
  const furs = floorFurnishings(plot, floor.id);
  const conns = floorConnections(plot, floor.id);
  const walls = floorWalls(plot, floor.id);

  const live = (kind, id) =>
    drag && drag.kind === kind && drag.id === id
      ? drag
      : resize && resize.kind === kind && resize.id === id
        ? resize
        : null;

  const facRect = (f) => {
    const d = live("facility", f.id);
    return d ? { ...f, x: d.x, y: d.y, w: d.w ?? f.w, h: d.h ?? f.h } : f;
  };
  const furRect = (fu) => {
    const d = live("furnishing", fu.id);
    return d ? { ...fu, x: d.x, y: d.y, w: d.w ?? fu.w, h: d.h ?? fu.h } : fu;
  };

  // Footprint of the active tool's ghost, honoring R-rotation.
  const ghostDims = (t) => {
    if (t.kind === "facility" || t.kind === "attachment") {
      const d = FACILITY_TYPES[t.type];
      return rot ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
    }
    if (t.kind === "bastion") {
      const d = FACILITY_TYPES[bastionFacilityByName(t.type).space];
      return rot ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
    }
    if (t.kind === "furnish") {
      const [w, h] = furnishingByName(t.type).foot;
      return rot ? { w: h, h: w } : { w, h };
    }
    return { w: 1, h: 1 };
  };

  // Ghost rect for the active placement tool.
  const toolRect = (() => {
    if (!tool || !hover || placeDrag) return null;
    return { ...hover, ...ghostDims(tool) };
  })();

  // Validate and commit a facility placed on the viewed floor.
  const placeFacility = (item) => {
    if (!inBounds(item))
      return toast("That spot is outside the property boundary — buy more land tiles to expand it.");
    if (facs.some((f) => overlaps(item, f)))
      return toast("That spot overlaps another structure on this floor.");
    update((p) => ({ ...p, facilities: [...p.facilities, item] }));
    if (item.type === "Tower") buildTowerStack(item);
    onSelect({ kind: "facility", id: item.id });
  };

  // A Balcony always lands on the storey above the one being viewed — the
  // floor above is created when this is the top floor.
  const placeBalcony = (item) => {
    const upIndex = floor.index + 1;
    const up = plot.floors.find((f) => f.index === upIndex);
    if ((plot.facilities || []).some((f) => f.floorId === up?.id && overlaps(item, f)))
      return toast("That spot is occupied on the floor above.");
    update((p) => {
      const nf = up || { id: uid(), name: `${ordinal(p.floors.filter((f) => f.index >= 0).length + 1)} Floor`, index: upIndex };
      return {
        ...p,
        floors: up ? p.floors : [...p.floors, nf],
        facilities: [...p.facilities, { ...item, floorId: nf.id }],
      };
    });
    onSelect({ kind: "facility", id: item.id });
    toast("Balcony placed on the floor above.");
  };

  // Commit a box-sized facility (Courtyard / Porch / Balcony dragged to size;
  // a plain click uses the default footprint).
  const commitPlaceBox = (box) => {
    const def = FACILITY_TYPES[tool.type];
    let w = box.w, h = box.h;
    if (def.minSpaces) while (w * h < def.minSpaces) w++;
    const item = { id: uid(), type: tool.type, name: tool.type, x: box.x, y: box.y, w, h };
    if (tool.type === "Balcony") return placeBalcony(item);
    placeFacility({ ...item, floorId: floor.id });
  };

  const placeAt = (cell) => {
    if (tool.kind === "bastion") {
      const b = bastionFacilityByName(tool.type);
      if (!b) return;
      if (b.seatOfPower && !plotHasKind(plot, "bastion"))
        return toast("The Seat of Power can only be placed in a Bastion.");
      if ((plot.charLevel || 5) < b.level)
        return toast(`${b.name} requires character level ${b.level}.`);
      if (!b.seatOfPower) {
        const known = knownBastionFacilities(plot.charLevel || 5);
        const used = countedBastionFacilities(plot);
        if (known > 0 && used >= known)
          return toast(
            `Your Bastion knows ${used}/${known} special facilities at level ${plot.charLevel || 5}. The Seat of Power is free and does not count.`
          );
      }
      if (!b.multi && (plot.facilities || []).some((f) => f.bastion === b.name))
        return toast(`Your Bastion already has a ${b.name} — one only.`);
      const { w, h } = ghostDims(tool);
      placeFacility({
        id: uid(), floorId: floor.id, type: b.space, bastion: b.name, level: b.level,
        name: b.name, x: cell.x, y: cell.y, w, h,
        seatOfPower: !!b.seatOfPower,
        countsAgainstKnown: b.countsAgainstKnown !== false,
      });
      return;
    }
    if (tool.kind === "facility" || tool.kind === "attachment") {
      const { w, h } = ghostDims(tool);
      if (tool.type === "Balcony")
        return placeBalcony({ id: uid(), type: "Balcony", name: "Balcony", x: cell.x, y: cell.y, w, h });
      placeFacility({ id: uid(), floorId: floor.id, type: tool.type, name: tool.type, x: cell.x, y: cell.y, w, h });
      return;
    }
    if (tool.kind === "furnish") {
      const def = furnishingByName(tool.type);
      const { w, h } = ghostDims(tool);
      const rect = { x: cell.x, y: cell.y, w, h };
      if (def.businessOnly && !plotHasKind(plot, "business"))
        return toast(`${def.name} is only permitted on a Business property.`);
      if (!inBounds(rect))
        return toast("That spot is outside the property boundary — buy more land tiles to expand it.");
      const fac = containingFacility(plot, floor.id, rect);
      if (!fac && !def.outdoor)
        return toast(`${def.name} must be placed inside a facility (or a Courtyard).`);
      const clash = (r) => furs.some((fu) => overlaps(r, fu)) || (!fac && facs.some((f) => overlaps(r, f)));
      if (clash(rect)) return toast("That spot is already occupied.");
      const item = {
        id: uid(), facilityId: fac ? fac.id : null, type: def.name, label: "",
        option: def.options ? def.options[0] : "", x: rect.x, y: rect.y, w: rect.w, h: rect.h,
      };
      update((p) => ({ ...p, furnishings: [...p.furnishings, item] }));
      onSelect({ kind: "furnishing", id: item.id });
      return;
    }
    // connection
    const item = { id: uid(), floorId: floor.id, type: tool.type, x: cell.x, y: cell.y };
    if (!inBounds({ ...item, w: 1, h: 1 }))
      return toast("That spot is outside the property boundary — buy more land tiles to expand it.");
    if (conns.some((c) => c.type === item.type && c.x === item.x && c.y === item.y))
      return toast("There is already a connection in that space.");
    update((p) => ({ ...p, connections: [...(p.connections || []), item] }));
    onSelect({ kind: "connection", id: item.id });
  };

  // Host grid-line segments a drawn door may sit along — kept fresh in a ref
  // so the live drawing gesture always validates against the latest plot.
  const hostsRef = useRef(null);
  hostsRef.current = doorHostSpans(plot, floor.id);

  // Commit the run of wall/fence drawn by dragging. Runs of the same kind on
  // the same line fuse into one piece (walls join automatically), and a
  // single shared corner cell is a legal junction — so L, T and + shapes can
  // be built segment by segment. Thin interior walls divide rooms: they may
  // cross or run along any wall; only a collinear overlap is redundant, and
  // that merges above.
  const commitWall = (run) => {
    const item = { id: uid(), floorId: floor.id, type: tool.type, x: run.x, y: run.y, w: run.w, h: run.h };
    // Interior walls are grid lines: a run along the boundary's edge line is
    // on the land even though its host row of cells sits just outside it.
    if (!inBounds(item) && !(item.type === "Interior Wall" && wallLineInBounds(item, boundary)))
      return toast("That run runs outside the property boundary — buy more land tiles to expand it.");
    const touch = (a, b) => a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
    const group = walls.filter((wl) =>
      wl.type === item.type && (item.h === 1) === (wl.h === 1) &&
      (item.h === 1 ? wl.y === item.y : wl.x === item.x) && touch(item, wl));
    if (group.length) {
      const lo = Math.min(item.x, ...group.map((g) => g.x));
      const hi = Math.max(item.x + item.w, ...group.map((g) => g.x + g.w));
      const loY = Math.min(item.y, ...group.map((g) => g.y));
      const hiY = Math.max(item.y + item.h, ...group.map((g) => g.y + g.h));
      const box = item.h === 1 ? { x: lo, y: item.y, w: hi - lo, h: 1 } : { x: item.x, y: loY, w: 1, h: hiY - loY };
      const ids = new Set(group.map((g) => g.id));
      update((p) => ({ ...p, walls: [...p.walls.filter((wl) => !ids.has(wl.id)), { ...item, ...box }] }));
      onSelect({ kind: "wall", id: item.id });
      return;
    }
    const shared = (a, b) =>
      Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const clash = tool.type === "Interior Wall"
      ? false // collinear runs merged above; crossings and wall edges are legal joins
      : facs.some((f) => overlaps(item, f)) || furs.some((fu) => overlaps(item, fu)) ||
        walls.some((wl) => wl.type !== "Interior Wall" && shared(item, wl) > 1);
    if (clash)
      return toast("A wall can't cut through a building, furnishing or another wall.");
    update((p) => ({ ...p, walls: [...(p.walls || []), item] }));
    onSelect({ kind: "wall", id: item.id });
  };

  // Commit a door drawn like an interior wall: a thin opening along a grid
  // line that must lie on a wall run (the line of an interior wall, either
  // edge of a thick wall or fence) or along a room's frame.
  // Doors and windows draw like interior walls: thin openings along a grid
  // line that must lie on a wall run (the line of an interior wall, either
  // edge of a thick wall or fence) or along a room's frame.
  const commitDoor = (run, type = "Doorway") => {
    // A normal door/window is one space; double doors and gates may span two.
    const item = {
      id: uid(),
      floorId: floor.id,
      type,
      ...clampOpeningRun(run, type),
    };
    const what = type === "Window" ? "window" : type === "Gate" ? "gate" : "door";
    if (!inBounds(item) && !wallLineInBounds(item, boundary))
      return toast(`That ${what} is outside the property boundary — buy more land tiles to expand it.`);
    if (!doorFits(hostsRef.current, item))
      return toast(`A ${what} can only be drawn along a wall or the frame of a room.`);
    if (conns.some((c) => OPENING_TYPES.has(c.type) && overlaps(item, c)))
      return toast("There is already a door, gate or window there.");
    update((p) => ({ ...p, connections: [...(p.connections || []), item] }));
    onSelect({ kind: "connection", id: item.id });
  };

  const startDragItem = (kind, item, e) => {
    if (tool) return;
    const c = toCell(e);
    const g = { type: "drag", kind, id: item.id, offX: c.x - item.x, offY: c.y - item.y, x: item.x, y: item.y, ox: item.x, oy: item.y };
    gestureRef.current = g;
    setDrag(g);
    setGesturing(true);
  };

  const startResize = (kind, item, edge, e) => {
    if (tool) return;
    const g = { type: "resize", kind, id: item.id, edge, x: item.x, y: item.y, w: item.w, h: item.h, ow: item.w, oh: item.h };
    gestureRef.current = g;
    setResize(g);
    setGesturing(true);
  };

  // Point the camera at the middle of the developable land.
  const centerCamera = () => {
    const z = zoomRef.current, s = sizeRef.current;
    setView({ x: (boundary.w * CELL) / 2 - s.w / (2 * z), y: (boundary.h * CELL) / 2 - s.h / (2 * z) });
  };

  // Zoom from the viewport-center so the land stays put under the buttons.
  const zoomBy = (f) => {
    const z = zoomRef.current, s = sizeRef.current, v = viewRef.current;
    const nz = Math.min(2.5, Math.max(0.4, z * f));
    const cx = v.x + s.w / (2 * z), cy = v.y + s.h / (2 * z);
    setView({ x: cx - s.w / (2 * nz), y: cy - s.h / (2 * nz) });
    setZoom(nz);
  };

  // Focus the camera on the developable spaces when the plot changes or the
  // canvas is (re)sized.
  useEffect(() => {
    centerCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plot?.id, size.w, size.h]);

  // Right-click menu for any placed item; kept inside the canvas edges.
  const openMenu = (e, entry) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = wrapRef.current.getBoundingClientRect();
    setMenu({
      x: Math.min(e.clientX - rect.left, rect.width - 240),
      y: Math.min(e.clientY - rect.top, rect.height - 200),
      ...entry,
    });
  };

  // Toggle a Cellar / Floor / Attic on or off; the menu stays open so rooms
  // can be placed into it right away.
  const attachTo = (facId, key) => {
    update((p) => ({
      ...p,
      facilities: p.facilities.map((x) => {
        if (x.id !== facId) return x;
        const at = x[key] || { on: false, items: [] };
        return { ...x, [key]: { ...at, on: !at.on } };
      }),
    }));
    onSelect({ kind: "facility", id: facId });
  };

  // Place a room (Bedroom, Kitchen, …) into a facility's attached storey:
  // stored relative to the facility, so it moves, resizes and rotates with it.
  const addAttachmentRoom = (facId, key, type) => {
    const def = furnishingByName(type);
    const f = facs.find((x) => x.id === facId);
    const at = f?.[key];
    if (!f || !at?.on || !def) return;
    const used = at.items.reduce((n, it) => n + it.w * it.h, 0);
    if (used + def.foot[0] * def.foot[1] > f.w * f.h)
      return toast(`The ${ATTACHMENTS[key].label.toLowerCase()} is full — enlarge the room or free up space first.`);
    const pos = firstFitRoom(f, at.items, def.foot[0], def.foot[1]);
    if (!pos)
      return toast(`No space left shaped for a ${def.foot[0]}×${def.foot[1]} ${type} in this ${ATTACHMENTS[key].label.toLowerCase()}.`);
    update((p) => ({
      ...p,
      facilities: p.facilities.map((x) =>
        x.id === facId
          ? { ...x, [key]: { ...x[key], items: [...x[key].items, { id: uid(), type, w: def.foot[0], h: def.foot[1], x: pos.x, y: pos.y }] } }
          : x
      ),
    }));
    onSelect({ kind: "facility", id: facId });
  };

  // Line a room's exterior frame with free interior-wall copies — the walls
  // that establish the room's boundaries. Runs fuse into existing walls.
  const wallTheRoom = (facId) => {
    const f = facs.find((x) => x.id === facId);
    if (!f) return;
    update((p) => {
      let walls = [...(p.walls || [])];
      const addRun = (run) => {
        // merge with collinear touching runs of the same kind
        const touch = (a, b) => a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
        const group = walls.filter((wl) =>
          wl.type === "Interior Wall" && !wl.free && (wl.h === 1) === (run.h === 1) &&
          (run.h === 1 ? wl.y === run.y : wl.x === run.x) && touch(run, wl));
        if (group.length) {
          const ids = new Set(group.map((g) => g.id));
          const lo = Math.min(run.x, ...group.map((g) => g.x));
          const loY = Math.min(run.y, ...group.map((g) => g.y));
          const hi = Math.max(run.x + run.w, ...group.map((g) => g.x + g.w));
          const hiY = Math.max(run.y + run.h, ...group.map((g) => g.y + g.h));
          walls = [
            ...walls.filter((wl) => !ids.has(wl.id)),
            run.h === 1 ? { id: uid(), floorId: run.floorId, type: "Interior Wall", free: true, x: lo, y: run.y, w: hi - lo, h: 1 }
              : { id: uid(), floorId: run.floorId, type: "Interior Wall", free: true, x: run.x, y: loY, w: 1, h: hiY - loY },
          ];
          return;
        }
        if (walls.some((wl) => wl.type === "Interior Wall" &&
          wl.x === run.x && wl.y === run.y && wl.w === run.w && wl.h === run.h)) return;
        walls.push({ id: uid(), floorId: run.floorId, type: "Interior Wall", free: true, ...run });
      };
      const fpx = { floorId: f.floorId, x: f.x, y: f.y, w: f.w, h: 1 };
      // Interior walls are lines on the grid, so the frame runs sit on the
      // room's outer edges — bottom and right one line past the last
      // row/column, never inside the room.
      addRun({ ...fpx }); // top frame
      addRun({ ...fpx, y: f.y + f.h }); // bottom frame
      addRun({ floorId: f.floorId, x: f.x, y: f.y, w: 1, h: f.h }); // left frame
      addRun({ floorId: f.floorId, x: f.x + f.w, y: f.y, w: 1, h: f.h }); // right frame
      return { ...p, walls };
    });
    onSelect({ kind: "facility", id: facId });
  };

  // Rotate a selected wall run 90° in place — the horizontal / vertical flip
  // that turns a wall segment into one running the other way.
  const rotateWall = (id) => {
    update((p) => ({
      ...p,
      walls: (p.walls || []).map((wl) =>
        wl.id === id
          ? wl.h === 1
            ? { ...wl, w: 1, h: wl.w }
            : { ...wl, w: wl.h, h: 1 }
          : wl
      ),
    }));
  };

  // Rotate a furnishing 90° in place, keeping it inside its room.
  const rotateFurnishing = (id) => {
    const fu = plot.furnishings.find((x) => x.id === id);
    if (!fu) return;
    const def = furnishingByName(fu.type) || {};
    const rect = { x: fu.x, y: fu.y, w: fu.h, h: fu.w };
    while (rect.w * rect.h < (def.min || 1)) rect.w++;
    const fac = containingFacility(plot, floor.id, rect);
    if (rect.x + rect.w > boundary.w || rect.y + rect.h > boundary.h) return;
    if (!fac && !def.outdoor) return;
    if (
      furs.some((o) => o.id !== fu.id && overlaps(rect, o)) ||
      (!fac && facs.some((f) => overlaps(rect, f)))
    ) return;
    update((p) => ({
      ...p,
      furnishings: p.furnishings.map((x) =>
        x.id === fu.id ? { ...x, w: rect.w, h: rect.h, facilityId: fac ? fac.id : null } : x
      ),
    }));
  };

  const onRotateItem = (t) => (t.kind === "wall" ? rotateWall(t.id) : rotateFurnishing(t.id));

  // A Tower carries its own two extra floors (three storeys in total) and its
  // staircases: one on its first floor, two adjacent on its second, and one on
  // its top floor — each within the tower's own footprint.
  const buildTowerStack = (item) => {
    const base = floor.index;
    update((p) => {
      const floors = [...p.floors];
      const ids = { [base]: floor.id };
      for (const idx of [base + 1, base + 2]) {
        const existing = floors.find((f) => f.index === idx);
        if (existing) { ids[idx] = existing.id; continue; }
        const above = floors.filter((f) => f.index >= 0 && f.index < idx).length;
        const nf = { id: uid(), name: `${ordinal(above + 1)} Floor`, index: idx };
        floors.push(nf);
        ids[idx] = nf.id;
      }
      // The tower itself continues upward: one 2×2 tower facility on each of
      // the two floors above (skipping any whose spot is occupied), tagged
      // stackOf so they move and rotate with the base tower.
      const facilities = [...p.facilities];
      const placed = [base];
      for (const idx of [base + 1, base + 2]) {
        const fid = ids[idx];
        if (!fid) continue;
        if (facilities.some((f) => f.floorId === fid && overlaps({ ...item, floorId: fid }, f))) continue;
        facilities.push({ ...item, id: uid(), floorId: fid, stackOf: item.id });
        placed.push(idx);
      }
      const stairs = [];
      const cells = [
        [base, item.x, item.y],
        [base + 1, item.x, item.y],
        [base + 1, item.x + 1, item.y],
        [base + 2, item.x, item.y + 1],
      ];
      for (const [idx, x, y] of cells) {
        if (!placed.includes(idx)) continue;
        const fid = ids[idx];
        if ((p.connections || []).some((c) => c.floorId === fid && c.x === x && c.y === y)) continue;
        stairs.push({ id: uid(), floorId: fid, type: "Staircase", x, y });
      }
      return { ...p, floors, facilities, connections: [...(p.connections || []), ...stairs] };
    });
    toast("Tower placed — its two upper storeys and staircases came with it.");
  };

  const onPointerDown = (e) => {
    setMenu(null);
    if (e.button === 2) return; // right-click: handled by the context menu
    if (e.button === 1) {
      // Middle button only ever pans — it never places.
      e.preventDefault();
      gestureRef.current = { type: "pan", sx: e.clientX, sy: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y, zoom: zoomRef.current };
      setGesturing(true);
      return;
    }
    if (tool) {
      if (tool.kind === "wall" || (tool.kind === "connection" && isOpening(tool.type))) {
        // Wall / fence / door / window tools draw a run by dragging across the grid.
        const c = toCell(e);
        gestureRef.current = { type: "wall", tool, ax: c.x, ay: c.y, sx: e.clientX, sy: e.clientY, moved: false };
        setGesturing(true);
        return;
      }
      if (tool.kind === "attachment" && FACILITY_TYPES[tool.type].resizable) {
        // Courtyard / Porch / Balcony: drag to size the box, or plain-click
        // for the default footprint.
        const c = toCell(e);
        gestureRef.current = { type: "placedrag", ax: c.x, ay: c.y, sx: e.clientX, sy: e.clientY, moved: false };
        setGesturing(true);
        return;
      }
      placeAt(toCell(e));
      return;
    }
    if (e.target === svgRef.current || e.target?.dataset?.bg === "1") {
      // Left-drag on empty ground draws a rubber-band selection box.
      const c = toCell(e);
      gestureRef.current = { type: "marquee", ax: c.x, ay: c.y, sx: e.clientX, sy: e.clientY, moved: false };
      setGesturing(true);
    }
  };

  // Pan / drag / resize gestures run on window listeners, so a fast pointer
  // leaving the canvas (or a capture hiccup in the preview) can never drop
  // the gesture mid-move.
  useEffect(() => {
    if (!gesturing) return;
    const cellOf = (e) => {
      const rect = svgRef.current.getBoundingClientRect();
      const v = viewRef.current, z = zoomRef.current, s = sizeRef.current;
      const wx = v.x + ((e.clientX - rect.left) / rect.width) * (s.w / z);
      const wy = v.y + ((e.clientY - rect.top) / rect.height) * (s.h / z);
      return { x: Math.floor(wx / CELL), y: Math.floor(wy / CELL) };
    };
    const onMove = (e) => {
      const g = gestureRef.current;
      if (!g) return;
      if (g.type === "pan") {
        setView({ x: g.vx - (e.clientX - g.sx) / g.zoom, y: g.vy - (e.clientY - g.sy) / g.zoom });
      } else if (g.type === "drag") {
        const c = cellOf(e);
        const next = { ...g, x: c.x - g.offX, y: c.y - g.offY };
        gestureRef.current = next;
        setDrag(next);
      } else if (g.type === "placedrag") {
        g.moved = g.moved || Math.abs(e.clientX - g.sx) + Math.abs(e.clientY - g.sy) > 4;
        const c = cellOf(e);
        g.cx = c.x; g.cy = c.y;
        setPlaceDrag({ x0: g.ax, y0: g.ay, x1: c.x, y1: c.y });
      } else if (g.type === "marquee") {
        g.moved = g.moved || Math.abs(e.clientX - g.sx) + Math.abs(e.clientY - g.sy) > 4;
        const c = cellOf(e);
        g.cx = c.x; g.cy = c.y;
        setMarquee({ x0: g.ax, y0: g.ay, x1: c.x, y1: c.y });
      } else if (g.type === "wall") {
        g.moved = g.moved || Math.abs(e.clientX - g.sx) + Math.abs(e.clientY - g.sy) > 4;
        const c = cellOf(e);
        g.cx = c.x; g.cy = c.y;
        const dx = Math.abs(c.x - g.ax), dy = Math.abs(c.y - g.ay);
        // Snap the run to the dominant axis while drawing; doors also preview
        // whether their line lies along a wall or room frame.
        const run = dx >= dy
          ? { x: Math.min(g.ax, c.x), y: g.ay, w: dx + 1, h: 1 }
          : { x: g.ax, y: Math.min(g.ay, c.y), w: 1, h: dy + 1 };
        const preview = g.tool.kind === "connection" && isOpening(g.tool.type)
          ? clampOpeningRun(run, g.tool.type)
          : run;
        setWallGhost(g.tool.kind === "connection" ? { ...preview, ok: doorFits(hostsRef.current, preview) } : preview);
      } else {
        const c = cellOf(e);
        const w = g.edge.includes("e") ? Math.max(1, c.x - g.x + 1) : g.w;
        const h = g.edge.includes("s") ? Math.max(1, c.y - g.y + 1) : g.h;
        const next = { ...g, w, h };
        gestureRef.current = next;
        setResize(next);
      }
    };
    const onUp = () => {
      const g = gestureRef.current;
      gestureRef.current = null;
      setGesturing(false);
      setMarquee(null);
      setWallGhost(null);
      if (g?.type === "drag") {
        if (g.x !== g.ox || g.y !== g.oy) commitMove({ kind: g.kind, id: g.id, x: g.x, y: g.y });
        setDrag(null);
      } else if (g?.type === "resize") {
        if (g.w !== g.ow || g.h !== g.oh) commitResize({ kind: g.kind, id: g.id, x: g.x, y: g.y, w: g.w, h: g.h });
        setResize(null);
      } else if (g?.type === "placedrag") {
        const def = FACILITY_TYPES[tool.type];
        commitPlaceBox(g.moved && g.cx !== undefined
          ? { x: Math.min(g.ax, g.cx), y: Math.min(g.ay, g.cy), w: Math.abs(g.cx - g.ax) + 1, h: Math.abs(g.cy - g.ay) + 1 }
          : { x: g.ax, y: g.ay, w: def.w, h: def.h });
        setPlaceDrag(null);
      } else if (g?.type === "marquee") {
        if (!g.moved) {
          onSelect(null); // a plain click on empty ground clears the selection
        } else {
          const box = { x: Math.min(g.ax, g.cx), y: Math.min(g.ay, g.cy), w: Math.abs(g.cx - g.ax) + 1, h: Math.abs(g.cy - g.ay) + 1 };
          const items = [];
          for (const f of facs) if (overlaps(box, f)) items.push({ kind: "facility", id: f.id });
          for (const fu of furs) if (overlaps(box, fu)) items.push({ kind: "furnishing", id: fu.id });
          for (const c of conns)
            if (c.x >= box.x && c.x < box.x + box.w && c.y >= box.y && c.y < box.y + box.h)
              items.push({ kind: "connection", id: c.id });
          for (const wl of walls) if (overlaps(box, wl)) items.push({ kind: "wall", id: wl.id });
          onSelect(items.length ? { kind: "multi", items } : null);
        }
      } else if (g?.type === "wall") {
        const dx = Math.abs((g.cx ?? g.ax) - g.ax), dy = Math.abs((g.cy ?? g.ay) - g.ay);
        const run = dx >= dy
          ? { x: Math.min(g.ax, g.cx ?? g.ax), y: g.ay, w: dx + 1, h: 1 }
          : { x: g.ax, y: Math.min(g.ay, g.cy ?? g.ay), w: 1, h: dy + 1 };
        if (g.tool.kind === "wall") commitWall(run); else commitDoor(run, g.tool.type);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gesturing]);

  const onPointerMove = (e) => {
    if (tool) setHover(toCell(e));
  };

  // Hover benefits window: the rules text of the item under the pointer, kept
  // near the cursor and clamped inside the canvas.
  const showInfo = (e, lines) => {
    if (tool || !lines?.length) return setInfo(null);
    const rect = wrapRef.current.getBoundingClientRect();
    setInfo({ x: e.clientX - rect.left, y: e.clientY - rect.top, lines });
  };

  const commitMove = (d) => {
    update((p) => {
      if (d.kind === "facility") {
        const f = p.facilities.find((x) => x.id === d.id);
        if (!f) return p;
        // A Tower and its upper storeys form one stack: they move together,
        // whichever member is dragged.
        const rootId = f.stackOf || f.id;
        const stack = p.facilities.filter((x) => x.id === rootId || x.stackOf === rootId);
        const stackIds = new Set(stack.map((x) => x.id));
        const dx = d.x - f.x, dy = d.y - f.y;
        const moved = stack.map((x) => ({ ...x, x: x.x + dx, y: x.y + dy }));
        if (moved.some((m) => !inBounds(m))) return p; // outside the owned land
        if (p.facilities.some((o) => !stackIds.has(o.id) && moved.some((m) => overlaps(m, o)))) return p; // blocked
        return {
          ...p,
          facilities: p.facilities.map((x) => moved.find((m) => m.id === x.id) || x),
          // Furnishings riding inside a stack member move with it.
          furnishings: p.furnishings.map((fu) => {
            const owner = stack.find((x) => x.id === fu.facilityId);
            return owner && fu.x >= owner.x && fu.y >= owner.y && fu.x + fu.w <= owner.x + owner.w && fu.y + fu.h <= owner.y + owner.h
              ? { ...fu, x: fu.x + dx, y: fu.y + dy }
              : fu;
          }),
        };
      }
      if (d.kind === "furnishing") {
        const fu = p.furnishings.find((x) => x.id === d.id);
        if (!fu) return p;
        const def = furnishingByName(fu.type);
        const rect = { x: d.x, y: d.y, w: fu.w, h: fu.h };
        if (!inBounds(rect)) return p;
        const fac = containingFacility(p, floor.id, rect);
        if (!fac && !def.outdoor) return p; // must stay inside a facility
        if (p.furnishings.some((o) => o.id !== fu.id && overlaps(rect, o))) return p;
        if (!fac && p.facilities.some((f) => f.floorId === floor.id && overlaps(rect, f))) return p;
        return { ...p, furnishings: p.furnishings.map((x) => (x.id === fu.id ? { ...fu, x: d.x, y: d.y, facilityId: fac ? fac.id : null } : x)) };
      }
      const c = (p.connections || []).find((x) => x.id === d.id);
      if (!c) return p;
      if (!inBounds({ x: d.x, y: d.y, w: 1, h: 1 })) return p;
      if ((p.connections || []).some((o) => o.id !== c.id && o.floorId === floor.id && o.x === d.x && o.y === d.y)) return p;
      return { ...p, connections: (p.connections || []).map((x) => (x.id === c.id ? { ...c, x: d.x, y: d.y } : x)) };
    });
  };

  const commitResize = (d) => {
    update((p) => {
      if (d.kind === "facility") {
        const f = p.facilities.find((x) => x.id === d.id);
        if (!f) return p;
        const def = FACILITY_TYPES[f.type];
        let w = Math.max(1, d.w), h = Math.max(1, d.h);
        if (def.minSpaces) while (w * h < def.minSpaces) w++;
        const moved = { ...f, w, h };
        if (!inBounds(moved)) return p;
        if (p.facilities.some((o) => o.id !== f.id && overlaps(moved, o))) return p;
        return { ...p, facilities: p.facilities.map((x) => (x.id === f.id ? moved : x)) };
      }
      const fu = p.furnishings.find((x) => x.id === d.id);
      if (!fu) return p;
      const def = furnishingByName(fu.type) || {};
      let w = Math.max(1, d.w), h = Math.max(1, d.h);
      const min = def.min || 1;
      while (w * h < min) w++;
      const rect = { x: fu.x, y: fu.y, w, h };
      const fac = containingFacility(p, floor.id, rect);
      if (!fac && !def.outdoor) return p;
      if (p.furnishings.some((o) => o.id !== fu.id && overlaps(rect, o))) return p;
      if (!fac && (p.facilities || []).some((f) => f.floorId === floor.id && overlaps(rect, f))) return p;
      return { ...p, furnishings: p.furnishings.map((x) => (x.id === fu.id ? { ...fu, w, h } : x)) };
    });
  };

  const sel = selection || null;
  const isSel = (kind, id) => {
    if (!sel) return false;
    if (sel.kind === "multi") return sel.items.some((i) => i.kind === kind && i.id === id);
    return sel.kind === kind && sel.id === id;
  };

  // Edge handles for the selected item: right edge, bottom edge and corner.
  const selectedResizeHandles = (() => {
    if (tool || !sel) return null;
    const r =
      sel.kind === "facility"
        ? facs.find((f) => f.id === sel.id)
        : sel.kind === "furnishing"
          ? furs.find((f) => f.id === sel.id)
          : null;
    if (!r) return null;
    const kind = sel.kind;
    const def = kind === "facility" ? FACILITY_TYPES[r.type] : furnishingByName(r.type) || {};
    if (kind === "facility" && !def.resizable) return null;
    const lv = live(kind, r.id) || r;
    const X = lv.x * CELL, Y = lv.y * CELL, W = lv.w * CELL, H = lv.h * CELL;
    const hs = 9 / zoom;
    const handle = (edge, cx, cy, cursor) => (
      <rect
        key={edge}
        x={cx - hs / 2} y={cy - hs / 2} width={hs} height={hs} rx={hs / 5}
        className={`fill-primary stroke-background ${cursor}`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          startResize(kind, r, edge, e);
        }}
      />
    );
    return [
      handle("e", X + W, Y + H / 2, "cursor-ew-resize"),
      handle("s", X + W / 2, Y + H, "cursor-ns-resize"),
      handle("se", X + W, Y + H, "cursor-nwse-resize"),
    ];
  })();

  return (
    <div
      className="relative h-full min-h-0 flex-1 overflow-hidden rounded-xl border bg-background"
      ref={wrapRef}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg
        ref={svgRef}
        className="h-full w-full touch-none select-none"
        viewBox={`${view.x} ${view.y} ${viewW} ${viewH}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <pattern id="hb-grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" className="stroke-border/60" strokeWidth="1" />
          </pattern>
        </defs>
        <rect data-bg="1" x="-100000" y="-100000" width="200000" height="200000" fill="transparent" />
        <rect data-bg="1" x="-5000" y="-5000" width="10000" height="10000" fill="url(#hb-grid)" />

        {/* Owned land boundary — expandable with 25 gp tiles. */}
        <rect
          x={0} y={0} width={boundary.w * CELL} height={boundary.h * CELL}
          className="fill-primary/5 stroke-primary/60" strokeWidth={2 / zoom}
          strokeDasharray={`${10 / zoom} ${6 / zoom}`} pointerEvents="none"
        />
        <text x={CELL * 0.15} y={-6 / zoom} className="fill-primary/80" fontSize={12 / zoom} pointerEvents="none">
          Property boundary — {boundary.w}×{boundary.h} spaces
        </text>

        {toolRect && (
          <rect
            x={toolRect.x * CELL} y={toolRect.y * CELL} width={toolRect.w * CELL} height={toolRect.h * CELL}
            className="fill-primary/10 stroke-primary/70" strokeWidth="2" strokeDasharray="6 4" pointerEvents="none"
          />
        )}

        {marquee && (
          <rect
            x={Math.min(marquee.x0, marquee.x1) * CELL} y={Math.min(marquee.y0, marquee.y1) * CELL}
            width={(Math.abs(marquee.x1 - marquee.x0) + 1) * CELL} height={(Math.abs(marquee.y1 - marquee.y0) + 1) * CELL}
            className="fill-primary/10 stroke-primary" strokeWidth={1.5 / zoom} strokeDasharray={`${5 / zoom} ${3 / zoom}`}
            pointerEvents="none"
          />
        )}

        {wallGhost && (tool?.kind === "wall" && tool.type === "Interior Wall" ? (
          // Interior walls are lines on the grid: preview the line itself, not
          // the row of squares, so the wall lands exactly where it renders.
          wallGhost.h === 1 ? (
            <line
              x1={wallGhost.x * CELL} y1={wallGhost.y * CELL}
              x2={(wallGhost.x + wallGhost.w) * CELL} y2={wallGhost.y * CELL}
              className="stroke-stone-500/70" strokeWidth={2.5 / zoom} strokeLinecap="round"
              strokeDasharray={`${5 / zoom} ${3 / zoom}`} pointerEvents="none"
            />
          ) : (
            <line
              x1={wallGhost.x * CELL} y1={wallGhost.y * CELL}
              x2={wallGhost.x * CELL} y2={(wallGhost.y + wallGhost.h) * CELL}
              className="stroke-stone-500/70" strokeWidth={2.5 / zoom} strokeLinecap="round"
              strokeDasharray={`${5 / zoom} ${3 / zoom}`} pointerEvents="none"
            />
          )
        ) : (
          <rect
            x={wallGhost.x * CELL} y={wallGhost.y * CELL} width={wallGhost.w * CELL} height={wallGhost.h * CELL}
            className={wallGhost.ok === false ? "fill-red-500/20 stroke-red-600" : "fill-stone-500/20 stroke-stone-600"}
            strokeWidth={1.5 / zoom}
            strokeDasharray={`${5 / zoom} ${3 / zoom}`} pointerEvents="none"
          />
        ))}

        {/* Storeys below the viewed floor, ghosted underneath and not
            selectable — the deeper the floor, the fainter it shows. */}
        {plot.floors
          .filter((f) => f.index < floor.index)
          .sort((a, b) => b.index - a.index)
          .map((lf) => (
            <g
              key={lf.id}
              pointerEvents="none"
              style={{ opacity: Math.max(0.08, 0.32 - (floor.index - lf.index - 1) * 0.12) }}
            >
              {(plot.facilities || []).filter((f) => f.floorId === lf.id).map((f) => (
                <rect key={f.id} x={f.x * CELL} y={f.y * CELL} width={f.w * CELL} height={f.h * CELL} rx="3"
                  className="fill-muted-foreground/20 stroke-border" strokeWidth="1.5" strokeDasharray="4 4" />
              ))}
              {(plot.walls || []).filter((wl) => wl.floorId === lf.id && wl.type !== "Interior Wall").map((wl) => (
                <rect key={wl.id} x={wl.x * CELL + 2} y={wl.y * CELL + 2} width={wl.w * CELL - 4} height={wl.h * CELL - 4} rx="2"
                  className="fill-stone-500/30" />
              ))}
            </g>
          ))}

        {/* Facilities first: the bottommost layer of every building. */}
        {facs.map((raw) => {
          const f = facRect(raw);
          const selCls = isSel("facility", f.id) ? " stroke-primary" : "";
          return (
            <g
              key={f.id}
              onPointerDown={(e) => {
                if (e.button === 1) return; // middle pans — never places
                if (e.button === 2) {
                  e.stopPropagation();
                  openMenu(e, { kind: "facility", id: f.id, type: f.type, title: f.name || f.type });
                  return;
                }
                if (tool) {
                  // With a placement tool active a click places (the canvas
                  // handler then rejects overlaps); Alt-click peeks past the
                  // tool to select the room underneath instead.
                  if (e.altKey) {
                    e.stopPropagation();
                    onSelect({ kind: "facility", id: f.id });
                  }
                  return;
                }
                e.stopPropagation();
                onSelect({ kind: "facility", id: f.id });
                startDragItem("facility", raw, e);
              }}
            >
              <rect
                x={f.x * CELL} y={f.y * CELL} width={f.w * CELL} height={f.h * CELL}
                className={`${FAC_FILL[f.type] || "fill-muted/40 stroke-border"}${selCls}`}
                strokeWidth={isSel("facility", f.id) ? 2.5 : 1.5}
                strokeDasharray={f.type === "Courtyard" ? "8 5" : undefined}
                rx="3"
                onPointerMove={(e) => showInfo(e, facilityInfoLines(f))}
                onPointerLeave={() => setInfo(null)}
              />
              {raw.floorImage ? (
                <image
                  href={raw.floorImage}
                  x={f.x * CELL + 2}
                  y={f.y * CELL + 2}
                  width={Math.max(1, f.w * CELL - 4)}
                  height={Math.max(1, f.h * CELL - 4)}
                  preserveAspectRatio="xMidYMid slice"
                  opacity="0.62"
                  pointerEvents="none"
                />
              ) : (
                <rect
                  x={f.x * CELL + 2}
                  y={f.y * CELL + 2}
                  width={Math.max(1, f.w * CELL - 4)}
                  height={Math.max(1, f.h * CELL - 4)}
                  fill={floorTexture(raw.floorTexture).color}
                  fillOpacity="0.28"
                  rx="2"
                  pointerEvents="none"
                />
              )}
              {f.w * CELL > 60 && f.h * CELL > 22 && (
                <text x={f.x * CELL + 5} y={f.y * CELL + 14} className="fill-current text-[11px] font-semibold text-foreground/50" pointerEvents="none">
                  {f.name || f.type}
                </text>
              )}
            </g>
          );
        })}

        {/* Rooms placed inside a facility's Cellar / Floor / Attic attachments:
            drawn inside the room's footprint with a per-storey tint, and they
            follow the room wherever it is dragged. */}
        {facs.flatMap((raw) => {
          const f = facRect(raw);
          return ["attic", "floor", "cellar"].flatMap((key) => {
            const at = raw[key];
            if (!at?.on || !at.items?.length) return [];
            return at.items.map((it) => (
              <g key={`${key}-${it.id}`}>
                <rect
                  x={(f.x + it.x) * CELL + 3} y={(f.y + it.y) * CELL + 3}
                  width={it.w * CELL - 6} height={it.h * CELL - 6} rx="2"
                  className={SLOT_STYLE[key] || "fill-muted stroke-border"}
                  strokeWidth="1.5" strokeDasharray="5 3" pointerEvents="none"
                />
                {it.w * CELL > 52 && it.h * CELL > 16 && (
                  <text x={(f.x + it.x) * CELL + 5} y={(f.y + it.y) * CELL + 13} className="fill-current text-[9px] text-foreground/80" pointerEvents="none">
                    {it.type} · {ATTACHMENTS[key].label}
                  </text>
                )}
              </g>
            ));
          });
        })}

        {/* Walls and fences: solid / dashed bars, one space thick; interior
            walls render as a thin line along the grid line of their run. */}
        {walls.map((wl) => {
          const selCls = isSel("wall", wl.id);
          if (wl.type === "Interior Wall") {
            const horiz = wl.h === 1;
            const line = horiz
              ? { x1: wl.x * CELL, y1: wl.y * CELL, x2: (wl.x + wl.w) * CELL, y2: wl.y * CELL }
              : { x1: wl.x * CELL, y1: wl.y * CELL, x2: wl.x * CELL, y2: (wl.y + wl.h) * CELL };
            return (
              <g key={wl.id} onPointerDown={(e) => {
                if (e.button === 2) {
                  openMenu(e, { kind: "wall", id: wl.id, type: wl.type, title: wl.type });
                  return;
                }
                if (e.button !== 0 || tool) return;
                e.stopPropagation();
                onSelect({ kind: "wall", id: wl.id });
              }}>
                <line {...line} className="stroke-transparent" strokeWidth={10} />
                <line {...line} className={selCls ? "stroke-primary" : "stroke-stone-500/80"}
                  strokeWidth={selCls ? 3.5 : 2.5} strokeLinecap="round" />
              </g>
            );
          }
          const bar = wl.h === 1
            ? { x: wl.x * CELL + 2, y: wl.y * CELL + CELL / 2 - 4, width: wl.w * CELL - 4, height: 8 }
            : { x: wl.x * CELL + CELL / 2 - 4, y: wl.y * CELL + 2, width: 8, height: wl.h * CELL - 4 };
          return (
            <g key={wl.id} onPointerDown={(e) => {
              if (e.button === 2) {
                openMenu(e, { kind: "wall", id: wl.id, type: wl.type, title: wl.type });
                return;
              }
              if (e.button !== 0 || tool) return;
              e.stopPropagation();
              onSelect({ kind: "wall", id: wl.id });
            }}>
              <rect
                x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx="2"
                className={`${wl.type === "Fence" ? "fill-emerald-500/50 stroke-emerald-600" : "fill-stone-500/80 stroke-stone-600"}${selCls ? " stroke-primary" : ""}`}
                strokeWidth={selCls ? 2 : 1}
                strokeDasharray={wl.type === "Fence" ? "6 3" : undefined}
              />
            </g>
          );
        })}

        {conns.map((c) => {
          // Drawn doors (longer than one space) render as an opening in their
          // host line — a background-colored gap, a leaf and a swing arc.
          if (isOpening(c.type) && (c.w > 1 || c.h > 1)) {
            const horiz = c.h === 1;
            const selCls = isSel("connection", c.id);
            const X0 = c.x * CELL, Y0 = c.y * CELL;
            const len = (horiz ? c.w : c.h) * CELL;
            const r = Math.min(len, CELL * 0.85);
            const leaf = selCls ? "stroke-primary" : "stroke-amber-500";
            const arc = selCls ? "stroke-primary/70" : "stroke-amber-500/60";
            // Windows render as a glass line with a center mullion — the same
            // drawn-along-a-wall behavior as doors, minus the swing.
            if (c.type === "Window") {
              const glass = selCls ? "stroke-primary" : "stroke-sky-400";
              const line = horiz
                ? { x1: X0, y1: Y0, x2: X0 + len, y2: Y0 }
                : { x1: X0, y1: Y0, x2: X0, y2: Y0 + len };
              return (
                <g key={c.id} onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  if (tool) {
                    if (e.altKey) { e.stopPropagation(); onSelect({ kind: "connection", id: c.id }); }
                    return; // let the placement tool through
                  }
                  e.stopPropagation(); onSelect({ kind: "connection", id: c.id }); startDragItem("connection", raw0(c), e);
                }}>
                  <rect
                    x={horiz ? X0 : X0 - 7} y={horiz ? Y0 - 7 : Y0}
                    width={horiz ? len : 14} height={horiz ? 14 : len}
                    className="fill-transparent"
                  />
                  <line {...line} className="stroke-background" strokeWidth={8} />
                  <line {...line} className={glass} strokeWidth={6} strokeLinecap="round" opacity={0.8} />
                  <line
                    {...(horiz
                      ? { x1: X0 + len / 2, y1: Y0 - 4, x2: X0 + len / 2, y2: Y0 + 4 }
                      : { x1: X0 - 4, y1: Y0 + len / 2, x2: X0 + 4, y2: Y0 + len / 2 })}
                    className="stroke-sky-700" strokeWidth={2}
                  />
                </g>
              );
            }
            return (
              <g key={c.id} onPointerDown={(e) => {
                if (e.button !== 0) return;
                if (tool) {
                  if (e.altKey) { e.stopPropagation(); onSelect({ kind: "connection", id: c.id }); }
                  return; // let the placement tool through
                }
                e.stopPropagation(); onSelect({ kind: "connection", id: c.id }); startDragItem("connection", raw0(c), e);
              }}>
                <rect
                  x={horiz ? X0 : X0 - 7} y={horiz ? Y0 - 7 : Y0}
                  width={horiz ? len : 14} height={horiz ? 14 : len}
                  className="fill-transparent"
                />
                {horiz
                  ? <line x1={X0} y1={Y0} x2={X0 + len} y2={Y0} className="stroke-background" strokeWidth={8} />
                  : <line x1={X0} y1={Y0} x2={X0} y2={Y0 + len} className="stroke-background" strokeWidth={8} />}
                {horiz ? (
                  <>
                    <line x1={X0} y1={Y0} x2={X0} y2={Y0 + r} className={leaf} strokeWidth={selCls ? 3 : 2.5} strokeLinecap="round" />
                    <path d={`M ${X0} ${Y0 + r} A ${r} ${r} 0 0 0 ${X0 + r} ${Y0}`} fill="none" className={arc} strokeWidth={1.2} strokeDasharray="3 3" />
                    <line x1={X0 + len} y1={Y0} x2={X0 + len} y2={Y0 + r} className={leaf} strokeWidth={selCls ? 3 : 2.5} strokeLinecap="round" />
                    <path d={`M ${X0 + len} ${Y0 + r} A ${r} ${r} 0 0 1 ${X0 + len - r} ${Y0}`} fill="none" className={arc} strokeWidth={1.2} strokeDasharray="3 3" />
                  </>
                ) : (
                  <>
                    <line x1={X0} y1={Y0} x2={X0 + r} y2={Y0} className={leaf} strokeWidth={selCls ? 3 : 2.5} strokeLinecap="round" />
                    <path d={`M ${X0 + r} ${Y0} A ${r} ${r} 0 0 1 ${X0} ${Y0 + r}`} fill="none" className={arc} strokeWidth={1.2} strokeDasharray="3 3" />
                    <line x1={X0} y1={Y0 + len} x2={X0 + r} y2={Y0 + len} className={leaf} strokeWidth={selCls ? 3 : 2.5} strokeLinecap="round" />
                    <path d={`M ${X0 + r} ${Y0 + len} A ${r} ${r} 0 0 0 ${X0} ${Y0 + len - r}`} fill="none" className={arc} strokeWidth={1.2} strokeDasharray="3 3" />
                  </>
                )}
              </g>
            );
          }
          const selCls = isSel("connection", c.id) ? " stroke-primary" : " stroke-muted-foreground/50";
          return (
            <g key={c.id} onPointerDown={(e) => {
              if (e.button === 2) {
                openMenu(e, { kind: "connection", id: c.id, type: c.type, title: c.type });
                return;
              }
              if (e.button !== 0) return;
              if (tool) {
                if (e.altKey) { e.stopPropagation(); onSelect({ kind: "connection", id: c.id }); }
                return; // let the placement tool through
              }
              e.stopPropagation(); onSelect({ kind: "connection", id: c.id }); startDragItem("connection", raw0(c), e);
            }}>
              <rect x={c.x * CELL + 3} y={c.y * CELL + 3} width={CELL - 6} height={CELL - 6} rx="3"
                className={c.type === "Doorway" ? "fill-amber-400/50 stroke-amber-600" : c.type === "Double Door" ? "fill-amber-500/60 stroke-amber-700" : c.type === "Gate" ? "fill-stone-400/60 stroke-stone-600" : c.type === "Window" ? "fill-sky-400/50 stroke-sky-600" : "fill-muted stroke-border"}
                strokeWidth={isSel("connection", c.id) ? 2 : 1.5} />
            </g>
          );
        })}

        {furs.map((raw) => {
          const fu = furRect(raw);
          const def = furnishingByName(fu.type) || {};
          const selCls = isSel("furnishing", fu.id) ? " stroke-primary" : "";
          return (
            <g key={fu.id} onPointerDown={(e) => {
              if (e.button === 2) {
                openMenu(e, { kind: "furnishing", id: fu.id, type: fu.type, title: fu.label || fu.type });
                return;
              }
              if (e.button !== 0) return;
              if (tool) {
                if (e.altKey) { e.stopPropagation(); onSelect({ kind: "furnishing", id: fu.id }); }
                return; // let the placement tool through
              }
              e.stopPropagation(); onSelect({ kind: "furnishing", id: fu.id }); startDragItem("furnishing", raw, e);
            }}>
              <rect
                x={fu.x * CELL + 2} y={fu.y * CELL + 2} width={fu.w * CELL - 4} height={fu.h * CELL - 4}
                className={`${CAT_FILL[def.cat] || "fill-muted stroke-border"}${selCls}`}
                strokeWidth={isSel("furnishing", fu.id) ? 2 : 1}
                rx="2"
                onPointerMove={(e) => showInfo(e, furnishingInfoLines(fu, def))}
                onPointerLeave={() => setInfo(null)}
              />
              {fu.w * CELL > 70 && fu.h * CELL > 20 && (
                <text x={fu.x * CELL + 5} y={fu.y * CELL + 13} className="fill-current text-[9px] text-foreground/75" pointerEvents="none">
                  {(fu.label || fu.type).slice(0, Math.floor((fu.w * CELL - 10) / 6.2))}
                </text>
              )}
            </g>
          );
        })}

        {selectedResizeHandles}
      </svg>

      {menu && (
      <HomesteadContextMenu
        menu={menu}
        fac={menu.kind === "facility" ? facs.find((f) => f.id === menu.id) : null}
        onAttach={attachTo}
        onAddRoom={addAttachmentRoom}
        onWallRoom={wallTheRoom}
        onRotate={onRotateItem}
        onDelete={(t) => deleteByKind(update, plot, t.kind, t.id)}
        onSelect={onSelect}
        onClose={() => setMenu(null)}
      />
      )}

      {info && (
        <div
          className="pointer-events-none absolute z-40 max-w-xs rounded-md border bg-popover px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(info.x + 14, (wrapRef.current?.clientWidth || 800) - 320),
            top: Math.min(info.y + 14, (wrapRef.current?.clientHeight || 600) - 140),
          }}
        >
          {info.lines.map((line, i) => (
            <p key={i} className="text-popover-foreground/90 first:font-medium">{line}</p>
          ))}
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <Button size="icon" variant="secondary" className="h-8 w-8" title="Center on property" onClick={centerCamera}><Crosshair className="h-4 w-4" /></Button>
        <Button size="icon" variant="secondary" className="h-8 w-8" title="Zoom in" onClick={() => zoomBy(1.25)}><Plus className="h-4 w-4" /></Button>
        <Button size="icon" variant="secondary" className="h-8 w-8" title="Zoom out" onClick={() => zoomBy(1 / 1.25)}><Minus className="h-4 w-4" /></Button>
      </div>
      {tool && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border bg-background/90 px-2.5 py-1 text-xs shadow">
          {tool.kind === "wall"
            ? <>Drag across the grid to draw <span className="font-semibold">{tool.type.toLowerCase()}</span> — runs fuse and join at corners automatically. Esc or the Select tool to stop.</>
            : tool.kind === "connection" && isOpening(tool.type)
              ? <>Drag along a wall or a room's frame to draw <span className="font-semibold">{tool.type}</span> — Esc or the Select tool to stop.</>
              : <>Left-click a space to place <span className="font-semibold">{tool.type}</span> — Esc or the Select tool to stop.</>}
        </div>
      )}
      {!tool && (
        <div className="pointer-events-none absolute left-3 top-3 max-w-md rounded-md border bg-background/90 px-2.5 py-1 text-xs shadow text-muted-foreground">
          1 space = one square. Middle-drag to pan, drag on empty ground to box-select,
          scroll to zoom, drag an item's edge to resize, press R to rotate the selection,
          right-click a room to attach a Cellar, Floor or Attic and place rooms inside it.
        </div>
      )}
    </div>
  );
}

// Connections are 1×1; wrap as a tiny rect for the drag starter.
const raw0 = (c) => ({ ...c, w: 1, h: 1 });

// Hover-window lines for a placed facility and a placed furnishing: the
// benefits (and requirements) each grants, from the homebrew data.
function facilityInfoLines(f) {
  if (f.bastion) {
    const o = BASTION_ORDERS[f.bastion];
    return o
      ? [
          f.seatOfPower
            ? "Seat of Power - 4x4 Bastion facility (free, does not count against known facilities)"
            : `Level ${f.level} special facility - ${o.order} order`,
          `Hirelings: ${f.hirelings ?? "?"}`,
          o.effect,
        ]
      : [f.seatOfPower ? "Seat of Power - 4x4 Bastion facility" : `Level ${f.level} special facility`];
  }
  const def = FACILITY_TYPES[f.type];
  return def ? [def.desc] : [f.type];
}
function furnishingInfoLines(fu, def) {
  const lines = [];
  if (def?.req && def.req !== "None") lines.push(`Requirements: ${def.req}`);
  if (def?.benefits) lines.push(def.benefits);
  if (fu.option) lines.push(`Chosen: ${fu.option}`);
  return lines;
}

// Delete any placed item by kind (used by the context menu).
function deleteByKind(update, plot, kind, id) {
  if (kind === "facility") {
    const f = plot.facilities.find((x) => x.id === id);
    const rootId = f?.stackOf || id;
    return update((p) => {
      const stack = p.facilities.filter((x) => x.id === rootId || x.stackOf === rootId);
      const stackIds = new Set(stack.map((x) => x.id));
      return {
        ...p,
        facilities: p.facilities.filter((x) => !stackIds.has(x.id)),
        furnishings: p.furnishings.filter((fu) => !stackIds.has(fu.facilityId)),
        connections: (p.connections || []).filter((c) => !stack.some((x) => x.floorId === c.floorId && c.x >= x.x && c.x < x.x + x.w && c.y >= x.y && c.y < x.y + x.h && c.type === "Staircase")),
      };
    });
  }
  if (kind === "furnishing") {
    return update((p) => ({ ...p, furnishings: p.furnishings.filter((x) => x.id !== id) }));
  }
  if (kind === "connection") {
    return update((p) => ({ ...p, connections: (p.connections || []).filter((x) => x.id !== id) }));
  }
  if (kind === "wall") {
    return update((p) => ({ ...p, walls: (p.walls || []).filter((x) => x.id !== id) }));
  }
}