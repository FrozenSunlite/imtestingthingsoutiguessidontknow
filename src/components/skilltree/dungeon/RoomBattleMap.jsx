import {
  cellsFillPath,
  cellsOutlinePath,
  roomFeaturePoints,
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
  const cell = Math.max(8, Math.min(18, Math.floor(360 / Math.max(cols, rows))));
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
  const pointList = (arr, keys = ["x", "y"]) =>
    (arr || [])
      .map((p) => (Array.isArray(p) ? { x: p[0], y: p[1], value: p[2] } : p))
      .filter(
        (p) =>
          Number.isFinite(Number(p?.[keys[0]])) && Number.isFinite(Number(p?.[keys[1]]))
      );
  const heights = pointList(room.heights);
  const stairs = pointList(room.stairs);
  const features = roomFeaturePoints(room);
  const coverPoints = pointList(room.coverPoints);
  const trapPoints = pointList(room.trapPoints);
  const water = new Set(
    pointList(room.water).map((p) => `${Number(p.x) + ox},${Number(p.y) + oy}`)
  );
  const difficult = new Set(
    pointList(room.difficult).map((p) => `${Number(p.x) + ox},${Number(p.y) + oy}`)
  );
  const coverMarks = new Map(
    coverPoints.map((p) => [
      `${Number(p.x) + ox},${Number(p.y) + oy}`,
      String(p.cover || "half"),
    ])
  );
  const trapMarks = new Map(
    trapPoints.map((p) => [
      `${Number(p.x) + ox},${Number(p.y) + oy}`,
      String(p.type || "Trap"),
    ])
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

        {/* Water and difficult terrain cover the floor under the markers. */}
        {cells.map(([cx, cy], i) => {
          const key = `${cx},${cy}`;
          const isWater = water.has(key);
          const isDifficult = difficult.has(key);
          if (!isWater && !isDifficult) return null;
          return (
            <rect
              key={`surf${i}`}
              x={cx * cell}
              y={cy * cell}
              width={cell}
              height={cell}
              fill={isWater ? "hsl(199 89% 48%)" : "hsl(38 74% 45%)"}
              fillOpacity={isWater ? 0.28 : 0.22}
              stroke={isWater ? "hsl(199 89% 40%)" : "hsl(32 80% 38%)"}
              strokeDasharray={isWater ? undefined : "1.5 1.5"}
              strokeOpacity="0.55"
              strokeWidth="0.6"
            />
          );
        })}

        {/* Height tiles: the number is the elevation change in spaces. */}
        {heights.map((p, i) => {
          const cx = Number(p.x) + ox;
          const cy = Number(p.y) + oy;
          const height = Number(p.height ?? p.h ?? p.value ?? 0);
          if (!height) return null;
          return (
            <g key={`h${i}`}>
              <rect
                x={cx * cell}
                y={cy * cell}
                width={cell}
                height={cell}
                fill="hsl(var(--primary))"
                fillOpacity={0.13 + Math.min(0.28, Math.abs(height) * 0.06)}
                stroke="hsl(var(--primary))"
                strokeDasharray="2 2"
                strokeWidth="0.6"
              />
              {label(
                (cx + 0.5) * cell,
                (cy + 0.62) * cell,
                `${height > 0 ? "+" : ""}${height}`,
                "hsl(var(--primary))",
                Math.max(4, Math.min(7, cell * 0.4))
              )}
            </g>
          );
        })}

        {/* Stairs sit on elevation edges; a manual stair always wins. */}
        {(stairs.length
          ? stairs.map((p, i) => [Number(p.x) + ox, Number(p.y) + oy])
          : []
        ).map(([cx, cy], i) => (
          <g key={`st${i}`}>
            <rect
              x={cx * cell + cell * 0.18}
              y={cy * cell + cell * 0.18}
              width={cell * 0.64}
              height={cell * 0.64}
              rx={1}
              fill="hsl(var(--background))"
              stroke="hsl(var(--foreground))"
              strokeWidth="0.7"
            />
            {label(
              (cx + 0.5) * cell,
              (cy + 0.68) * cell,
              "↕",
              "hsl(var(--foreground))",
              Math.max(5, Math.min(8, cell * 0.45))
            )}
          </g>
        ))}

        {/* Cover markers: ½, ¾ or F (full cover). */}
        {(coverMarks.size
          ? [...coverMarks]
          : room.cover && room.cover !== "Open"
            ? [0, Math.floor(cells.length / 3), Math.floor((cells.length * 2) / 3), cells.length - 1].map(
                (i) => {
                  const [cx, cy] = at(i);
                  return [`${cx},${cy}`, String(room.cover)];
                }
              )
            : []
        ).map(([key, cover], i) => {
          const [cx, cy] = key.split(",").map(Number);
          const text = /full/i.test(cover)
            ? "F"
            : /three|3\/4|3_4/i.test(cover)
              ? "¾"
              : "½";
          return (
            <g key={`c${i}`}>
              <rect
                x={cx * cell + 2}
                y={cy * cell + 2}
                width={cell * 0.55}
                height={cell * 0.55}
                fill="hsl(var(--muted-foreground))"
                fillOpacity="0.5"
              />
              {label(
                cx * cell + 2 + cell * 0.275,
                cy * cell + 2 + cell * 0.42,
                text,
                "hsl(var(--background))",
                Math.max(4, Math.min(6, cell * 0.35))
              )}
            </g>
          );
        })}

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

        {features.map((feature, i) => {
          const cx = Number(feature.x) + ox;
          const cy = Number(feature.y) + oy;
          if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
          const centerX = (cx + 0.5) * cell;
          const centerY = (cy + 0.5) * cell;
          if (feature.type === "pillar") {
            return (
              <g key={`f${i}`}>
                <circle cx={centerX} cy={centerY} r={cell * 0.32} fill="hsl(var(--foreground))" fillOpacity="0.55" />
                <circle cx={centerX} cy={centerY} r={cell * 0.22} fill="hsl(var(--background))" fillOpacity="0.35" />
              </g>
            );
          }
          if (feature.type === "dais") {
            return (
              <g key={`f${i}`}>
                <rect
                  x={centerX - cell * 0.9}
                  y={centerY - cell * 0.9}
                  width={cell * 1.8}
                  height={cell * 1.8}
                  rx={cell * 0.2}
                  fill="hsl(var(--primary))"
                  fillOpacity="0.12"
                  stroke="hsl(var(--primary))"
                  strokeDasharray="2 2"
                />
                <rect
                  x={centerX - cell * 0.55}
                  y={centerY - cell * 0.55}
                  width={cell * 1.1}
                  height={cell * 1.1}
                  rx={cell * 0.15}
                  fill="hsl(var(--primary))"
                  fillOpacity="0.18"
                />
              </g>
            );
          }
          if (feature.type === "pit") {
            return (
              <g key={`f${i}`}>
                <ellipse
                  cx={centerX}
                  cy={centerY}
                  rx={cell * 0.85}
                  ry={cell * 0.65}
                  fill="hsl(var(--foreground))"
                  fillOpacity="0.28"
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="2 2"
                />
                <ellipse cx={centerX} cy={centerY} rx={cell * 0.45} ry={cell * 0.3} fill="black" fillOpacity="0.35" />
              </g>
            );
          }
          if (feature.type === "brazier") {
            return (
              <g key={`f${i}`}>
                <circle cx={centerX} cy={centerY} r={cell * 0.42} fill="hsl(24 95% 55%)" fillOpacity="0.18" />
                <circle cx={centerX} cy={centerY} r={cell * 0.2} fill="hsl(24 95% 55%)" fillOpacity="0.8" />
              </g>
            );
          }
          if (feature.type === "crystal") {
            return (
              <polygon
                key={`f${i}`}
                points={`${centerX},${centerY - cell * 0.38} ${centerX + cell * 0.3},${centerY} ${centerX},${centerY + cell * 0.38} ${centerX - cell * 0.3},${centerY}`}
                fill="hsl(188 85% 45%)"
                fillOpacity="0.75"
                stroke="hsl(188 85% 30%)"
              />
            );
          }
          return (
            <polygon
              key={`f${i}`}
              points={`${centerX},${centerY - cell * 0.22} ${centerX + cell * 0.26},${centerY + cell * 0.18} ${centerX - cell * 0.26},${centerY + cell * 0.18}`}
              fill="hsl(var(--muted-foreground))"
              fillOpacity="0.45"
            />
          );
        })}

        {(trapMarks.size
          ? [...trapMarks]
          : traps.map((t, i) => {
              const [cx, cy] = at(1 + i * 5);
              return [`${cx},${cy}`, t];
            })
        ).map(([key, type], i) => {
          const [cx, cy] = key.split(",").map(Number);
          const centerX = (cx + 0.5) * cell;
          const centerY = (cy + 0.5) * cell;
          return (
            <g key={`t${i}`}>
              <title>{String(type)}</title>
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
        <span>▭ cover (½ / ¾ / F)</span>
        <span>↕ stairs</span>
        <span className="text-sky-600 dark:text-sky-400">■ water</span>
        <span className="text-amber-700 dark:text-amber-500">▨ difficult terrain</span>
        <span>+1 / −1 elevation</span>
        <span>● pillar</span>
        <span>▭ dais</span>
        <span>◯ pit</span>
        <span>● brazier</span>
        <span>◆ crystal</span>
        {room.bonfire && <span>♨ bonfire / short rest</span>}
      </div>
    </div>
  );
}
