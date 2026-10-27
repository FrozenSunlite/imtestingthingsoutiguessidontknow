// Schematic 20x20 battle map for a dungeon room. It turns the room's
// environment, elevation, cover, traps, spawns and loot into a quick grid
// reference the DM can draw from at the table.
export function RoomBattleMap({ room }) {
  if (!room) return null;
  const SIZE = 20;
  const pad = 2;
  const w = Math.max(10, Math.min(SIZE - pad * 2, Number(room.w) || 10));
  const h = Math.max(10, Math.min(SIZE - pad * 2, Number(room.h) || 10));
  const x0 = (SIZE - w) / 2;
  const y0 = (SIZE - h) / 2;
  const cell = 10;
  const px = SIZE * cell;
  const label = (x, y, text, fill = "hsl(var(--muted-foreground))") => (
    <text x={x} y={y} fontSize="6" fill={fill} textAnchor="middle">{text}</text>
  );
  const traps = room.traps || [];
  const spawns = room.spawns || [];
  const loot = room.loot || [];
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Battle map · 20 × 20 spaces
        </p>
        <span className="text-[9px] text-muted-foreground">{room.environment || "—"}</span>
      </div>
      <svg viewBox={`0 0 ${px} ${px}`} className="w-full rounded-md border bg-background">
        <defs>
          <pattern id="battle-grid" width={cell} height={cell} patternUnits="userSpaceOnUse">
            <path d={`M ${cell} 0 L 0 0 0 ${cell}`} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width={px} height={px} fill="url(#battle-grid)" />
        <rect
          x={x0 * cell}
          y={y0 * cell}
          width={w * cell}
          height={h * cell}
          fill="hsl(var(--muted))"
          fillOpacity="0.25"
          stroke="hsl(var(--foreground))"
          strokeWidth="1.4"
        />
        {/* Elevation dais */}
        {room.elevation && room.elevation !== "Flat" && (
          <rect
            x={(x0 + w * 0.28) * cell}
            y={(y0 + h * 0.28) * cell}
            width={w * 0.44 * cell}
            height={h * 0.44 * cell}
            rx={3}
            fill="hsl(var(--primary))"
            fillOpacity="0.12"
            stroke="hsl(var(--primary))"
            strokeDasharray="2 2"
          />
        )}
        {/* Cover markers */}
        {room.cover && room.cover !== "Open" &&
          [
            [x0 + 1, y0 + 1],
            [x0 + w - 2, y0 + 1],
            [x0 + 1, y0 + h - 2],
            [x0 + w - 2, y0 + h - 2],
          ].map(([cx, cy], i) => (
            <rect key={`c${i}`} x={cx * cell} y={cy * cell} width={cell * 0.9} height={cell * 0.9} fill="hsl(var(--muted-foreground))" fillOpacity="0.5" />
          ))}
        {traps.map((t, i) => (
          <g key={`t${i}`}>
            <polygon
              points={`${(x0 + w * 0.25 + i * 0.7) * cell},${(y0 + h * 0.7) * cell} ${(x0 + w * 0.25 + i * 0.7 + 0.35) * cell},${(y0 + h * 0.7 + 0.7) * cell} ${(x0 + w * 0.25 + i * 0.7 - 0.35) * cell},${(y0 + h * 0.7 + 0.7) * cell}`}
              fill="hsl(var(--destructive))"
              fillOpacity="0.75"
            />
            {label((x0 + w * 0.25 + i * 0.7) * cell, (y0 + h * 0.7 - 0.2) * cell, "T", "hsl(var(--destructive))")}
          </g>
        ))}
        {spawns.map((s, i) => (
          <g key={`s${i}`}>
            <circle
              cx={(x0 + w * 0.25 + i * 0.7) * cell}
              cy={(y0 + h * 0.32) * cell}
              r={cell * 0.32}
              fill="hsl(var(--primary))"
              fillOpacity="0.7"
            />
            {label((x0 + w * 0.25 + i * 0.7) * cell, (y0 + h * 0.32 - 0.45) * cell, String(i + 1), "hsl(var(--foreground))")}
          </g>
        ))}
        {loot.length > 0 && (
          <g>
            <rect
              x={(x0 + w / 2 - 0.4) * cell}
              y={(y0 + h / 2 - 0.4) * cell}
              width={cell * 0.8}
              height={cell * 0.8}
              transform={`rotate(45 ${(x0 + w / 2) * cell} ${(y0 + h / 2) * cell})`}
              fill="hsl(45 95% 55%)"
              fillOpacity="0.8"
            />
            {label((x0 + w / 2) * cell, (y0 + h / 2 - 0.8) * cell, "L", "hsl(var(--foreground))")}
          </g>
        )}
      </svg>
      <div className="flex flex-wrap gap-2 text-[9px] text-muted-foreground">
        <span>▲ trap</span>
        <span>● spawn</span>
        <span>◆ loot</span>
        <span>▭ cover</span>
        <span>◌ elevation</span>
      </div>
    </div>
  );
}
