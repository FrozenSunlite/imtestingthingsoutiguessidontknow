// Node subtree helpers.
//
// A node's `subtrees` is a list of its own skill trees — separate spaces of
// normal nodes the player invests in with tree-specific points:
//   { id, name, nodes: [...], connections: [...], grantedPoints: 3, poolName: "", exclusive: false }
// Subtree nodes are ordinary node objects and may carry subtrees of their own
// (branches of branches). Every subtree starts with a non-investable return
// node (`__returnNode`): double-clicking it in play goes back to the node the
// player entered the subtree through. Older trees used a copy of the host node
// (`__hostCopy`) for this job; migration converts those in place.

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

export const RETURN_NODE_NAME = "double click to return to the parent node";

// The return node is the first node in every subtree. It is a marker, not an
// investable talent: double-clicking it in play goes back to the node through
// which the player entered the subtree.
export function makeReturnNode() {
  return {
    id: "ret" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    name: RETURN_NODE_NAME,
    description: "",
    x: 0,
    y: 0,
    currentPoints: 0,
    maxPoints: 0,
    cost: 0,
    nodeType: "skill",
    dependencies: [],
    exclusiveWith: [],
    __returnNode: true,
  };
}

// Convert legacy host-copy anchors into return nodes and make sure every
// subtree has one. Connections and dependencies keep the same node id.
export function migrateReturnNodes(tree) {
  if (!tree?.nodes) return tree;
  let changed = false;
  const walkSubtree = (st) => {
    if (!st) return st;
    let subChanged = false;
    let nodes = (st.nodes || []).map((n) => {
      let next = n;
      const nested = Array.isArray(n.subtrees)
        ? n.subtrees
        : n.subtree
          ? [n.subtree]
          : [];
      if (nested.length) {
        const mapped = nested.map(walkSubtree);
        if (mapped.some((s, i) => s !== nested[i])) {
          next = Array.isArray(n.subtrees)
            ? { ...next, subtrees: mapped }
            : { ...next, subtrees: mapped, subtree: undefined };
          subChanged = true;
        }
      }
      if (n.__hostCopy) {
        const { __hostCopy, __autoGranted, ...rest } = next;
        next = {
          ...rest,
          __returnNode: true,
          name: RETURN_NODE_NAME,
          description: "",
          image: "",
          frameImage: "",
          currentPoints: 0,
          maxPoints: 0,
          cost: 0,
          levelGain: 0,
          dependencies: [],
          exclusiveWith: [],
        };
        subChanged = true;
      }
      return next;
    });
    if (!nodes.some((n) => n.__returnNode || n.__hostCopy)) {
      nodes = [makeReturnNode(), ...nodes];
      subChanged = true;
    } else {
      // The return node is always the first node in its subtree.
      const anchorIndex = nodes.findIndex((n) => n.__returnNode || n.__hostCopy);
      if (anchorIndex > 0) {
        const [anchor] = nodes.splice(anchorIndex, 1);
        nodes = [anchor, ...nodes];
        subChanged = true;
      }
    }
    if (!subChanged) return st;
    changed = true;
    return { ...st, nodes };
  };
  const nodes = tree.nodes.map((n) => {
    if (!Array.isArray(n.subtrees) || !n.subtrees.length) return n;
    const next = n.subtrees.map(walkSubtree);
    return next.some((s, i) => s !== n.subtrees[i]) ? { ...n, subtrees: next } : n;
  });
  return changed ? { ...tree, nodes } : tree;
}

// ---- Shared subtree definitions ------------------------------------------
// A shared subtree is stored once in `tree.sharedSubtrees[sharedId]`. Every
// host node keeps an instance whose node ids match the definition, so edits to
// the structure can propagate to every instance. Play state — current points,
// purchases and the per-host exclusivity toggle — stays local to each host.

export const SHARED_STRUCTURAL_KEYS = [
  "name",
  "nodes",
  "connections",
  "grantedPoints",
  "poolName",
  "maxPurchases",
  "abilityReqs",
];

const PLAY_KEYS = ["currentPoints", "acquiredOrder", "__autoGranted"];

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

// The canonical structure of a subtree: no play state, no per-host settings.
export function sharedDefinition(subtree) {
  const copy = subtree || {};
  const stripNodes = (nodes) =>
    (nodes || []).map((n) => {
      const out = cloneJson(n);
      PLAY_KEYS.forEach((key) => delete out[key]);
      if (Array.isArray(out.subtrees)) {
        out.subtrees = out.subtrees.map((st) => ({
          ...st,
          purchases: 0,
          nodes: stripNodes(st.nodes),
        }));
      }
      return out;
    });
  return {
    name: String(copy.name || "Shared subtree"),
    grantedPoints: Math.max(0, Number(copy.grantedPoints) || 0),
    poolName: String(copy.poolName || ""),
    maxPurchases: Math.max(0, Number(copy.maxPurchases) || 0),
    abilityReqs: cloneJson(copy.abilityReqs || []),
    nodes: stripNodes(copy.nodes),
    connections: cloneJson(copy.connections || []),
  };
}

