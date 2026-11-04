// Structured passive effects on a node. These cover conditional rules that the
// sheet cannot reduce to a single number: advantages, resistances, triggered
// benefits and second-rank upgrades. They are shown on the character sheet when
// the node has at least `minPoints` invested.
export function collectNodePassives(tree) {
  const out = [];
  const seen = new Set();
  const walk = (nodes) => {
    for (const node of nodes || []) {
      (node.subtrees || []).forEach((subtree) => walk(subtree.nodes));
      const points = Number(node.currentPoints) || 0;
      if (points <= 0) continue;
      for (const passive of node.passives || []) {
        if (!passive?.name) continue;
        if ((Number(passive.minPoints) || 1) > points) continue;
        const key = `${node.id}|${passive.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ nodeId: node.id, nodeName: node.name, points, ...passive });
      }
    }
  };
  walk(tree?.nodes);
  return out;
}
