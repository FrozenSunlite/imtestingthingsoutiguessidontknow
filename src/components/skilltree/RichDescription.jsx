import { linkParts, resolveLinkTarget } from "@/lib/nodeLinks";

// Renders node text with [[...]] links made clickable: a link jumps to the
// named node, or opens the named subtree. Unknown targets stay plain text.
export function RichDescription({ text, nodes = [], onJumpNode, onOpenSubtree, className = "" }) {
  const s = String(text || "");
  const parts = linkParts(s);
  if (!parts.some((p) => p.kind === "link")) return <span className={className}>{s}</span>;
  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.kind === "text") return <span key={i}>{p.text}</span>;
        const t = resolveLinkTarget(p.text, nodes);
        if (!t) return <span key={i}>{p.text}</span>;
        const label =
          t.kind === "node"
            ? `Jump to “${t.node?.name || "?"}”`
            : `Open “${t.host?.name || "?"} / ${t.host?.subtrees?.[t.index]?.name || "subtree"}”`;
        return (
          <button
            key={i}
            title={label}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (t.kind === "node") onJumpNode?.(t.node);
              else onOpenSubtree?.(t.host.id, t.index);
            }}
            className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
          >
            {p.text}
          </button>
        );
      })}
    </span>
  );
}