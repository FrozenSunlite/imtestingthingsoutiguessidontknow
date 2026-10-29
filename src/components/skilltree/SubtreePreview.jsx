import { useMemo, useState } from "react";
import { NodeHoverCard } from "@/components/skilltree/NodeHoverCard";

const clamp = (x, y) => {
  if (typeof window === "undefined") return { x, y };
  return {
    x: Math.max(8, Math.min(x, window.innerWidth - 280)),
    y: Math.max(8, Math.min(y, window.innerHeight - 280)),
  };
};

// Static SVG snapshot of a node's subtree: circles for nodes (green when
// invested), thin lines for connectors, names underneath. In the Edit Node
// page it is interactive: hovering a subnode shows the same card as the canvas.
// Inside the Alt hover preview it stays presentational so it costs almost
// nothing compared to mounting a live tree panel.
export function SubtreePreview({ subtree, width = 232, interactive = false }) {
  const [hover, setHover] = useState(null);
  const { marks, lines, byId, w, h } = useMemo(() => {
    const ns = subtree?.nodes || [];
    const byId = Object.fromEntries(ns.map((n) => [n.id, n]));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of ns) {
      minX = Math.min(minX, n.x - 40);
      minY = Math.min(minY, n.y - 40);
      maxX = Math.max(maxX, n.x + 40);
      maxY = Math.max(maxY, n.y + 40);
    }
    if (!ns.length) return { marks: [], lines: [], byId, w: width, h: 60 };
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
      node: n,
    }));
    return { marks, lines, byId, w, h };
  }, [subtree, width]);

  if (!marks.length)
    return <p className="p-1 text-[10px] text-muted-foreground">Empty subtree.</p>;

  const scale = Math.min(1, width / w);
  const vh = Math.max(40, Math.round(h * scale));

  const showHover = (event, node) => {
    if (!interactive) return;
    const pos = clamp(event.clientX + 14, event.clientY + 14);
    setHover({ node, nodesById: byId, ...pos });
  };

  return (
    <>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width={width}
        height={vh}
        className="rounded bg-background"
        shapeRendering="geometricPrecision"
        textRendering="geometricPrecision"
        aria-label="Subtree preview"
        onMouseLeave={() => interactive && setHover(null)}
      >
        {lines.map((l, i) => (
          <line key={i} {...l} stroke="hsl(var(--border))" strokeWidth={2} />
        ))}
        {marks.map((m, i) => (
          <g
            key={i}
            onMouseEnter={(event) => showHover(event, m.node)}
            onMouseMove={(event) => showHover(event, m.node)}
            onMouseLeave={() => interactive && setHover(null)}
            style={interactive ? { cursor: "help" } : undefined}
          >
            <circle
              cx={m.x}
              cy={m.y}
              r={18}
              fill={m.on ? "rgba(16,185,129,0.35)" : "hsl(var(--card))"}
              stroke={m.on ? "rgb(16,185,129)" : "hsl(var(--border))"}
              strokeWidth={2}
            />
            {/* Larger invisible target so tiny previews are still hoverable. */}
            {interactive && (
              <circle cx={m.x} cy={m.y} r={28} fill="transparent" pointerEvents="all" />
            )}
            <text
              x={m.x}
              y={m.y + 32}
              textAnchor="middle"
              fontSize={11}
              fill="hsl(var(--foreground))"
              pointerEvents="none"
            >
              {m.label.length > 14 ? m.label.slice(0, 13) + "…" : m.label}
            </text>
          </g>
        ))}
      </svg>
      {interactive && hover && (
        <div
          className="pointer-events-none fixed z-[60]"
          style={{ left: hover.x, top: hover.y }}
        >
          <NodeHoverCard node={hover.node} nodesById={hover.nodesById} />
        </div>
      )}
    </>
  );
}
