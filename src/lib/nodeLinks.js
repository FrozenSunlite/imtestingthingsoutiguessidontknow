// [[...]] links inside node descriptions:
//   [[Node Name]]               → jumps to that node
//   [[Node Name / Subtree]]     → opens that node's subtree by name
//   [[Subtree Name]]            → opens the first subtree with that name
// Link targets resolve case-insensitively; unknown names stay plain text.

// Split description text into text and link segments.
export function linkParts(text) {
  const parts = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let last = 0, m;
  const s = String(text || "");
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push({ kind: "text", text: s.slice(last, m.index) });
    parts.push({ kind: "link", text: m[1] });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ kind: "text", text: s.slice(last) });
  return parts;
}

// Resolve one link's target against the tree's nodes. Returns
// { kind: "node", node } | { kind: "subtree", host, index } | null.
export function resolveLinkTarget(name, nodes = []) {
  const clean = (v) => String(v || "").trim().toLowerCase();
  const raw = String(name || "").trim();
  if (!raw || !nodes.length) return null;
  // Whole string as a node name wins.
  const node = nodes.find((n) => clean(n.name) === clean(raw));
  if (node) return { kind: "node", node };
  // "Node / Subtree" — match the host node, then its subtree.
  const parts = raw.split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const host = nodes.find((n) => clean(n.name) === clean(parts[0]));
    if (host?.subtrees?.length) {
      const idx = host.subtrees.findIndex((st) => clean(st.name) === clean(parts[parts.length - 1]));
      if (idx >= 0) return { kind: "subtree", host, index: idx };
      return { kind: "subtree", host, index: 0 };
    }
  }
  // A bare subtree name anywhere in the tree.
  for (const n of nodes) {
    const idx = (n.subtrees || []).findIndex((st) => clean(st.name) === clean(raw));
    if (idx >= 0) return { kind: "subtree", host: n, index: idx };
  }
  return null;
}