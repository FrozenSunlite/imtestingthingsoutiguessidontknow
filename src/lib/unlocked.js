import { poolForNode } from "@/lib/treeStore";

// Grouping for the View screen's unlocked list: nodes bought with Heritage
// Points (Heritage Traits) come first; Talent-pool nodes are grouped by their
// Talent Type, types alphabetized (untagged last), and nodes inside each
// group in acquisition order (the order their points were invested).
export function groupUnlocked(nodes, { includeAutoGranted = false } = {}) {
  // Starter copies inside a subtree represent their host node — listing them
  // would show that talent twice on the sheet. Auto-granted starter nodes are
  // structural and only appear in dev mode.
  const list = (nodes || []).filter(
    (n) => !n.__hostCopy && (includeAutoGranted || !n.__autoGranted)
  );
  const byAcquired = (a, b) =>
    (Number(a.acquiredOrder) || Infinity) - (Number(b.acquiredOrder) || Infinity);
  const heritage = list.filter((n) => poolForNode(n) === "heritage").sort(byAcquired);
  const attributes = list.filter((n) => poolForNode(n) === "attribute").sort(byAcquired);
  const groups = {};
  list.forEach((n) => {
    if (poolForNode(n) !== "talent" || (n.nodeType || "") === "informative") return;
    const key = String(n.talentType || "").trim();
    (groups[key] = groups[key] || []).push(n);
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