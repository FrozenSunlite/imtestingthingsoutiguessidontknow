// DM access visibility. A node can be explicitly hidden, and a descendant is
// hidden from play only when every one of its prerequisite paths is hidden.
// Nodes with an alternate visible prerequisite stay available.
export function hiddenNodeIds(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const hidden = new Set(
    list.filter((node) => node && node.hidden).map((node) => node.id)
  );
  if (!hidden.size) return hidden;
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of list) {
      if (!node || hidden.has(node.id)) continue;
      const deps = Array.isArray(node.dependencies)
        ? node.dependencies.filter(Boolean)
        : [];
      if (!deps.length) continue;
      if (deps.every((id) => hidden.has(id))) {
        hidden.add(node.id);
        changed = true;
      }
    }
  }
  return hidden;
}

export function isHiddenForPlay(node, nodes) {
  return hiddenNodeIds(nodes).has(node?.id);
}
