// Tiered node investment. A node can unlock at several character levels
// (Action Surge at 2, its second use at 17, a totem choice at 3/6/10...).
// Each tier has its own point cost. The node's total Max Points is the sum of
// its tiers; the next tier's level gates the next point.

export function normalizeTiers(node) {
  const raw = Array.isArray(node?.tiers) ? node.tiers : [];
  return raw
    .filter((tier) => tier && Number(tier.points) > 0)
    .map((tier, index) => ({
      level: Math.max(0, Number(tier.level) || 0),
      points: Math.max(1, Number(tier.points) || 1),
      label: String(tier.label || "").trim() || `Tier ${index + 1}`,
      subtreeId: tier.subtreeId || "",
    }));
}

export function hasTiers(node) {
  return normalizeTiers(node).length > 0;
}

export function tiersForNode(node) {
  // The return node is a navigation marker, not an investable talent.
  if (node?.__returnNode) return [];
  const tiers = normalizeTiers(node);
  if (tiers.length) return tiers;
  // A zero-point node (including a free bridge) must stay at zero instead of
  // falling back to the usual one-point default.
  const rawMax = Number(node?.maxPoints);
  if (Number.isFinite(rawMax) && rawMax <= 0) return [];
  return [
    {
      level: Math.max(0, Number(node?.levelReq) || 0),
      points: Math.max(1, rawMax || 1),
      label: "",
      subtreeId: "",
    },
  ];
}

export function nodeMaxPoints(node) {
  return tiersForNode(node).reduce((sum, tier) => sum + tier.points, 0);
}

// Where the current points sit. `active` is the tier the next point would go
// into; `complete` means every tier is filled.
export function tierPlan(node) {
  const tiers = tiersForNode(node);
  const current = Math.max(0, Number(node?.currentPoints) || 0);
  let remaining = current;
  for (let index = 0; index < tiers.length; index += 1) {
    const tier = tiers[index];
    if (remaining < tier.points) {
      return {
        tiers,
        active: tier,
        index,
        pointsInto: remaining,
        complete: false,
        max: nodeMaxPoints(node),
      };
    }
    remaining -= tier.points;
  }
  return {
    tiers,
    active: null,
    index: tiers.length,
    pointsInto: 0,
    complete: true,
    max: nodeMaxPoints(node),
  };
}

export function nextTierLevel(node) {
  return tierPlan(node).active?.level || 0;
}

export function currentTierLabel(node) {
  const plan = tierPlan(node);
  if (!plan.active) return "";
  return plan.active.label || "";
}

// The level shown on the node: the level of the tier currently being paid
// into. When all tiers are filled there is nothing left to unlock.
export function displayLevel(node) {
  return nextTierLevel(node);
}

export function tierGate(node, characterLevel) {
  const plan = tierPlan(node);
  if (plan.complete) return { ok: false, reason: "All tiers are already filled." };
  const need = Number(plan.active?.level) || 0;
  if (need > 0 && (Number(characterLevel) || 1) < need) {
    return {
      ok: false,
      reason: `Requires character level ${need} for ${plan.active.label || "the next tier"}.`,
      level: need,
    };
  }
  return { ok: true, level: need, tier: plan.active };
}

export function withTiers(node, tiers) {
  const clean = (tiers || [])
    .filter((tier) => tier && Number(tier.points) > 0)
    .map((tier, index) => ({
      level: Math.max(0, Number(tier.level) || 0),
      points: Math.max(1, Number(tier.points) || 1),
      label: String(tier.label || "").trim() || `Tier ${index + 1}`,
      subtreeId: tier.subtreeId || "",
    }));
  if (!clean.length) {
    const rawMax = Number(node.maxPoints);
    return {
      ...node,
      tiers: [],
      maxPoints: Number.isFinite(rawMax) ? Math.max(0, rawMax) : 1,
    };
  }
  return {
    ...node,
    tiers: clean,
    maxPoints: clean.reduce((sum, tier) => sum + tier.points, 0),
    levelReq: clean[0].level || 0,
  };
}
