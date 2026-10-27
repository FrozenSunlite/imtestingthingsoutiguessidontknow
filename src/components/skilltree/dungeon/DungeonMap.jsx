import { useMemo } from "react";
import { categoryColor, dungeonBounds } from "@/lib/dungeonGen";

const PX = 7; // pixels per space
const PAD = 7;

// Schematic dungeon map: rooms are drawn to scale in spaces, with connectors
// between their centres. Click a room to inspect/edit it.
export function DungeonMap({ dungeon, selectedId, onSelect }) {
  const rooms = dungeon?.rooms || [];
  const connections = dungeon?.connections || [];
  const b = useMemo(() => dungeonBounds(dungeon), [dungeon]);
  const toX = (x) => (x - b.minX + PAD) * PX;
  const toY = (y) => (y - b.minY + PAD) * PX;
  const width = (b.w + PAD * 2) * PX;
  const height = (b.h + PAD * 2) * PX;

  if (!rooms.length) {
    return (
      <div className="flex h-full min-h-[16rem] items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
        Generate a dungeon to see its map.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto rounded-md border bg-background">
      <svg
        width={Math.max(640, width)}
        height={Math.max(420, height)}
        viewBox={`0 0 ${Math.max(640, width)} ${Math.max(420, height)}`}
        className="block"
        style={{ minWidth: "100%" }}
      >
        <defs>
          <pattern id="dungeon-grid" width={PX * 2} height={PX * 2} patternUnits="userSpaceOnUse">
            <path d={`M ${PX * 2} 0 L 0 0 0 ${PX * 2}`} fill="none" stroke="currentColor" strokeOpacity="0.06" strokeWidth="1" />
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
              <text
                x={(x1 + x2) / 2}
                y={(y1 + y2) / 2 - 3}
                textAnchor="middle"
                fontSize="7"
                fill="hsl(var(--muted-foreground))"
                fillOpacity="0.8"
              >
                {c.type}
              </text>
            </g>
          );
        })}
        {rooms.map((room) => {
          const x = toX(room.x);
          const y = toY(room.y);
          const w = room.w * PX;
          const h = room.h * PX;
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
            <g
              key={room.id}
              onClick={() => onSelect?.(room.id)}
              style={{ cursor: "pointer" }}
            >
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
                {room.category} · {room.w}×{room.h}
              </text>
              {badges.length > 0 && (
                <text x={x + 4} y={y + h - 5} fontSize="7" fontWeight="600" fill={color}>
                  {badges.join(" ")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
