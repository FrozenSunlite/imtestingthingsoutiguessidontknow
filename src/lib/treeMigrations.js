// Move a "[X Talent]" category out of node names into the Talent Type field,
// and "(Level x)" / "lvl x" markers into the Level Requirement field.
export function migrateTalentNames(tree) {
  if (!tree?.nodes) return tree;
  let changed = false;
  const re = /\s*\[([^\][]*talent[^\][]*)\]\s*/i;
  const levelRes = [
    /\s*\(?\s*lvl\.?\s*(\d+)\s*\)?\s*/i,
    /\s*\(?\s*level\s+(\d+)\s*\)?\s*/i,
  ];
  const nodes = tree.nodes.map((n) => {
    let name = String(n.name || "");
    let patch = null;
    const m = name.match(re);
    if (m) {
      const type = m[1].replace(/\s*talents?\s*$/i, "").trim() || m[1].trim();
      patch = { talentType: n.talentType || type };
    }
    for (const lre of levelRes) {
      const lm = name.match(lre);
      if (lm && !(Number(n.levelReq) > 0)) {
        patch = { ...(patch || {}), levelReq: Number(lm[1]) };
      }
      name = name.replace(lre, " ");
    }
    if (m) name = name.replace(re, " ");
    name = name.replace(/\s{2,}/g, " ").trim();
    if (patch || name !== String(n.name || "")) {
      changed = true;
      return { ...n, ...patch, name };
    }
    return n;
  });
  return changed ? { ...tree, nodes } : tree;
}