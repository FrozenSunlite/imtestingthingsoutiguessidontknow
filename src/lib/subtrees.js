// Node subtree helpers.
//
// A node's `subtrees` is a list of its own skill trees — separate spaces of
// normal nodes the player invests in with tree-specific points:
//   { id, name, nodes: [...], connections: [...], grantedPoints: 3, poolName: "", exclusive: false }
// Subtree nodes are ordinary node objects and may carry subtrees of their own
// (branches of branches). Every subtree is seeded with a copy of its host node
// (marked `__hostCopy`): nodes added to the subtree are connected to that copy,
// and copies never appear on the View screen — only the original node does.

export const DEFAULT_SUBTREE = {
  id: "",
  name: "Subtree 1",
  nodes: [],
  connections: [],
  grantedPoints: 3,
  poolName: "",
  exclusive: false,
};

let subSeq = 0;
export function nextSubtreeId() {
  subSeq += 1;
  return "st" + Date.now().toString(36) + "-" + subSeq;
}

// The starting copy of the host node placed inside a new subtree.
export function makeHostCopy(node) {
  const copy = JSON.parse(JSON.stringify(node || {}));
  const id = "n" + Date.now().toString(36) + "h" + Math.floor(Math.random() * 1e4);
  return {
    ...copy,
    id,
    x: 0,
    y: 0,
    currentPoints: 0,
    dependencies: [],
    exclusiveWith: [],
    __hostCopy: true,
  };
}

// True when targetId is this node itself or lives anywhere inside its subtree
// chain — dropping it there would nest a tree inside its own branch.
export function subtreeChainHasNode(node, targetId) {
  if (!node || !targetId) return false;
  if (node.id === targetId) return true;
  for (const st of node.subtrees || []) {
    if ((st.nodes || []).some((n) => subtreeChainHasNode(n, targetId))) return true;
  }
  return false;
}

// Immutably set a subtree node's invested points. `path` is the chain of
// original node ids from the host down (e.g. [branchId, nestedId]).
export function setSubtreePoint(nodes, path, points) {
  if (!path.length) return nodes;
  const [id, ...rest] = path;
  let changed = false;
  const out = (nodes || []).map((n) => {
    if (n.id !== id) return n;
    changed = true;
    if (!rest.length) return { ...n, currentPoints: Math.max(0, Number(points) || 0) };
    const st = n.subtrees ? {} : n.subtree || {};
    const inner = n.subtrees
      ? (n.subtrees || []).map((s) => ({ ...s, nodes: setSubtreePoint(s.nodes || [], rest, points) }))
      : setSubtreePoint(st.nodes || [], rest, points);
    return n.subtrees
      ? { ...n, subtrees: inner }
      : { ...n, subtree: { ...st, nodes: inner } };
  });
  return changed ? out : nodes;
}

// Flatten a host's subtree (nested levels included) into a single playable
// node list with prefixed, collision-safe ids:
//   sub-<hostId>-<subtreeIndex>-<level1Id>-<level2Id>…
// Every node keeps `__path` (its chain of original ids, for writing investments
// back), draws from the subtree pool (`poolOverride: "__subtree"`), and gains a
// dependency on its parent subtree node so deeper branches gate on the branch
// above them. Host copies are skipped — the original node already exists on
// the View screen, so copies never reflect there.
export function flattenSubtreeForPlay(host, subIndex = 0, keepHostCopies = false) {
  const subtree =
    (host?.subtrees || [])[subIndex] ?? (host?.subtrees || [])[0] ?? {};
  const nodes = [];
  const connections = [];
  // Label the character sheet groups these nodes by (pool name, then the
  // subtree's own name, then the host node's).
  const subLabel = subtree.poolName || subtree.name || host?.name || "Subtree";
  const walk = (sub, parentFlatId, path) => {
    const base = ["sub", host.id, subIndex, ...path].join("-");
    const idMap = {};
    (sub.nodes || []).forEach((n) => {
      idMap[n.id] = !n.__hostCopy || keepHostCopies ? `${base}-${n.id}` : null;
    });
    (sub.nodes || []).forEach((n) => {
      if (n.__hostCopy && !keepHostCopies) return;
      const fid = idMap[n.id];
      const p = [...path, n.id];
      nodes.push({
        ...n,
        id: fid,
        poolOverride: "__subtree",
        dependencies: [
          ...(n.dependencies || []).map((d) => idMap[d]).filter(Boolean),
          ...(parentFlatId ? [parentFlatId] : []),
        ],
        __path: p,
        __subtreeLabel: subLabel,
      });
      walk(n.subtrees ? { nodes: (n.subtrees || []).flatMap((s) => s.nodes || []) } : n.subtree || {}, fid, p);
    });
    (sub.connections || []).forEach((c) => {
      if (!idMap[c.from] || !idMap[c.to]) return;
      connections.push({
        ...c,
        id: `${idMap[c.from]}->${idMap[c.to]}`,
        from: idMap[c.from],
        to: idMap[c.to],
      });
    });
  };
  walk(subtree, null, []);
  return { nodes, connections };
}