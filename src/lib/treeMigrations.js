// Move a "[X Talent]" / "[X Trait]" category out of node names into the Talent
// Type field, and "(Level x)" / "lvl x" markers into the Level Requirement
// field. A node whose whole name is just the tag (the category hubs, such as
// "[Combat Traits]") keeps the tag text as its name.
export function migrateTalentNames(tree) {
  if (!tree?.nodes) return tree;
  let changed = false;
  const re = /\s*\[([^\][]*\b(?:talents?|traits?)\b[^\][]*)\]\s*/i;
  const levelRes = [
    /\s*\(?\s*lvl\.?\s*(\d+)\s*\)?\s*/i,
    /\s*\(?\s*level\s+(\d+)\s*\)?\s*/i,
  ];
  const nodes = tree.nodes.map((n) => {
    let name = String(n.name || "");
    let patch = null;
    const m = name.match(re);
    if (m) {
      // "[Combat Trait]" keeps "Trait"; "[Arcane Talent]" drops the word
      // "Talent" because the field is already called Talent Types.
      const type = /talent/i.test(m[1])
        ? m[1].replace(/\s*talents?\s*$/i, "").trim() || m[1].trim()
        : m[1].trim();
      const existing = Array.isArray(n.talentTypes) && n.talentTypes.length
        ? n.talentTypes.map((value) => String(value || "").trim()).filter(Boolean)
        : String(n.talentType || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
      const types = existing.includes(type) ? existing : [...existing, type];
      patch = { talentTypes: types, talentType: types.join(", ") };
    }
    for (const lre of levelRes) {
      const lm = name.match(lre);
      if (lm && !(Number(n.levelReq) > 0)) {
        patch = { ...(patch || {}), levelReq: Number(lm[1]) };
      }
      name = name.replace(lre, " ");
    }
    if (m) {
      const withoutTag = name.replace(re, " ").replace(/\s{2,}/g, " ").trim();
      name = withoutTag || patch?.talentType || m[1].trim();
    }
    name = name.replace(/\s{2,}/g, " ").trim();
    if (patch || name !== String(n.name || "")) {
      changed = true;
      return { ...n, ...patch, name };
    }
    return n;
  });
  return changed ? { ...tree, nodes } : tree;
}