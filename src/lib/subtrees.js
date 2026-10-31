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
  maxPurchases: 0,
  purchases: 0,
};

// Older projects granted every subtree's first node for free when its host was
// purchased. That mechanism is gone: clear the one free point (keeping any
// points the player added afterwards) and drop the legacy flag/field.
export function stripLegacyAutoGrants(tree) {
  if (!tree?.nodes) return tree;
  let changed = false;

  const stripSubtree = (st) => {
    if (!st) return st;
    let subChanged = false;
    const nodes = (st.nodes || []).map((n) => {
      let next = n;
      if (n.__autoGranted) {
        const { __autoGranted, ...rest } = n;
        next = {
          ...rest,
          currentPoints: Math.max(0, (Number(n.currentPoints) || 0) - 1),
        };
        subChanged = true;
      }
      const nested = Array.isArray(next.subtrees)
        ? next.subtrees
        : next.subtree
          ? [next.subtree]
          : [];
      if (nested.length) {
        const mapped = nested.map(stripSubtree);
        if (mapped.some((s, i) => s !== nested[i])) {
          next = Array.isArray(next.subtrees)
            ? { ...next, subtrees: mapped }
            : { ...next, subtrees: mapped, subtree: undefined };
          subChanged = true;
        }
      }
      return next;
    });
    const hadFlag = Object.prototype.hasOwnProperty.call(st, "autoGrantFirst");
    const purchasesRaw = Number(st.purchases);
    const invested = (st.nodes || []).some((n) => (Number(n.currentPoints) || 0) > 0);
    const purchases =
      Number.isFinite(purchasesRaw) && purchasesRaw > 0 ? purchasesRaw : invested ? 1 : 0;
    const maxPurchases = Math.max(0, Number(st.maxPurchases) || 0);
    const needsDefaults = !Number.isFinite(purchasesRaw) || st.maxPurchases == null;
    if (!subChanged && !hadFlag && !needsDefaults) return st;
    const { autoGrantFirst: _autoGrantFirst, ...rest } = st;
    return { ...rest, maxPurchases, purchases, nodes };
  };

  const nodes = tree.nodes.map((n) => {
    if (!Array.isArray(n.subtrees) || !n.subtrees.length) return n;
    const next = n.subtrees.map(stripSubtree);
    if (next.some((s, i) => s !== n.subtrees[i])) {
      changed = true;
      return { ...n, subtrees: next };
    }
    return n;
  });
  return changed ? { ...tree, nodes } : tree;
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