// Automatic Max Points formulas. A node can derive its investment cap from the
// number of investable nodes in its subtrees, one selected subtree, or its
// tiers, with an optional flat bonus.
import { normalizeTiers } from "./nodeTiers.js";

export const MAX_POINTS_MODES = ["manual", "subtreeAll", "subtreeSelected", "tiers"];

export const MAX_POINTS_MODE_LABELS = {
  manual: "Manual (flat)",
  subtreeAll: "All subtree nodes",
  subtreeSelected: "Selected subtree nodes",
  tiers: "Tier count",
};

const subtreesOf = (node) =>
  Array.isArray(node?.subtrees)
    ? node.subtrees
    : node?.subtree
      ? [node.subtree]
      : [];

// Return markers, free nodes, auto-granted starters and 0-point nodes never
// count toward a host's point budget.
export function isInvestableSubtreeNode(node) {
  if (!node || typeof node !== "object") return false;
  if (node.__returnNode || node.__autoGranted || node.__hostCopy) return false;
  if (node.nodeType === "informative") return false;
  if (Number(node.maxPoints) === 0) return false;
  return Number(node.cost ?? 1) > 0;
}

export function countSubtreeNodes(nodes) {
  return (Array.isArray(nodes) ? nodes : []).reduce((sum, node) => {
    if (!isInvestableSubtreeNode(node)) return sum;
    const nested = subtreesOf(node).flatMap((subtree) => subtree.nodes || []);
    return sum + 1 + countSubtreeNodes(nested);
  }, 0);
}

export function autoMaxPointsFor(node) {
  const mode = node?.maxPointsMode || "manual";
  if (!MAX_POINTS_MODES.includes(mode) || mode === "manual") return null;
  const bonus = Math.max(0, Math.floor(Number(node?.maxPointsBonus) || 0));
  if (mode === "tiers") {
    return (normalizeTiers(node).length || 1) + bonus;
  }
  const subtrees = subtreesOf(node);
  const source =
    mode === "subtreeSelected"
      ? subtrees[
          Math.max(
            0,
            Math.min(subtrees.length - 1, Number(node?.maxPointsSubtree) || 0)
          )
        ]?.nodes || []
      : subtrees.flatMap((subtree) => subtree.nodes || []);
  return countSubtreeNodes(source) + bonus;
}

function sameTiers(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  return left.every(
    (tier, index) =>
      Number(tier.level) === Number(right[index].level) &&
      Number(tier.points) === Number(right[index].points) &&
      String(tier.label || "") === String(right[index].label || "") &&
      String(tier.subtreeId || "") === String(right[index].subtreeId || "")
  );
}

// Keep the authored tier levels/labels but make their point total match the
// formula. A smaller total trims tiers from the end; a larger one adds the
// extra points to the last tier.
function resizeTiers(tiers, total, { onePerTier = false } = {}) {
  const desired = Math.max(0, Math.floor(Number(total) || 0));
  if (desired <= 0 || !tiers.length) return [];
  if (desired < tiers.length) {
    return tiers.slice(0, desired).map((tier) => ({ ...tier, points: 1 }));
  }
  const out = tiers.map((tier) => ({ ...tier, points: onePerTier ? 1 : tier.points }));
  let sum = out.reduce((value, tier) => value + tier.points, 0);
  if (sum < desired) {
    out[out.length - 1].points += desired - sum;
  } else if (sum > desired) {
    let excess = sum - desired;
    for (let index = out.length - 1; index >= 0 && excess > 0; index -= 1) {
      const take = Math.min(out[index].points - 1, excess);
      out[index].points -= take;
      excess -= take;
    }
  }
  return out;
}

export function applyAutoMaxPoints(nodes) {
  if (!Array.isArray(nodes)) return nodes;
  let changed = false;
  const out = nodes.map((node) => {
    if (!node || typeof node !== "object") return node;
    const subtrees = subtreesOf(node);
    let subtreeChanged = false;
    const nextSubtrees = subtrees.map((subtree) => {
      const nextNodes = applyAutoMaxPoints(subtree?.nodes || []);
      if (nextNodes === subtree?.nodes) return subtree;
      subtreeChanged = true;
      return { ...subtree, nodes: nextNodes };
    });
    let nextNode = subtreeChanged ? { ...node, subtrees: nextSubtrees } : node;
    if (subtreeChanged) changed = true;

    const desired = autoMaxPointsFor(nextNode);
    if (desired == null) return nextNode;

    const tiers = normalizeTiers(nextNode);
    const resized = resizeTiers(tiers, desired, {
      onePerTier: nextNode.maxPointsMode === "tiers",
    });
    const maxPoints = desired;
    if (Number(nextNode.maxPoints) === maxPoints && sameTiers(nextNode.tiers, resized)) {
      return nextNode;
    }
    changed = true;
    nextNode = {
      ...nextNode,
      maxPoints,
      tiers: resized,
      ...(resized.length ? { levelReq: resized[0].level || 0 } : {}),
    };
    return nextNode;
  });
  return changed ? out : nodes;
}

function hasAutoMaxPoints(nodes) {
  return (Array.isArray(nodes) ? nodes : []).some(
    (node) =>
      (node?.maxPointsMode && node.maxPointsMode !== "manual") ||
      subtreesOf(node).some((subtree) => hasAutoMaxPoints(subtree?.nodes))
  );
}

export function applyAutoMaxPointsToTree(tree) {
  if (!tree) return tree;
  const hasAuto =
    hasAutoMaxPoints(tree.nodes) ||
    (Array.isArray(tree.tabs) && tree.tabs.some((tab) => hasAutoMaxPoints(tab?.nodes))) ||
    (Array.isArray(tree.subtreeEditing?.stack) &&
      tree.subtreeEditing.stack.some((frame) => hasAutoMaxPoints(frame?.nodes)));
  if (!hasAuto) return tree;
  let changed = false;
  const nodes = applyAutoMaxPoints(tree.nodes);
  if (nodes !== tree.nodes) changed = true;

  const tabs = (Array.isArray(tree.tabs) ? tree.tabs : []).map((tab) => {
    const next = applyAutoMaxPoints(tab?.nodes);
    if (next === tab?.nodes) return tab;
    changed = true;
    return { ...tab, nodes: next };
  });

  let subtreeEditing = tree.subtreeEditing;
  if (Array.isArray(subtreeEditing?.stack) && subtreeEditing.stack.length) {
    let stackChanged = false;
    const stack = subtreeEditing.stack.map((frame) => {
      const next = applyAutoMaxPoints(frame?.nodes);
      if (next === frame?.nodes) return frame;
      stackChanged = true;
      return { ...frame, nodes: next };
    });
    if (stackChanged) {
      changed = true;
      subtreeEditing = { ...subtreeEditing, stack };
    }
  }

  return changed ? { ...tree, nodes, tabs, subtreeEditing } : tree;
}
