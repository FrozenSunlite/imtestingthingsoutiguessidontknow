import { poolForNode, talentTypesOf } from "@/lib/treeStore";

// Grouping for the View screen's unlocked list: nodes bought with Heritage
// Points (Heritage Traits) come first; Talent-pool nodes are grouped by their
// Talent Type, types alphabetized (untagged last), and nodes inside each
// group in acquisition order (the order their points were invested).
// Invested nodes inside host subtrees, flattened into sheet rows. Each copy
// keeps the host chain and the flattened id used by the play panel, so a
// double-click can open the right subtree tab and centre on the node.
export function collectSubtreeUnlocked(tree) {
  const out = [];
  const walk = (subtree, host, chain, label) => {
    (subtree?.nodes || []).forEach((n) => {
      if (n.__hostCopy || n.__returnNode) return;
      if ((n.currentPoints || 0) > 0) {
        const subtreeIndex = chain[chain.length - 1]?.subIndex ?? 0;
        out.push({
          ...n,
          poolOverride: "__subtree",
          id: `sub-${host.id}-${subtreeIndex}-${n.id}`,
          __originalId: n.id,
          __path: [n.id],
          __subtreeLabel: label,
          __hostChain: chain,
          __subtreeHostId: host.id,
          __subtreeIndex: subtreeIndex,
        });
      }
      const nested = Array.isArray(n.subtrees)
        ? n.subtrees
        : n.subtree
          ? [n.subtree]
          : [];
      if ((n.currentPoints || 0) > 0) {
        nested.forEach((st, i) => {
          walk(
            st,
            n,
            [...chain, { hostId: n.id, subIndex: i }],
            st.poolName || st.name || n.name || "Subtree"
          );
        });
      }
    });
  };
  (tree?.nodes || []).forEach((host) => {
    if ((host.currentPoints || 0) <= 0) return;
    (host.subtrees || []).forEach((st, i) => {
      walk(
        st,
        host,
        [{ hostId: host.id, subIndex: i }],
        st.poolName || st.name || host.name || "Subtree"
      );
    });
  });
  return out;
}

export function groupUnlocked(nodes, { includeAutoGranted = false } = {}) {
  // Starter copies inside a subtree represent their host node — listing them
  // would show that talent twice on the sheet. Auto-granted starter nodes are
  // structural and only appear in dev mode.
  const list = (nodes || []).filter(
    (n) => !n.__hostCopy && !n.__returnNode && (includeAutoGranted || !n.__autoGranted)
  );
  const byAcquired = (a, b) =>
    (Number(a.acquiredOrder) || Infinity) - (Number(b.acquiredOrder) || Infinity);
  const heritage = list.filter((n) => poolForNode(n) === "heritage").sort(byAcquired);
  const attributes = list.filter((n) => poolForNode(n) === "attribute").sort(byAcquired);
  const groups = {};
  list.forEach((n) => {
    if (poolForNode(n) !== "talent" || (n.nodeType || "") === "informative") return;
    const types = talentTypesOf(n);
    if (!types.length) {
      (groups[""] = groups[""] || []).push(n);
      return;
    }
    types.forEach((type) => {
      (groups[type] = groups[type] || []).push(n);
    });
  });
  const talentGroups = Object.entries(groups)
    .sort(([a], [b]) => {
      // Untagged nodes sort last, after the alphabetized Talent Types.
      if (!a && b) return 1;
      if (a && !b) return -1;
      return a.localeCompare(b);
    })
    .map(([type, ns]) => ({ type, nodes: ns.sort(byAcquired) }));
  // Nodes invested inside a host node's subtree: grouped by that subtree's
  // label (e.g. "Fighting Styles"), each in acquisition order.
  const subtreeGroups = Object.entries(
    list.reduce((acc, n) => {
      if (poolForNode(n) !== "__subtree") return acc;
      const key = String(n.__subtreeLabel || "Subtree");
      (acc[key] = acc[key] || []).push(n);
      return acc;
    }, {})
  )
    .map(([label, ns]) => ({ label, nodes: ns.sort(byAcquired) }))
    .sort(
      (a, b) =>
        (Number(a.nodes[0]?.acquiredOrder) || Infinity) -
        (Number(b.nodes[0]?.acquiredOrder) || Infinity)
    );
  return { heritage, talentGroups, attributes, subtreeGroups };
}