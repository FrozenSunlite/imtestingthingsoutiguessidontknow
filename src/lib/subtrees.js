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
  // The first node of a freshly created subtree is granted for free when the
  // host talent is first purchased (see autoGrantFirstNode).
  autoGrantFirst: true,
};

// The first playable node of a subtree: the first root (a node with no
// dependency inside the subtree). The starter host copy is skipped.
export function firstSubtreeNode(subtree) {
  const nodes = (subtree?.nodes || []).filter((n) => !n.__hostCopy);
  if (!nodes.length) return null;
  const ids = new Set(nodes.map((n) => n.id));
  return nodes.find((n) => !(n.dependencies || []).some((d) => ids.has(d))) || nodes[0];
}

// Grant the first node without charging any point pool. The node is flagged
// `__autoGranted` so the subtree panel excludes it from its spend count and
// the sheet can show it once (host copies are never listed).
export function autoGrantFirstNode(subtree) {
  if (!subtree || subtree.autoGrantFirst === false) return subtree;
  const first = firstSubtreeNode(subtree);
  if (!first || Number(first.currentPoints) > 0) return subtree;
  return {
    ...subtree,
    nodes: (subtree.nodes || []).map((n) =>
      n.id === first.id
        ? {
            ...n,
            currentPoints: 1,
            __autoGranted: true,
            acquiredOrder: n.acquiredOrder || Date.now(),
          }
        : n
    ),
  };
}

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

// Flatten ONE host subtree (nested levels excluded) into a playable node list
// with prefixed, collision-safe ids:
//   sub-<hostId>-<subtreeIndex>-<nodeId>
// Every node keeps `__path` (its id within this subtree, for writing
// investments back) and `__originalId` (used to open its own nested subtree in
// another tab). Host copies are skipped unless `keepHostCopies` is set (dev
// mode); the original host node already appears on the main tree.
export function flattenSubtreeForPlay(host, subIndex = 0, keepHostCopies = false) {
  const subtree =
    (host?.subtrees || [])[subIndex] ?? (host?.subtrees || [])[0] ?? {};
  const subLabel = subtree.poolName || subtree.name || host?.name || "Subtree";
  const base = ["sub", host.id, subIndex].join("-");
  const idMap = {};
  (subtree.nodes || []).forEach((n) => {
    idMap[n.id] = !n.__hostCopy || keepHostCopies ? `${base}-${n.id}` : null;
  });
  const nodes = [];
  (subtree.nodes || []).forEach((n) => {
    if (n.__hostCopy && !keepHostCopies) return;
    const fid = idMap[n.id];
    if (!fid) return;
    nodes.push({
      ...n,
      id: fid,
      poolOverride: "__subtree",
      dependencies: (n.dependencies || []).map((d) => idMap[d]).filter(Boolean),
      __originalId: n.id,
      __path: [n.id],
      __subtreeLabel: subLabel,
    });
  });
  const connections = (subtree.connections || [])
    .filter((c) => idMap[c.from] && idMap[c.to])
    .map((c) => ({
      ...c,
      id: `${idMap[c.from]}->${idMap[c.to]}`,
      from: idMap[c.from],
      to: idMap[c.to],
    }));
  return { nodes, connections };
}