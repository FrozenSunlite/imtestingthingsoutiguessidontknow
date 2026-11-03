// Shared math for the bulk Appearance -> Node Size scaler. Keeping it pure
// makes the "200 px reduced by 20% becomes 160 px" rule easy to test.
export const MIN_NODE_SIZE = 10;
export const MAX_NODE_SIZE = 2000;

// Returns the new pixel size, or null when the percentage is invalid.
export function scaledNodeSize(size, percent) {
  const base = Number(size);
  const pct = Number(percent);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(pct)) return null;
  const factor = 1 + pct / 100;
  if (factor <= 0) return null;
  return Math.max(
    MIN_NODE_SIZE,
    Math.min(MAX_NODE_SIZE, Math.round(base * factor))
  );
}

// Recursively scale a node list and its nested subtrees. Returns a new list so
// the tree stays immutable for React rendering and undo/redo.
export function scaleNodeList(nodes, percent) {
  return (nodes || []).map((node) => {
    const size = scaledNodeSize(node.size || 100, percent);
    const subtrees = Array.isArray(node.subtrees)
      ? node.subtrees.map((subtree) =>
          subtree?.nodes
            ? { ...subtree, nodes: scaleNodeList(subtree.nodes, percent) }
            : subtree
        )
      : node.subtrees;
    const next = { ...node };
    if (size != null) next.size = size;
    if (subtrees !== undefined) next.subtrees = subtrees;
    return next;
  });
}
