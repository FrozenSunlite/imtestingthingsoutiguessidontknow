import {
  cellsFillPath,
  cellsOutlinePath,
  roomShapeCells,
} from "@/lib/dungeonGen";

// Schematic battle map for a dungeon room. The room's grid cells can describe
// rectangle, L/T/U/cross or painted cave-like footprints, so the DM sees the
// actual fighting space rather than a generic square.
export function RoomBattleMap({ room }) {
  if (!room) return null;
  const local = roomShapeCells(room);
  const w = Math.max(1, Number(room.w) || 1);
  const h = Math.max(1, Number(room.h) || 1);
  const cols = Math.max(10, w + 2);
  const rows = Math.max(10, h + 2);
  const ox = Math.floor((cols - w) / 2);
  const oy = Math.floor((rows - h) / 2);
  const cells = local.map(([x, y]) => [x + ox, y + oy]);
  const cell = 18;
  const px = cols * cell;
  const py = rows * cell;
  const fillPath = cellsFillPath(cells, cell);
  const outlinePath = cellsOutlinePath(cells, cell);
  const center = cells[Math.floor(cells.length / 2)] || [cols / 2, rows / 2];
  const traps = room.traps || [];
  const spawns = room.spawns || [];
  const loot = room.loot || [];
  const harvest = room.harvest || [];
  const spawnPoints = (room.spawnPoints || []).filter(
    (p) => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y))
  );
  const ingressPoints = (room.ingressPoints || []).filter(
    (p) => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y))
  );

  const at = (i) => cells[((i % cells.length) + cells.length) % cells.length] || center;
  const label = (cx, cy, text, fill = "hsl(var(--muted-foreground))", size = 6) => (
    <text x={cx} y={cy} fontSize={size} fill={fill} textAnchor="middle">
      {text}
    </text>
  );

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Battle map · {w} × {h} footprint
        </p>
        <span className="truncate text-[9px] text-muted-foreground">
          {room.environment || "—"}{room.bonfire ? " · bonfire" : ""}
        </span>
      </div>
      <svg viewBox={`0 0 ${px} ${py}`} className="w-full rounded-md border bg-background">
        <defs>
          <pattern id="battle-grid" width={cell} height={cell} patternUnits="userSpaceOnUse">
            <path
              d={`M ${cell} 0 L 0 0 0 ${cell}`}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.12"
              strokeWidth="0.6"
            />
          </pattern>
        </defs>
        <rect width={px} height={py} fill="url(#battle-grid)" />
        <path d={fillPath} fill="hsl(var(--muted))" fillOpacity="0.28" />
        <path d={outlinePath} fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.4" />

        {/* Elevation dais in the middle of the usable area. */}
        {room.elevation && room.elevation !== "Flat" && (
          <rect
            x={(center[0] - 1.2) * cell}
            y={(center[1] - 1.2) * cell}
            width={cell * 2.4}
            height={cell * 2.4}
            rx={3}
            fill="hsl(var(--primary))"
            fillOpacity="0.12"
            stroke="hsl(var(--primary))"
            strokeDasharray="2 2"
          />
        )}

        {/* Cover markers on a few boundary cells. */}
        {room.cover && room.cover !== "Open" &&
          [0, Math.floor(cells.length / 3), Math.floor((cells.length * 2) / 3), cells.length - 1].map(
            (i, j) => {
              const [cx, cy] = at(i);
              return (
                <rect
                  key={`c${j}`}
                  x={cx * cell + 2}
                  y={cy * cell + 2}
                  width={cell * 0.55}
                  height={cell * 0.55}
                  fill="hsl(var(--muted-foreground))"
                  fillOpacity="0.5"
                />
              );
            }
          )}

        {room.bonfire && (
          <g>
            <circle
              cx={(center[0] + 0.5) * cell}
              cy={(center[1] + 0.5) * cell}
              r={cell * 0.7}
              fill="hsl(24 95% 55%)"
              fillOpacity="0.2"
              stroke="hsl(24 95% 55%)"
            />
            {label((center[0] + 0.5) * cell, (center[1] + 0.7) * cell, "♨", "hsl(24 95% 45%)", 11)}
            {label((center[0] + 0.5) * cell, (center[1] - 0.8) * cell, "SAFE", "hsl(var(--foreground))", 5)}
          </g>
        )}

        {traps.map((t, i) => {
          const [cx, cy] = at(1 + i * 5);
          const centerX = (cx + 0.5) * cell;
          const centerY = (cy + 0.5) * cell;
          return (
            <g key={`t${i}`}>
              <polygon
                points={`${centerX},${centerY - 5} ${centerX + 5},${centerY + 4} ${centerX - 5},${centerY + 4}`}
                fill="hsl(var(--destructive))"
                fillOpacity="0.8"
              />
              {label(centerX, centerY + 2, "T", "hsl(var(--background))", 5)}
            </g>
          );
        })}

        {spawnPoints.length
          ? spawnPoints.map((point, i) => {
              const cx = point.x + ox;
              const cy = point.y + oy;
              return (
                <g key={`sp${i}`}>
                  <circle
                    cx={(cx + 0.5) * cell}
                    cy={(cy + 0.5) * cell}
                    r={cell * 0.32}
                    fill="hsl(var(--destructive))"
                    fillOpacity="0.8"
                  />
                  {label(
                    (cx + 0.5) * cell,
                    (cy + 0.5) * cell + 2,
                    String(i + 1),
                    "hsl(var(--background))",
                    5
                  )}
                </g>
              );
            })
          : spawns.map((s, i) => {
              const [cx, cy] = at(3 + i * 7);
              return (
                <g key={`s${i}`}>
                  <circle
                    cx={(cx + 0.5) * cell}
                    cy={(cy + 0.5) * cell}
                    r={cell * 0.3}
                    fill="hsl(var(--primary))"
                    fillOpacity="0.75"
                  />
                  {label((cx + 0.5) * cell, (cy + 0.5) * cell + 2, String(i + 1), "hsl(var(--primary-foreground))", 5)}
                </g>
              );
            })}

        {ingressPoints.map((point, i) => {
          const cx = point.x + ox;
          const cy = point.y + oy;
          return (
            <g key={`in${i}`}>
              <circle
                cx={(cx + 0.5) * cell}
                cy={(cy + 0.5) * cell}
                r={cell * 0.34}
                fill="hsl(152 65% 42%)"
                fillOpacity="0.85"
                stroke="hsl(var(--background))"
                strokeWidth="0.8"
              />
              {label(
                (cx + 0.5) * cell,
                (cy + 0.5) * cell + 2,
                "IN",
                "hsl(var(--background))",
                4
              )}
            </g>
          );
        })}

        {loot.length > 0 && (
          <g>
            <rect
              x={(center[0] + 0.15) * cell}
              y={(center[1] + 0.15) * cell}
              width={cell * 0.7}
              height={cell * 0.7}
              transform={`rotate(45 ${(center[0] + 0.5) * cell} ${(center[1] + 0.5) * cell})`}
              fill="hsl(45 95% 55%)"
              fillOpacity="0.85"
            />
            {label((center[0] + 0.5) * cell, (center[1] + 0.7) * cell, "L", "hsl(var(--foreground))", 5)}
          </g>
        )}

        {harvest.length > 0 && (() => {
          const [hx, hy] = at(5);
          const cx = (hx + 0.5) * cell;
          const cy = (hy + 0.5) * cell;
          return (
            <g>
              <rect
                x={cx - cell * 0.35}
                y={cy - cell * 0.35}
                width={cell * 0.7}
                height={cell * 0.7}
                transform={`rotate(45 ${cx} ${cy})`}
                fill="hsl(188 85% 45%)"
                fillOpacity="0.85"
              />
              {label(cx, cy + 2, "H", "hsl(var(--background))", 5)}
            </g>
          );
        })()}
      </svg>
      <div className="flex flex-wrap gap-2 text-[9px] text-muted-foreground">
        <span>▲ trap</span>
        <span>● monster spawn</span>
        <span>● player ingress</span>
        <span>◆ loot</span>
        <span>◆ harvest</span>
        <span>▭ cover</span>
        <span>◌ elevation</span>
        {room.bonfire && <span>♨ bonfire / short rest</span>}
      </div>
    </div>
  );
}