// Clone canonical nodes and copy each host's play state back in by node id.
export function overlayPlayState(sourceNodes, targetNodes = []) {
  const byId = new Map((targetNodes || []).map((n) => [n.id, n]));
  return (sourceNodes || []).map((source) => {
    const target = byId.get(source.id);
    const node = cloneJson(source);
    node.currentPoints = Math.max(0, Number(target?.currentPoints) || 0);
    if (target?.acquiredOrder != null) node.acquiredOrder = target.acquiredOrder;
    else delete node.acquiredOrder;
    if (target?.__autoGranted) node.__autoGranted = true;
    else delete node.__autoGranted;
    if (Array.isArray(node.subtrees)) {
      const targetNested = target?.subtrees || [];
      node.subtrees = node.subtrees.map((st, i) => {
        const tst =
          targetNested.find((candidate) => candidate.id === st.id) ||
          targetNested[i];
        const next = {
          ...st,
          purchases: Math.max(0, Number(tst?.purchases) || 0),
          exclusive: tst ? !!tst.exclusive : !!st.exclusive,
          level: Math.max(0, Number(tst?.level ?? st.level) || 0),
          default: tst ? !!tst.default : !!st.default,
          nodes: overlayPlayState(st.nodes, tst?.nodes),
        };
        if (tst?.sharedId || st.sharedId) next.sharedId = tst?.sharedId || st.sharedId;
        return next;
      });
    }
    return node;
  });
}

// Build a host's instance of a shared definition: fresh instance id, reset
// play state, per-host settings taken from the template.
export function instantiateSharedSubtree(definition, sharedId) {
  const def = sharedDefinition(definition);
  return {
    id: nextSubtreeId(),
    sharedId,
    name: def.name,
    nodes: overlayPlayState(def.nodes, []),
    connections: cloneJson(def.connections),
    grantedPoints: def.grantedPoints,
    poolName: def.poolName,
    maxPurchases: def.maxPurchases,
    abilityReqs: def.abilityReqs,
    purchases: 0,
    exclusive: !!definition.exclusive,
    level: Math.max(0, Number(definition.level) || 0),
    default: !!definition.default,
  };
}

function applySharedDefinition(target, definition, sharedId) {
  return {
    ...target,
    sharedId,
    name: definition.name,
    grantedPoints: definition.grantedPoints,
    poolName: definition.poolName,
    maxPurchases: definition.maxPurchases,
    abilityReqs: cloneJson(definition.abilityReqs),
    nodes: overlayPlayState(definition.nodes, target.nodes),
    connections: cloneJson(definition.connections),
  };
}

// Push one edited instance's structure into the canonical definition and every
// other host instance of the same shared subtree, preserving local play state.
export function syncSharedSubtree(tree, sharedId, source, seen = new Set()) {
  if (!tree || !sharedId || !source || seen.has(sharedId)) return tree;
  seen.add(sharedId);
  const definition = sharedDefinition(source);
  let changed = false;

  const walk = (nodes) => {
    let touched = false;
    const out = (nodes || []).map((node) => {
      if (!Array.isArray(node.subtrees) || !node.subtrees.length) return node;
      let nodeTouched = false;
      const subtrees = node.subtrees.map((st) => {
        let next = st;
        if (st.sharedId === sharedId) {
          next = applySharedDefinition(st, definition, sharedId);
          nodeTouched = true;
        }
        const nested = walk(next.nodes || []);
        if (nested !== next.nodes) {
          next = { ...next, nodes: nested };
          nodeTouched = true;
        }
        return next;
      });
      if (!nodeTouched) return node;
      touched = true;
      return { ...node, subtrees };
    });
    return touched ? out : nodes;
  };

  const nodes = walk(tree.nodes || []);
  if (nodes !== tree.nodes) changed = true;
  const previous = tree.sharedSubtrees?.[sharedId];
  if (JSON.stringify(previous) !== JSON.stringify(definition)) changed = true;
  // Nested instances may live inside the source too, so recurse even when the
  // top-level list is unchanged.
  if (!changed) return tree;
  let next = {
    ...tree,
    nodes,
    sharedSubtrees: { ...(tree.sharedSubtrees || {}), [sharedId]: definition },
  };
  // A shared tree can contain nested subtrees that are themselves shared.
  // Push their structure out too, so a nested edit is not lost on the next
  // parent sync.
  const nestedShared = [];
  const collect = (list) =>
    (list || []).forEach((node) =>
      (node.subtrees || []).forEach((st) => {
        if (st.sharedId && st.sharedId !== sharedId) nestedShared.push(st);
        collect(st.nodes);
      })
    );
  collect(source.nodes);
  nestedShared.forEach((st) => {
    next = syncSharedSubtree(next, st.sharedId, st, seen);
  });
  return next;
}

