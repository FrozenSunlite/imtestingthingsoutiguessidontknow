import { useEffect, useMemo, useRef, useState } from "react";
import {
  categoryColor,
  cellsFillPath,
  cellsOutlinePath,
  dungeonBounds,
  roomShapeCells,
} from "@/lib/dungeonGen";

const PX = 7; // pixels per space at 100%
const PAD = 7;

// Schematic dungeon map: rooms are drawn to scale in spaces, with connectors
// between their centres. Rooms can be dragged to move and resized from the
// selected room's bottom-right handle. The controls mirror the Architect's
// select/move, resize, zoom and fit workflow.
export function DungeonMap({
  dungeon,
  selectedId,
  onSelect,
  onMoveRoom,
  onResizeRoom,
  onContextMenu,
}) {
  const rooms = dungeon?.rooms || [];
  const connections = dungeon?.connections || [];
  const b = useMemo(() => dungeonBounds(dungeon), [dungeon]);
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState(null);
  const [pan, setPan] = useState(null);
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

  // Drag empty map space to pan; the scroll container keeps the map usable at
  // any zoom level. Arrow keys also pan when the map has focus.
  useEffect(() => {
    if (!pan) return;
    const move = (e) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      wrap.scrollLeft = pan.sl - (e.clientX - pan.sx);
      wrap.scrollTop = pan.st - (e.clientY - pan.sy);
      e.preventDefault();
    };
    const up = () => setPan(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [pan]);

  const startPan = (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    setPan({
      sx: e.clientX,
      sy: e.clientY,
      sl: wrap.scrollLeft,
      st: wrap.scrollTop,
    });
  };

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
  const centerSelected = () => {
    const room = rooms.find((r) => r.id === selectedId);
    const wrap = wrapRef.current;
    if (!room || !wrap) return;
    wrap.scrollLeft = toX(room.x + room.w / 2) - wrap.clientWidth / 2;
    wrap.scrollTop = toY(room.y + room.h / 2) - wrap.clientHeight / 2;
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
        <button type="button" className="h-7 rounded border bg-background px-2 text-[10px]" title="Center the selected room" onClick={centerSelected} disabled={!selectedId}>Center</button>
      </div>
      <div
        ref={wrapRef}
        className="h-full overflow-auto outline-none"
        tabIndex={0}
        onPointerDown={startPan}
        onWheel={(e) => {
          // Leave a normal wheel alone so the map can scroll vertically down;
          // Ctrl/⌘ + wheel is reserved for zooming.
          if (!e.ctrlKey && !e.metaKey) return;
          e.preventDefault();
          setZoom((z) => Math.max(0.25, Math.min(1.8, z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))));
        }}
        onKeyDown={(e) => {
          const wrap = wrapRef.current;
          if (!wrap) return;
          const step = 48;
          if (e.key === "ArrowLeft") wrap.scrollLeft -= step;
          else if (e.key === "ArrowRight") wrap.scrollLeft += step;
          else if (e.key === "ArrowUp") wrap.scrollTop -= step;
          else if (e.key === "ArrowDown") wrap.scrollTop += step;
          else return;
          e.preventDefault();
        }}
      >
        <svg
          ref={svgRef}
          width={Math.max(640, width)}
          height={Math.max(420, height)}
          viewBox={`0 0 ${Math.max(640, width)} ${Math.max(420, height)}`}
          className="block"
          style={{ minWidth: "100%", cursor: pan ? "grabbing" : "grab" }}
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenu?.({
              x: e.clientX,
              y: e.clientY,
              roomId: null,
              world: pointToWorld(e),
            });
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
            const cells = roomShapeCells(preview);
            const fillPath = cellsFillPath(cells, px, x, y);
            const outlinePath = cellsOutlinePath(cells, px, x, y);
            const badges = [
              room.bonfire ? "♨" : "",
              room.traps?.length ? "T" : "",
              room.spawns?.length || room.spawnPoints?.length ? "S" : "",
              room.ingressPoints?.length ? "I" : "",
              room.loot?.length ? "L" : "",
              room.elevation && room.elevation !== "Flat" ? "E" : "",
              room.cover && room.cover !== "Open" ? "C" : "",
            ].filter(Boolean);
            return (
              <g
                key={room.id}
                onPointerDown={(e) => startMove(e, room)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect?.(room.id);
                  onContextMenu?.({
                    x: e.clientX,
                    y: e.clientY,
                    roomId: room.id,
                    world: pointToWorld(e),
                  });
                }}
                style={{ cursor: "grab" }}
              >
                <title>
                  {`${room.name} — ${room.category} · ${room.w}×${room.h} spaces\n${room.environment}\n${room.elevation} · ${room.cover}${room.bonfire ? "\nBonfire safe zone — short rest" : ""}\n${room.traps?.length ? `Trap: ${room.traps.join("; ")}\n` : ""}${room.spawns?.length ? `Spawns: ${room.spawns.join("; ")}\n` : ""}${room.loot?.length ? `Loot: ${room.loot.join("; ")}` : ""}`}
                </title>
                <path d={fillPath} fill={color} fillOpacity={selected ? 0.35 : 0.16} />
                <path
                  d={outlinePath}
                  fill="none"
                  stroke={selected ? "hsl(var(--primary))" : color}
                  strokeWidth={selected ? 2.5 : 1.3}
                  strokeLinecap="square"
                />
                <text x={x + 4} y={y + 12} fontSize="9" fontWeight="600" fill="hsl(var(--foreground))">
                  {String(room.name || room.category).slice(0, 26)}
                </text>
                <text x={x + 4} y={y + 21} fontSize="7" fill="hsl(var(--muted-foreground))">
                  {room.category} · {preview.w}×{preview.h}
                  {room.bonfire ? " · short rest" : ""}
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
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-[9px] text-muted-foreground">
        Drag to pan · Ctrl/⌘ + wheel to zoom · right-click a room to edit
      </div>
    </div>
  );
}
