import { useMemo } from "react";

// Static SVG snapshot of a node's subtree: circles for nodes (green when
// invested), thin lines for connectors, names underneath. Purely
// presentational — no interactivity — so an Alt-hover preview costs almost
// nothing compared to mounting a live tree panel.
export function SubtreePreview({ subtree, width = 232 }) {
  const { marks, lines, w, h } = useMemo(() => {
    const ns = subtree?.nodes || [];
    const byId = Object.fromEntries(ns.map((n) => [n.id, n]));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of ns) {
      minX = Math.min(minX, n.x - 40);
      minY = Math.min(minY, n.y - 40);
      maxX = Math.max(maxX, n.x + 40);
      maxY = Math.max(maxY, n.y + 40);
    }
    if (!ns.length) return { marks: [], lines: [], w: width, h: 60 };
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const lines = (subtree?.connections || [])
      .filter((c) => byId[c.from] && byId[c.to])
      .map((c) => ({
        x1: byId[c.from].x - minX,
        y1: byId[c.from].y - minY,
        x2: byId[c.to].x - minX,
        y2: byId[c.to].y - minY,
      }));
    const marks = ns.map((n) => ({
      x: n.x - minX,
      y: n.y - minY,
      on: (n.currentPoints || 0) > 0,
      label: n.name || "?",
    }));
    return { marks, lines, w, h };
  }, [subtree]);

  if (!marks.length)
    return <p className="p-1 text-[10px] text-muted-foreground">Empty subtree.</p>;

  const scale = Math.min(1, width / w);
  const vh = Math.max(40, h * scale);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={width}
      height={vh}
      className="rounded bg-background"
      aria-label="Subtree preview"
    >
      {lines.map((l, i) => (
        <line key={i} {...l} stroke="hsl(var(--border))" strokeWidth={2} />
      ))}
      {marks.map((m, i) => (
        <g key={i}>
          <circle
            cx={m.x}
            cy={m.y}
            r={18}
            fill={m.on ? "rgba(16,185,129,0.35)" : "hsl(var(--card))"}
            stroke={m.on ? "rgb(16,185,129)" : "hsl(var(--border))"}
            strokeWidth={2}
          />
          <text
            x={m.x}
            y={m.y + 32}
            textAnchor="middle"
            fontSize={11}
            fill="hsl(var(--foreground))"
          >
            {m.label.length > 14 ? m.label.slice(0, 13) + "…" : m.label}
          </text>
        </g>
      ))}
    </svg>
  );
}