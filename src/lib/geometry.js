// Geometry + grid + formula helpers for the skill tree canvas.

// Build an SVG path between two node centers.
export function connectionPath(x1, y1, x2, y2, style = "curved") {
  if (style === "straight") {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  if (style === "angular") {
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`;
  }
  // curved (horizontal cubic bezier)
  const dx = x2 - x1;
  const cx1 = x1 + dx * 0.5;
  const cx2 = x1 + dx * 0.5;
  return `M ${x1} ${y1} C ${cx1} ${y1} ${cx2} ${y2} ${x2} ${y2}`;
}

const HEX_SQRT3 = Math.sqrt(3);

// Standard cube-rounding for hex axial coordinates.
function hexAxialRound(q, r) {
  const x = q,
    z = r,
    y = -x - z;
  let rx = Math.round(x),
    ry = Math.round(y),
    rz = Math.round(z);
  const dx = Math.abs(rx - x),
    dy = Math.abs(ry - y),
    dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

// Snap a world POINT to the grid, per grid type:
// - square: cell corners AND cell centers (half steps)
// - hex: the center of the nearest hexagon
// - circle: same angle, radius snapped to a multiple of the grid size
export function snapPoint(x, y, grid) {
  if (!grid || !grid.snapEnabled || !grid.snapSize) return { x, y };
  const size = grid.snapSize;
  if (grid.type === "circle") {
    const d = Math.hypot(x, y);
    if (d === 0) return { x: 0, y: 0 };
    const rn = Math.round(d / size) * size;
    return { x: (x / d) * rn, y: (y / d) * rn };
  }
  if (grid.type === "triangle") {
    // Triangular lattice: rows every (√3/2)·size, odd rows offset by size/2.
    const h = (Math.sqrt(3) / 2) * size;
    const j = Math.round(y / h);
    const off = ((j % 2) + 2) % 2 ? size / 2 : 0;
    const i = Math.round((x - off) / size);
    return { x: i * size + off, y: j * h };
  }
  if (grid.type === "hex") {
    const R = size;
    const flat = grid.hexOrientation === "horizontal";
    let cx, cy;
    if (flat) {
      // Flat-top hexagons.
      const { q, r } = hexAxialRound(
        ((2 / 3) * x) / R,
        (-x / 3 + (HEX_SQRT3 / 3) * y) / R
      );
      cx = R * 1.5 * q;
      cy = R * HEX_SQRT3 * (r + q / 2);
    } else {
      // Pointy-top hexagons (default).
      const { q, r } = hexAxialRound(
        ((HEX_SQRT3 / 3) * x - y / 3) / R,
        ((2 / 3) * y) / R
      );
      cx = R * HEX_SQRT3 * (q + r / 2);
      cy = R * 1.5 * r;
    }
    // Beyond the center, talents can also latch to the hex's six corners and
    // six edge midpoints: the nearest of the 13 positions wins. Corners and
    // midpoints are shared with neighbouring hexes, so the nearest hex's set
    // always contains the globally closest point.
    const start = flat ? 0 : -30; // first corner angle
    let best = { x: cx, y: cy };
    let bestD = Math.hypot(x - cx, y - cy);
    for (let k = 0; k < 6; k++) {
      const a = ((start + 60 * k) * Math.PI) / 180;
      const m = a + Math.PI / 6;
      const mr = (R * HEX_SQRT3) / 2;
      for (const p of [
        { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R },
        { x: cx + Math.cos(m) * mr, y: cy + Math.sin(m) * mr },
      ]) {
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
    }
    return best;
  }
  const half = size / 2;
  return { x: Math.round(x / half) * half, y: Math.round(y / half) * half };
}

// Six hex edges as a closed subpath.
function hexOutline(cx, cy, R, orientation) {
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (orientation === "flat" ? 60 * k : 60 * k - 30);
    pts.push(`${cx + Math.cos(a) * R} ${cy + Math.sin(a) * R}`);
  }
  return `M ${pts.join(" L ")} Z`;
}

// Build the SVG grid for the visible bounds.
// Returns { paths: [d], dots: [{x, y}] } — dots are snap points at cell centers.
export function gridPaths(bounds, grid) {
  const size = grid.snapSize || 120;
  const { minX, minY, maxX, maxY } = bounds;
  const paths = [];
  const dots = [];
  const subDots = [];
  if (grid.type === "square") {
    for (let x = Math.floor(minX / size) * size; x <= maxX; x += size)
      paths.push(`M ${x} ${minY} L ${x} ${maxY}`);
    for (let y = Math.floor(minY / size) * size; y <= maxY; y += size)
      paths.push(`M ${minX} ${y} L ${maxX} ${y}`);
    // Center dot of every cell (capped so extreme zoom-outs stay fast).
    const cols = Math.ceil((maxX - minX) / size) + 1;
    const rows = Math.ceil((maxY - minY) / size) + 1;
    if (cols * rows <= 4000) {
      for (let x = Math.floor(minX / size) * size + size / 2; x <= maxX; x += size)
        for (let y = Math.floor(minY / size) * size + size / 2; y <= maxY; y += size)
          dots.push({ x, y });
    }
  } else if (grid.type === "hex") {
    if (grid.hexOrientation === "horizontal") {
      // Flat-top hexagons: columns every 1.5R, rows every sqrt(3)R, half-row offset per column.
      const dx = 1.5 * size;
      const dy = HEX_SQRT3 * size;
      const i0 = Math.floor(minX / dx) - 1, i1 = Math.ceil(maxX / dx) + 1;
      const j0 = Math.floor((minY - dy / 2) / dy) - 1, j1 = Math.ceil((maxY - dy / 2) / dy) + 1;
      const cells = (i1 - i0) * (j1 - j0);
      const withSub = cells <= 2000;
      // Large cap: the grid rasterizes to a cached bitmap (one combined
      // stroke in GridLayer), so tens of thousands of cells stay affordable
      // instead of the grid vanishing at small cell sizes.
      if (cells <= 30000) {
        for (let i = i0; i <= i1; i++)
          for (let j = j0; j <= j1; j++) {
            const cx = i * dx;
            const cy = j * dy + (Math.abs(i) % 2 ? (HEX_SQRT3 * size) / 2 : 0);
            paths.push(hexOutline(cx, cy, size, "flat"));
            dots.push({ x: cx, y: cy });
            if (withSub) hexSubDots(subDots, cx, cy, size, 0);
          }
      }
    } else {
      // Pointy-top hexagons: rows every 1.5R, columns every sqrt(3)R, half-col offset per row.
      const dx = HEX_SQRT3 * size;
      const dy = 1.5 * size;
      const i0 = Math.floor((minX - dx / 2) / dx) - 1, i1 = Math.ceil((maxX - dx / 2) / dx) + 1;
      const j0 = Math.floor(minY / dy) - 1, j1 = Math.ceil(maxY / dy) + 1;
      const cells = (i1 - i0) * (j1 - j0);
      const withSub = cells <= 2000;
      // Large cap: the grid rasterizes to a cached bitmap (one combined
      // stroke in GridLayer), so tens of thousands of cells stay affordable
      // instead of the grid vanishing at small cell sizes.
      if (cells <= 30000) {
        for (let j = j0; j <= j1; j++)
          for (let i = i0; i <= i1; i++) {
            const cx = i * dx + (Math.abs(j) % 2 ? dx / 2 : 0);
            const cy = j * dy;
            paths.push(hexOutline(cx, cy, size, "pointy"));
            dots.push({ x: cx, y: cy });
            if (withSub) hexSubDots(subDots, cx, cy, size, -30);
          }
      }
    }
  } else if (grid.type === "circle") {
    // Bullseye: concentric rings around the world origin.
    const maxR =
      Math.hypot(Math.max(Math.abs(minX), maxX), Math.max(Math.abs(minY), maxY)) + size;
    for (let r = size; r <= maxR; r += size) {
      paths.push(`M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0`);
    }
    dots.push({ x: 0, y: 0 });
  } else if (grid.type === "triangle") {
    // Triangular tiling of equilateral triangles around the world origin.
    const h = (Math.sqrt(3) / 2) * size;
    const j0 = Math.floor(minY / h) - 1, j1 = Math.ceil(maxY / h) + 1;
    const maxCols = Math.ceil((maxX - minX) / size) + 3;
    // Same large cap as hex: the grid rasterizes to a cached bitmap.
    if ((j1 - j0 + 1) * maxCols <= 30000) {
      for (let j = j0; j <= j1; j++) {
        const cy = j * h;
        const off = ((j % 2) + 2) % 2 ? size / 2 : 0;
        const i0 = Math.floor((minX - off) / size) - 1;
        const i1 = Math.ceil((maxX - off) / size) + 1;
        for (let i = i0; i <= i1; i++) {
          const cx = i * size + off;
          // Each point owns its right edge and its two downward edges, so
          // every edge of every triangle is drawn exactly once.
          paths.push(`M ${cx} ${cy} L ${cx + size} ${cy}`);
          paths.push(`M ${cx} ${cy} L ${cx - size / 2} ${cy + h}`);
          paths.push(`M ${cx} ${cy} L ${cx + size / 2} ${cy + h}`);
          dots.push({ x: cx, y: cy });
        }
      }
    }
  }
  return { paths, dots, subDots };
}

// The 12 extra snap positions of one hex: 6 corners at `base` angle and 6
// edge midpoints (corner angle + 30°, radius R·√3/2).
function hexSubDots(out, cx, cy, R, baseDeg) {
  const mr = (R * HEX_SQRT3) / 2;
  for (let k = 0; k < 6; k++) {
    const a = ((baseDeg + 60 * k) * Math.PI) / 180;
    const b = a + Math.PI / 6;
    out.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
    out.push({ x: cx + Math.cos(b) * mr, y: cy + Math.sin(b) * mr });
  }
}

// Evaluate a resource value that may be a number or a formula.
export function evalResource(value, vars = {}) {
  if (value == null) return "";
  const s = String(value).trim();
  if (s === "") return "";
  if (/^-?\d+(\.\d+)?$/.test(s)) return s;
  try {
    const names = Object.keys(vars);
    const vals = Object.values(vars);
    const expr = s.replace(/[^-+*/().,\w\s]/g, "");
    if (!expr || !/[-+*/]/.test(expr)) return s;
     
    const fn = new Function(...names, `"use strict"; return (${expr});`);
    const result = fn(...vals);
    if (result == null || (typeof result === "number" && isNaN(result))) return s;
    return String(result);
  } catch {
    return s;
  }
}

// Mutually exclusive nodes (linked in either direction) can never both hold
// points: "the same talent" living in two unconnected trees.
export function isExclusiveBlocked(node, nodesById) {
  if (!node || !nodesById) return false;
  const ids = new Set(node.exclusiveWith || []);
  Object.values(nodesById).forEach((n) => {
    if (n && n.id !== node.id && (n.exclusiveWith || []).includes(node.id)) ids.add(n.id);
  });
  for (const id of ids) {
    if (id !== node.id && (nodesById[id]?.currentPoints || 0) > 0) return true;
  }
  return false;
}

// Determine whether a node's prerequisites are satisfied.
// requirementMode: 'none' | 'any' | 'all'
// Names of every unlocked node in a node list — top level plus any subtree
// nodes, at any nesting depth. Cross-tree prerequisites check against this.
export function collectUnlockedNames(nodes, out = new Set()) {
  for (const n of nodes || []) {
    if ((n.currentPoints || 0) > 0 && n.name) out.add(n.name);
    const inner = n.subtrees
      ? (n.subtrees || []).flatMap((s) => s.nodes || [])
      : n.subtree?.nodes || [];
    if (inner.length) collectUnlockedNames(inner, out);
  }
  return out;
}

export function isAvailable(node, nodesById, unlockedNames) {
  if (isExclusiveBlocked(node, nodesById)) return false;
  // Cross-tree prerequisites: named nodes that must be unlocked anywhere —
  // the main tree, another subtree, or this node's own tree.
  if ((node.requiresNames || []).length > 0) {
    if (!unlockedNames || !node.requiresNames.every((name) => unlockedNames.has(name)))
      return false;
  }
  if (!node.dependencies || node.dependencies.length === 0) return true;
  if (node.requirementMode === "none") return true;
  const deps = node.dependencies.map((id) => nodesById[id]).filter(Boolean);
  if (deps.length === 0) return true;
  // Prerequisite points: 0 means "auto" — whatever it takes to unlock the
  // prerequisite node itself (its cost, at least one point).
  const reqRaw = Number(node.requiredPoints);
  const need = (d) =>
    reqRaw === 0 ? Math.max(1, Number(d.cost ?? 1) || 1) : reqRaw > 0 ? reqRaw : 1;
  const met = deps.filter((d) => (d.currentPoints || 0) >= need(d));
  if (node.requirementMode === "any") return met.length >= 1;
  return met.length === deps.length;
}

// Full point list of a connection: start, bend points, end.
export function connectionPoints(conn, from, to) {
  return [
    { x: from.x, y: from.y },
    ...(conn.bends || []),
    { x: to.x, y: to.y },
  ];
}

// Build an SVG path through a list of points.
// straight: one direct line; angular: polyline; curved: smooth Catmull-Rom
// converted to cubic beziers.
export function pathThroughPoints(pts, style = "curved") {
  if (pts.length < 2) return "";
  if (style === "straight") {
    const a = pts[0];
    const b = pts[pts.length - 1];
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  if (style === "angular") {
    return "M " + pts.map((p) => `${p.x} ${p.y}`).join(" L ");
  }
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

function distToSegment(px, py, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - a.x, py - a.y);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

// Find the nearest segment and nearest existing bend to a world point.
// bendIndex is an index into the connection's bends array (-1 if none).
export function nearestConnectionTarget(pts, x, y) {
  let segIndex = 0,
    segDist = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(x, y, pts[i], pts[i + 1]);
    if (d < segDist) {
      segDist = d;
      segIndex = i;
    }
  }
  let ptIndex = -1,
    bendDist = Infinity;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.hypot(x - pts[i].x, y - pts[i].y);
    if (d < bendDist) {
      bendDist = d;
      ptIndex = i;
    }
  }
  return {
    segIndex,
    segDist,
    bendIndex: ptIndex > 0 ? ptIndex - 1 : -1,
    bendDist,
  };
}