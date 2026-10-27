import { useEffect, useMemo, useRef, useState } from "react";
import { categoryColor, dungeonBounds } from "@/lib/dungeonGen";

const PX = 7; // pixels per space at 100%
const PAD = 7;

// Schematic dungeon map: rooms are drawn to scale in spaces, with connectors
// between their centres. Rooms can be dragged to move and resized from the
// selected room's bottom-right handle. The controls mirror the Architect's
// select/move, resize, zoom and fit workflow.
export function DungeonMap({ dungeon, selectedId, onSelect, onMoveRoom, onResizeRoom }) {
  const rooms = dungeon?.rooms || [];
  const connections = dungeon?.connections || [];
  const b = useMemo(() => dungeonBounds(dungeon), [dungeon]);
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const px = PX * zoom;
  const toX = (x) => (x - b.minX + PAD) * px;
  const toY = (y) => (y - b.minY + PAD) * px;
  const width = (b.w + PAD * 2) * px;
  const height = (b.h + PAD * 2) * px;

  const pointToWorld = (e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const sx = ((e.clientX - rect.left) / rect.width) * Math.max(640, width);
    const sy = ((e.clientY - rect.top) / rect.height) * Math.max(420, height);
    return {
      x: sx / px + b.minX - PAD,
      y: sy / px + b.minY - PAD,
    };
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      const w = pointToWorld(e);
      if (drag.kind === "move") {
        setDrag((d) => ({
          ...d,
          x: Math.max(0, Math.round(drag.ox + (w.x - drag.sx))),
          y: Math.max(0, Math.round(drag.oy + (w.y - drag.sy))),
        }));
      } else {
        setDrag((d) => ({
          ...d,
          w: Math.max(2, Math.round(drag.ow + (w.x - drag.sx))),
          h: Math.max(2, Math.round(drag.oh + (w.y - drag.sy))),
        }));
      }
      e.preventDefault();
    };
    const up = () => {
      const d = dragRef.current;
      if (d?.kind === "move") onMoveRoom?.(d.id, d.x, d.y);
      else if (d?.kind === "resize") onResizeRoom?.(d.id, d.w, d.h);
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id, drag?.kind, drag?.sx, drag?.sy, drag?.ox, drag?.oy, drag?.ow, drag?.oh]);

  const startMove = (e, room) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect?.(room.id);
    const w = pointToWorld(e);
    setDrag({
      kind: "move",
      id: room.id,
      sx: w.x,
      sy: w.y,
      ox: room.x,
      oy: room.y,
      x: room.x,
      y: room.y,
      w: room.w,
      h: room.h,
    });
  };
  const startResize = (e, room) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const w = pointToWorld(e);
    setDrag({
      kind: "resize",
      id: room.id,
      sx: w.x,
      sy: w.y,
      ox: room.x,
      oy: room.y,
      x: room.x,
      y: room.y,
      ow: room.w,
      oh: room.h,
      w: room.w,
      h: room.h,
    });
  };
  const fit = () => {
    const cw = wrapRef.current?.clientWidth || 800;
    const ch = wrapRef.current?.clientHeight || 500;
    const z = Math.min((cw - 20) / ((b.w + PAD * 2) * PX), (ch - 20) / ((b.h + PAD * 2) * PX), 1);
    setZoom(Math.max(0.25, Math.min(1.6, z)));
  };

  if (!rooms.length) {
    return (
      <div className="flex h-full min-h-[16rem] items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
        Generate a dungeon to see its map.
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[300px] overflow-hidden rounded-md border bg-background">
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <button type="button" className="h-7 w-7 rounded border bg-background text-xs" title="Zoom out" onClick={() => setZoom((z) => Math.max(0.25, z / 1.2))}>−</button>
        <button type="button" className="h-7 w-7 rounded border bg-background text-xs" title="Zoom in" onClick={() => setZoom((z) => Math.min(1.8, z * 1.2))}>+</button>
        <button type="button" className="h-7 rounded border bg-background px-2 text-[10px]" title="Fit the dungeon in view" onClick={fit}>Fit</button>
      </div>
      <div ref={wrapRef} className="h-full overflow-auto">
        <svg
          ref={svgRef}
          width={Math.max(640, width)}
          height={Math.max(420, height)}
          viewBox={`0 0 ${Math.max(640, width)} ${Math.max(420, height)}`}
          className="block"
          style={{ minWidth: "100%" }}
          onWheel={(e) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            setZoom((z) => Math.max(0.25, Math.min(1.8, z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))));
          }}
        >
          <defs>
            <pattern id="dungeon-grid" width={px * 2} height={px * 2} patternUnits="userSpaceOnUse">
              <path d={`M ${px * 2} 0 L 0 0 0 ${px * 2}`} fill="none" stroke="currentColor" strokeOpacity="0.06" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dungeon-grid)" />
          {connections.map((c) => {
            const from = rooms.find((r) => r.id === c.from);
            const to = rooms.find((r) => r.id === c.to);
            if (!from || !to) return null;
            const x1 = toX(from.x + from.w / 2);
            const y1 = toY(from.y + from.h / 2);
            const x2 = toX(to.x + to.w / 2);
            const y2 = toY(to.y + to.h / 2);
            return (
              <g key={c.id}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--muted-foreground))" strokeOpacity="0.55" strokeWidth="1.5" />
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 3} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fillOpacity="0.8">
                  {c.type}
                </text>
              </g>
            );
          })}
          {rooms.map((room) => {
            const preview = drag?.id === room.id ? { ...room, ...drag } : room;
            const x = toX(preview.x);
            const y = toY(preview.y);
            const w = preview.w * px;
            const h = preview.h * px;
            const selected = selectedId === room.id;
            const color = categoryColor(room.category);
            const badges = [
              room.traps?.length ? "T" : "",
              room.spawns?.length ? "S" : "",
              room.loot?.length ? "L" : "",
              room.elevation && room.elevation !== "Flat" ? "E" : "",
              room.cover && room.cover !== "Open" ? "C" : "",
            ].filter(Boolean);
            return (
              <g key={room.id} onPointerDown={(e) => startMove(e, room)} style={{ cursor: "grab" }}>
                <title>
                  {`${room.name} — ${room.category} · ${room.w}×${room.h} spaces\n${room.environment}\n${room.elevation} · ${room.cover}\n${room.traps?.length ? `Trap: ${room.traps.join("; ")}\n` : ""}${room.spawns?.length ? `Spawns: ${room.spawns.join("; ")}\n` : ""}${room.loot?.length ? `Loot: ${room.loot.join("; ")}` : ""}`}
                </title>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={3}
                  fill={color}
                  fillOpacity={selected ? 0.35 : 0.16}
                  stroke={selected ? "hsl(var(--primary))" : color}
                  strokeWidth={selected ? 2.5 : 1.3}
                />
                <text x={x + 4} y={y + 12} fontSize="9" fontWeight="600" fill="hsl(var(--foreground))">
                  {String(room.name || room.category).slice(0, 26)}
                </text>
                <text x={x + 4} y={y + 21} fontSize="7" fill="hsl(var(--muted-foreground))">
                  {room.category} · {preview.w}×{preview.h}
                </text>
                {badges.length > 0 && (
                  <text x={x + 4} y={y + h - 5} fontSize="7" fontWeight="600" fill={color}>
                    {badges.join(" ")}
                  </text>
                )}
                {selected && (
                  <rect
                    x={x + w - 6}
                    y={y + h - 6}
                    width={10}
                    height={10}
                    fill="hsl(var(--primary))"
                    stroke="hsl(var(--background))"
                    strokeWidth="1"
                    style={{ cursor: "nwse-resize" }}
                    onPointerDown={(e) => startResize(e, room)}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
