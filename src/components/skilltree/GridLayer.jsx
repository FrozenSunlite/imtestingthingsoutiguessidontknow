import { useEffect, useMemo, useRef } from "react";
import { gridPaths } from "@/lib/geometry";

const MAX_PIXELS = 4096 * 4096;

// Grid rendered to a <canvas> instead of thousands of live SVG paths: the
// browser slides and scales the rasterized bitmap as a cached texture, instead
// of re-rasterizing vector geometry every frame. Between redraws the bitmap is
// simply scaled; it redraws at a sharper resolution only when the zoom has
// shifted by more than ~10%.
export function GridLayer({ bounds, grid, zoom }) {
  const ref = useRef(null);
  const state = useRef({ sig: "", z: 0 });

  const boundsKey = bounds
    ? `${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}`
    : "";
  const drawn =
    !!bounds && bounds.maxX > bounds.minX && bounds.maxY > bounds.minY;
  const g = useMemo(
    () => (drawn ? gridPaths(bounds, grid) : { paths: [], dots: [], subDots: [] }),
     
    [boundsKey, grid]
  );
  const gridSig = `${boundsKey}|${grid?.type}|${grid?.snapSize}|${grid?.hexOrientation}|${grid?.opacity}`;
  const empty = g.paths.length === 0 && g.dots.length === 0 && g.subDots.length === 0;
  // One combined Path2D for every cell: a single stroke call keeps huge hex
  // grids (tens of thousands of cells at small snap sizes) affordable.
  const combined = useMemo(() => {
    const p = new Path2D();
    for (const d of g.paths) p.addPath(new Path2D(d));
    return p;
  }, [g]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !drawn || empty) return undefined;
    const z = Math.min(3, Math.max(0.25, zoom || 1));
    const prev = state.current;
    const zoomChanged = Math.abs(z - prev.z) / (prev.z || 1) >= 0.1;
    if (prev.sig === gridSig && !zoomChanged) return undefined;
    // Let the camera transform land first; redrawing a large grid canvas
    // synchronously during the commit frame is what makes zoom feel sticky.
    const timer = setTimeout(() => {
      prev.sig = gridSig;
      prev.z = z;
      const w = bounds.maxX - bounds.minX;
      const h = bounds.maxY - bounds.minY;
      // Cap the bitmap so huge trees can't blow up GPU memory; beyond the cap
      // the grid just renders softer when zoomed in.
      const r = Math.min(z, Math.sqrt(MAX_PIXELS / (w * h)));
      canvas.width = Math.round(w * r);
      canvas.height = Math.round(h * r);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const color = getComputedStyle(canvas).color || "hsl(0 0% 50%)";
      ctx.setTransform(r, 0, 0, r, -bounds.minX * r, -bounds.minY * r);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1 / r;
      ctx.globalAlpha = grid.opacity ?? 1;
      if (g.paths.length) ctx.stroke(combined);
      ctx.globalAlpha = Math.min(1, (grid.opacity ?? 1) * 2.2);
      for (const p of g.dots) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 / r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = Math.min(0.45, (grid.opacity ?? 1) * 1.2);
      for (const p of g.subDots) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.1 / r, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 70);
    return () => clearTimeout(timer);
  }, [g, combined, gridSig, zoom, drawn, empty, bounds, grid]);

  if (!drawn || empty) return null;
  return (
    <canvas
      ref={ref}
      className="text-foreground"
      style={{
        position: "absolute",
        left: bounds.minX,
        top: bounds.minY,
        width: bounds.maxX - bounds.minX,
        height: bounds.maxY - bounds.minY,
        pointerEvents: "none",
      }}
    />
  );
}