export function unlinkSharedSubtree(subtree) {
  if (!subtree?.sharedId) return subtree;
  const { sharedId: _sharedId, ...rest } = subtree;
  return rest;
}

// Deep-clone a subtree definition for a new host, resetting play state and
// giving every node/connection a fresh id. Shared trees loaded twice never
// share node ids, purchase counts or exclusivity settings.
export function cloneSubtreeForNode(source) {
  if (!source) return null;
  const idMap = {};
  const cloneNodes = (nodes) =>
    (nodes || []).map((n) => {
      const clone = JSON.parse(JSON.stringify(n));
      const oldId = clone.id;
      clone.id =
        "n" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
      idMap[oldId] = clone.id;
      clone.currentPoints = 0;
      delete clone.acquiredOrder;
      delete clone.__autoGranted;
      if (Array.isArray(clone.subtrees)) {
        clone.subtrees = clone.subtrees.map(cloneSubtreeForNode);
      }
      return clone;
    });
  const nodes = cloneNodes(source.nodes);
  nodes.forEach((n) => {
    n.dependencies = (n.dependencies || []).map((id) => idMap[id]).filter(Boolean);
    n.exclusiveWith = (n.exclusiveWith || []).map((id) => idMap[id]).filter(Boolean);
  });
  const connections = (source.connections || [])
    .map((c) => {
      const from = idMap[c.from];
      const to = idMap[c.to];
      if (!from || !to) return null;
      return { ...c, id: `${from}->${to}`, from, to };
    })
    .filter(Boolean);
  return {
    ...source,
    id: nextSubtreeId(),
    purchases: 0,
    nodes,
    connections,
  };
}

// Save the current subtree as a reusable template: fresh ids, no play state.
export function snapshotSubtree(source, name) {
  const copy = cloneSubtreeForNode(source);
  if (!copy) return null;
  return {
    ...copy,
    name: String(name || copy.name || "Shared subtree").trim(),
    purchases: 0,
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
// another tab). Legacy host copies are skipped unless `keepHostCopies` is set
// (dev mode); the return node is always included so it can navigate upwards.
// Root nodes of a subtree are the branches the player chooses between. The
// return/host marker and any node with a dependency inside the subtree are not
// roots. Flattened play nodes keep their definition id in __originalId.
function subtreeRootKeys(nodes) {
  const ids = new Set((nodes || []).map((node) => node.id));
  return new Set(
    (nodes || [])
      .filter(
        (node) =>
          !node.__returnNode &&
          !(node.dependencies || []).some((id) => ids.has(id))
      )
      .map((node) => node.__originalId || node.id)
  );
}

function collectSubtreeInstances(tree) {
  const out = [];
  const visit = (nodes, hostId = "") => {
    for (const node of nodes || []) {
      for (const subtree of node.subtrees || []) {
        out.push({ subtree, hostId: hostId || node.id });
        visit(subtree.nodes, hostId || node.id);
      }
    }
  };
  visit(tree?.nodes);
  for (const tab of tree?.tabs || []) visit(tab.nodes);
  return out;
}

// Shared subtrees are the same definition instantiated under several host
// talents. When a shared subtree is exclusive, picking a root branch in any
// instance must lock the equivalent roots in every other instance, across all
// project tabs.
export function sharedSubtreeConflict(tree, subtree, node, hostId = "") {
  if (!subtree?.exclusive || !subtree?.sharedId) return null;
  const roots = subtreeRootKeys(subtree.nodes);
  const key = node?.__originalId || node?.id;
  if (!roots.has(key)) return null;
  for (const instance of collectSubtreeInstances(tree)) {
    if (instance.subtree === subtree) continue;
    if (hostId && instance.hostId === hostId) continue;
    if (instance.subtree.sharedId !== subtree.sharedId) continue;
    const otherRoots = subtreeRootKeys(instance.subtree.nodes);
    const taken = (instance.subtree.nodes || []).find(
      (candidate) =>
        otherRoots.has(candidate.__originalId || candidate.id) &&
        (Number(candidate.currentPoints) || 0) > 0
    );
    if (taken) return taken;
  }
  return null;
}

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