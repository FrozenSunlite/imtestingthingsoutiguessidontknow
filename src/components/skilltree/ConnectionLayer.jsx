import { memo, useMemo } from "react";
import {
  connectionPath,
  connectionPoints,
  pathThroughPoints,
  isAvailable,
} from "@/lib/geometry";

export const ConnectionLayer = memo(function ConnectionLayer({
  connections,
  nodesById,
  visibleIds,
  style,
  showArrows,
  connector,
  altActive,
  selectedId,
  hidden,
  onConnPointerDown,
  onConnSelect,
  onConnContextMenu,
}) {
  const visible = useMemo(() => {
    const set = new Set(visibleIds);
    return connections.filter(
      (c) =>
        (set.has(c.from) || set.has(c.to)) &&
        !(hidden && (hidden.has(c.from) || hidden.has(c.to)))
    );
  }, [connections, visibleIds, hidden]);

  const color = connector?.color || "#94a3b8";
  const thickness = connector?.thickness ?? 2;
  const opacity = connector?.opacity ?? 0.6;
  const dotted = connector?.dash === "dotted";
  const dash = dotted ? "0.1 10" : undefined;
  const linecap = dotted ? "round" : undefined;

  return (
    <svg style={{ overflow: "visible", pointerEvents: "none" }} width="1" height="1">
      <defs>
        <marker
          id="arrow-conn"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L9,3 L0,6 Z" fill={color} />
        </marker>
      </defs>
      {visible.map((c) => {
        const from = nodesById[c.from];
        const to = nodesById[c.to];
        if (!from || !to) return null;
        const unlocked = (to.currentPoints || 0) > 0;
        const avail = isAvailable(to, nodesById);
        const dim = unlocked ? 1 : avail ? 0.75 : 0.45;
        const pts = connectionPoints(c, from, to);
        const d =
          (c.bends || []).length > 0
            ? pathThroughPoints(pts, style)
            : connectionPath(from.x, from.y, to.x, to.y, style);
        const selected = selectedId === c.id;
        // Per-connector style overrides the global settings when ownStyle is on.
        const own = !!c.ownStyle;
        const o = c.styleOverride || {};
        const cColor = own ? o.color || color : color;
        const cThick = own ? o.thickness ?? thickness : thickness;
        const cOpacity = own ? o.opacity ?? opacity : opacity;
        const cLine = own ? o.dash || "solid" : connector?.dash || "solid";
        const cDash = cLine === "dotted" ? "0.1 10" : cLine === "dashed" ? "12 8" : undefined;
        const cCap = cDash ? "round" : undefined;
        return (
          <g key={c.id}>
            {selected && (
              <path
                d={d}
                stroke="hsl(var(--primary))"
                strokeWidth={thickness + 6}
                fill="none"
                opacity={0.35}
                strokeDasharray={dash}
                strokeLinecap={linecap}
              />
            )}
            <path
              d={d}
              stroke={cColor}
              strokeWidth={unlocked ? cThick + 1 : cThick}
              strokeDasharray={cDash}
              strokeLinecap={cCap}
              fill="none"
              opacity={cOpacity * dim}
              markerEnd={showArrows ? "url(#arrow-conn)" : undefined}
            />
            <path
              d={d}
              stroke="transparent"
              strokeWidth={Math.max(16, cThick * 4)}
              fill="none"
              style={{
                pointerEvents: altActive || onConnSelect ? "stroke" : "none",
                cursor: "grab",
              }}
              onPointerDown={(e) => {
                if (e.altKey) onConnPointerDown?.(e, c);
                else onConnSelect?.(e, c);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onConnContextMenu?.(e, c);
              }}
            />
            {selected &&
              pts.slice(1, -1).map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={6}
                  fill="hsl(var(--primary))"
                  stroke="white"
                  strokeWidth={2}
                  style={{ pointerEvents: "none" }}
                />
              ))}
          </g>
        );
      })}
    </svg>
  );
});