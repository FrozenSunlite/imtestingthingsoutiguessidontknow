import { useMemo, useRef } from "react";

const W = 224;
const H = 150;
const PAD = 10;

// Bottom-corner overview of the whole tree: one dot per node (brighter when
// the node holds points), the full grid extent as the map area, and a
// rectangle showing the part of the world currently on screen. Click or drag
// inside it to jump the camera, keeping the current zoom.
export function MiniMap({ nodes, gridBounds, view, vp, onJump }) {
  const ref = useRef(null);
  const draggingRef = useRef(false);

  const { bounds, scale, ox, oy } = useMemo(() => {
    const b =
      gridBounds ||
      (nodes.length
        ? {
            minX: Math.min(...nodes.map((n) => n.x)),
            maxX: Math.max(...nodes.map((n) => n.x)),
            minY: Math.min(...nodes.map((n) => n.y)),
            maxY: Math.max(...nodes.map((n) => n.y)),
          }
        : { minX: -500, minY: -500, maxX: 500, maxY: 500 });
    const w = Math.max(1, b.maxX - b.minX);
    const h = Math.max(1, b.maxY - b.minY);
    const s = Math.min((W - PAD * 2) / w, (H - PAD * 2) / h);
    return { bounds: b, scale: s, ox: (W - w * s) / 2, oy: (H - h * s) / 2 };
  }, [gridBounds, nodes]);

  const toMap = (x, y) => ({
    mx: ox + (x - bounds.minX) * scale,
    my: oy + (y - bounds.minY) * scale,
  });

  const dots = useMemo(
    () =>
      nodes.map((n) => ({
        ...toMap(n.x, n.y),
        taken: (n.currentPoints || 0) > 0,
      })),
     
    [nodes, bounds.minX, bounds.minY, scale, ox, oy]
  );

  // Viewport rectangle in map coordinates.
  const z = view.zoom || 0.1;
  const v1 = toMap(-view.panX / z, -view.panY / z);
  const v2 = toMap((vp.w - view.panX) / z, (vp.h - view.panY) / z);

  const jump = (e) => {
    const rect = ref.current.getBoundingClientRect();
    onJump(
      bounds.minX + (e.clientX - rect.left - ox) / scale,
      bounds.minY + (e.clientY - rect.top - oy) / scale
    );
  };

  return (
    <div
      className="absolute bottom-3 right-3 z-10 overflow-hidden rounded-md border bg-background/85 shadow"
      style={{ width: W, height: H, touchAction: "none" }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        draggingRef.current = true;
        jump(e);
      }}
      onPointerMove={(e) => draggingRef.current && jump(e)}
      onPointerUp={(e) => {
        draggingRef.current = false;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
    >
      <svg ref={ref} width={W} height={H} shapeRendering="geometricPrecision">
        <rect
          x={ox}
          y={oy}
          width={(bounds.maxX - bounds.minX) * scale}
          height={(bounds.maxY - bounds.minY) * scale}
          className="fill-muted/40 stroke-border"
          strokeWidth={1}
        />
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.mx}
            cy={d.my}
            r={2}
            className={d.taken ? "fill-primary" : "fill-muted-foreground/50"}
          />
        ))}
        <rect
          x={Math.min(v1.mx, v2.mx)}
          y={Math.min(v1.my, v2.my)}
          width={Math.abs(v2.mx - v1.mx)}
          height={Math.abs(v2.my - v1.my)}
          className="fill-primary/10 stroke-primary"
          strokeWidth={1.5}
          rx={2}
        />
      </svg>
    </div>
  );
}