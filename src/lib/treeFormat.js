// RPG skill-tree file format: converting the import/export JSON into the
// internal normalized tree and back. Extracted from treeStore to keep the
// store focused on state.
import { normalizeTiers } from "@/lib/nodeTiers";

const parseList = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : String(value || "")
        .split(/[,;]/)
        .map((item) => item.trim())
        .filter(Boolean);

const NODE_ARRAY_FIELDS = [
  "dependencies",
  "exclusiveWith",
  "resources",
  "actions",
  "options",
  "grants",
  "proficiencies",
  "requiredProficiencies",
  "abilityReqs",
  "tiers",
  "talentTypes",
  "choiceProficiencies",
  "requiresNames",
  "passives",
  "benefits",
];

// Hand-written/partial trees often omit optional arrays. Fill them once so the
// canvas, node editor and export never call .map on undefined.
export function withNodeDefaults(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return node;
  const next = { ...node };
  for (const field of NODE_ARRAY_FIELDS) {
    if (!Array.isArray(next[field])) next[field] = [];
  }
  const rawMax = Number(next.maxPoints);
  next.maxPoints = Number.isFinite(rawMax) ? Math.max(0, rawMax) : 1;
  const rawCost = Number(next.cost);
  next.cost = Number.isFinite(rawCost) ? Math.max(0, rawCost) : 1;
  next.currentPoints = Math.max(0, Number(next.currentPoints) || 0);
  if (!["manual", "subtreeAll", "subtreeSelected", "tiers"].includes(next.maxPointsMode)) {
    next.maxPointsMode = "manual";
  }
  next.maxPointsBonus = Math.max(0, Number(next.maxPointsBonus) || 0);
  next.maxPointsSubtree = Math.max(0, Number(next.maxPointsSubtree) || 0);
  next.hidden = !!next.hidden;
  const subtrees = Array.isArray(next.subtrees)
    ? next.subtrees
    : next.subtree && typeof next.subtree === "object"
      ? [next.subtree]
      : [];
  next.subtrees = subtrees.map((subtree) =>
    subtree && typeof subtree === "object"
      ? {
          ...subtree,
          nodes: (Array.isArray(subtree.nodes) ? subtree.nodes : []).map(withNodeDefaults),
        }
      : subtree
  );
  delete next.subtree;
  return next;
}

// The six node types. Each maps to the pool its points are spent from;
// "attribute" nodes spend Attribute Points and grant +1 to a chosen attribute
// per invested point. Mundane nodes spend Talent Points like any other —
// they are gated on owning a prerequisite proficiency, not on being free.
export const NODE_TYPES = [
  { value: "skill", label: "Skill", pool: "talent" },
  { value: "heritage", label: "Heritage", pool: "heritage" },
  { value: "dilettante", label: "Dilettante", pool: "talent" },
  { value: "expertise", label: "Expertise", pool: "talent" },
  { value: "mundane", label: "Mundane", pool: "talent" },
  { value: "attribute", label: "Attribute", pool: "attribute" },
  { value: "informative", label: "Informative", pool: "talent" },
];
export const NODE_TYPE_VALUES = NODE_TYPES.map((t) => t.value);
export const POOL_LABELS = { talent: "Talent", heritage: "Heritage", attribute: "Attribute", __subtree: "Subtree" };

export function normalizeTree(data) {
  if (!data || typeof data !== "object") {
    throw new Error("That file is empty or does not contain a skill tree.");
  }
  // Accept a full project file as well as a tree export. A project stores the
  // already-normalized tree under `tree`; an export stores `Skills`.
  const source =
    data.tree && typeof data.tree === "object" && !data.Skills && !data.skills
      ? data.tree
      : data;
  if (
    !source.Skills &&
    !source.skills &&
    Array.isArray(source.nodes) &&
    Array.isArray(source.connections)
  ) {
    return {
      className: source.className || "Skill Tree",
      name: source.name || source.className || "Skill Tree",
      nodes: source.nodes.map(withNodeDefaults),
      connections: source.connections,
    };
  }
  const raw = source.Skills || source.skills || [];
  if (!Array.isArray(raw)) {
    throw new Error("That file does not contain a Skills list.");
  }
  const nodes = raw.map((s, i) => {
    const pos = s["Skill Position Exact"] || { x: 0, y: 0 };
    const talentTypes = parseList(s["Skill Talent Type"]);
    const tiers = normalizeTiers({ tiers: s["Skill Tiers"] });
    const maxPoints = tiers.length
      ? tiers.reduce((sum, tier) => sum + tier.points, 0)
      : s["Skill Max Points"] ?? 1;
    const levelReq = tiers.length
      ? tiers[0].level
      : Number(s["Skill Level Requirement"]) || 0;
    return {
      id: s["Skill Id"] || "n" + i,
      name: s["Skill Name"] || `Skill ${i}`,
      x: typeof pos.x === "number" ? pos.x : 0,
      y: typeof pos.y === "number" ? pos.y : 0,
      maxPoints,
      maxPointsMode: ["manual", "subtreeAll", "subtreeSelected", "tiers"].includes(
        s["Skill Max Points Mode"]
      )
        ? s["Skill Max Points Mode"]
        : "manual",
      maxPointsBonus: Math.max(0, Number(s["Skill Max Points Bonus"]) || 0),
      maxPointsSubtree: Math.max(0, Number(s["Skill Max Points Subtree"]) || 0),
      hidden: !!s["Skill Hidden"],
      currentPoints: s["Skill Current Points"] ?? 0,
      levelGain: Math.max(0, Number(s["Skill Level Gain"]) || 0),
      image: s["Skill Image"] || "",
      description: s["Skill Description"] || "",
      dependencyNames: s["Skill Dependencies"] || [],
      prerequisite: s["Skill Prerequisite"] || "-",
      actions: (s["Skill Actions"] || []).map((a) => ({
        name: a.name || "",
        category: a.category || "action",
        description: a.description || "",
        usesMode: a.usesMode || "atwill",
        uses: a.uses ?? "1",
        sharedResource: a.sharedResource || "",
        recovery: a.recovery || "none",
        recoveryAmount: a.recoveryAmount || "",
        parts: Array.isArray(a.parts) ? a.parts : [],
        target: a.target || "",
        range: a.range || "",
        duration: a.duration || "",
        concentration: !!a.concentration,
        minPoints: Math.max(1, Number(a.minPoints) || 1),
      })),
      passives: (s["Skill Passives"] || []).map((p) => ({
        name: p.name || "",
        minPoints: Math.max(1, Number(p.minPoints) || 1),
        description: p.description || "",
      })),
      benefits: (s["Skill Benefits"] || []).map((b) => ({
        id: b.id || "",
        category: b.category || "feature",
        name: b.name || "",
        source: b.source || "",
        description: b.description || "",
        image: b.image || "",
        table: b.table || null,
        ...(b.value != null ? { value: Number(b.value) || 0 } : {}),
        minPoints: Math.max(1, Number(b.minPoints) || 1),
      })),
      resources: (s["Skill Resources"] || []).map((r) => ({
        name: r.name || "",
        uses: r.uses ?? r.value ?? "",
        type: r.type || "point",
        valueType: r.valueType || "flat",
        diceCount: r.diceCount ?? "",
        diceSize: r.diceSize || "d6",
        equalTo: r.equalTo || "level",
        mode: r.mode || "add",
        recovery: r.recovery || "none",
        recoveryAmount: r.recoveryAmount || "",
        color: r.color || "#ffffff",
        grantPool: r.grantPool || "talent",
        grantVariant: r.grantVariant || "general",
        grantName: r.grantName || "",
        minPoints: Math.max(1, Number(r.minPoints) || 1),
        scaling: {
          mode: r.scaling?.mode || "none",
          stat: r.scaling?.stat || "STR",
          talentTag: r.scaling?.talentTag || "",
          per: r.scaling?.per ?? 1,
        },
      })),
      cost: Number(s["Skill Cost"] ?? 1),
      poolOverride: String(s["Skill Pool"] || "").trim(),
      nodeType: String(s["Skill Node Type"] || "").trim() || "skill",
      attributeStat: s["Skill Attribute"] || "",
      requirementMode: "all",
      requiredPoints: 1,
      talentTypes,
      talentType: talentTypes.join(", "),
      tiers,
      levelReq,
      exclusiveWithNames: s["Skill Exclusive With"] || [],
      requiredProficiencies: (s["Skill Prerequisites"] || []).map((p) => ({
        type: p.type || "skills",
        name: p.name || "",
      })),
      proficiencies: (s["Skill Proficiencies"] || []).map((p) => ({
        type: p.type || "skill",
        name: p.name || "",
        expertise: !!p.expertise,
        minPoints: Math.max(1, Number(p.minPoints) || 1),
      })),
      grantsExpertise: !!s["Skill Grants Expertise"],
      proficiencyGrant: s["Skill Proficiency Grant"] || "none",
      frameImage: s["Skill Frame Image"] || "",
      options: (s["Skill Ability Options"] || []).map((o) => ({
        name: o.name || "",
        description: o.description || "",
        recovery: o.recovery || "",
        recoveryAmount: o.recoveryAmount || "",
        requires: Array.isArray(o.requires)
          ? o.requires
          : o.requires && o.requires.type && o.requires.type !== "none"
          ? [o.requires]
          : [],
        attached: (o.attached || [])
          .map((a) => ({ nodeId: a.nodeId || "", optionName: a.optionName || "" }))
          .filter((a) => a.nodeId && a.optionName),
      })),
      grants: (s["Skill Auto Grants"] || []).map((g) => ({
        name: g.name || "",
        description: g.description || "",
        nodeId: g.nodeId || "",
        optionName: g.optionName || "",
      })),
      rotation: 0,
      flipped: false,
      flipV: false,
      // The node's own skill trees (see subtrees.js) — an empty list when none.
      subtrees: (() => {
        const arr = Array.isArray(source["Skill Subtrees"])
          ? source["Skill Subtrees"]
          : source["Skill Subtree"]
          ? [source["Skill Subtree"]]
          : [];
        return arr.map((sub, j) => {
          const inner = normalizeTree(sub);
          return {
            id: sub["Subtree Id"] || "st" + j + "-" + (s["Skill Id"] || i),
            name: sub["Subtree Name"] || `Subtree ${j + 1}`,
            nodes: inner.nodes,
            connections: inner.connections || [],
            grantedPoints: Number(sub["Subtree Points"]) || 0,
            poolName: sub["Subtree Pool"] || "",
            exclusive: !!sub["Subtree Exclusive"],
            level: Number(sub["Subtree Level"]) || 0,
            default: !!sub["Subtree Default"],
          };
        });
      })(),
      pointType: "talent",
      size: 100,
    };
  });

  // In the RPG JSON, "Skill Prerequisite" holds the skill that unlocks this one
  // (optionally "(N)" = points needed), while "Skill Dependencies" lists the
  // children — so connections are built from the prerequisite, not the list.
  const normKey = (n) => String(n).trim().replace(/\s+/g, " ");
  const nameToId = {};
  nodes.forEach((n) => {
    if (!nameToId[normKey(n.name)]) nameToId[normKey(n.name)] = n.id;
  });

  let connections = [];
  nodes.forEach((n) => {
    n.dependencies = [];
    n.exclusiveWith = (n.exclusiveWithNames || [])
      .map((nm) => nameToId[normKey(nm)])
      .filter((id) => id && id !== n.id);
    delete n.exclusiveWithNames;
    const raw = String(n.prerequisite || "").trim();
    if (raw && raw !== "-") {
      const m = raw.match(/\s*\((\d+)\)\s*$/);
      const pts = m ? Number(m[1]) : 1;
      const base = m ? raw.slice(0, m.index) : raw;
      const did = nameToId[normKey(base)];
      if (did && did !== n.id) {
        n.dependencies.push(did);
        if (pts > 1) n.requiredPoints = Math.max(n.requiredPoints || 1, pts);
        connections.push({ id: `${did}->${n.id}`, from: did, to: n.id });
      }
    }
    delete n.dependencyNames;
  });

  // Connectors exported with the file carry their bends and styles; they win
  // over the prerequisite-derived set, which stays as the fallback for files
  // without exported connectors (or prerequisites added since the export).
  const exportedConns = Array.isArray(source["Skill Connectors"]) ? source["Skill Connectors"] : [];
  if (exportedConns.length) {
    const ids = new Set(nodes.map((n) => n.id));
    const seen = new Set();
    const out = [];
    exportedConns.forEach((c) => {
      if (!c || !ids.has(c.from) || !ids.has(c.to)) return;
      const id = `${c.from}->${c.to}`;
      if (seen.has(id)) return;
      seen.add(id);
      const copy = { ...c };
      delete copy.id;
      out.push({ id, from: c.from, to: c.to, ...copy });
    });
    connections.forEach((c) => {
      if (!seen.has(c.id)) out.push(c);
    });
    connections = out;
  }

  return {
    className: source["Class Name"] || "Skill Tree",
    name: source["Project Name"] || source.name || source["Class Name"] || "Skill Tree",
    nodes: nodes.map(withNodeDefaults),
    connections,
  };
}

// Convert the internal tree back to the RPG JSON format.
export function denormalizeTree(tree) {
  const nodes = Array.isArray(tree?.nodes) ? tree.nodes : [];
  const idToNode = {};
  nodes.forEach((n) => (idToNode[n.id] = n));
  const skills = nodes.map((n) => ({
    "Skill Name": n.name,
    // Node ids travel with the file so exported connectors (which reference
    // them) still resolve after a round-trip.
    "Skill Id": n.id,
    "Skill Position": `(${Math.round(n.x / 120)},${Math.round(n.y / 120)})`,
    "Skill Position Exact": { x: n.x, y: n.y },
    "Skill Level": 1,
    "Skill Description": n.description,
    "Skill Max Points": n.maxPoints,
    "Skill Max Points Mode": n.maxPointsMode || "manual",
    "Skill Max Points Bonus": n.maxPointsBonus ?? 0,
    "Skill Max Points Subtree": n.maxPointsSubtree ?? 0,
    "Skill Hidden": !!n.hidden,
    "Skill Current Points": n.currentPoints,
    "Skill Level Gain": n.levelGain || 0,
    "Skill Image": n.image,
    // The RPG format stores the inverse list here: the skills that depend on this one.
    "Skill Dependencies": nodes
      .filter((m) => (m.dependencies || []).includes(n.id))
      .map((m) => m.name),
    "Skill Prerequisite": n.prerequisite || "-",
    "Skill Talent Type": (n.talentTypes?.length
      ? n.talentTypes.join(", ")
      : n.talentType || ""),
    "Skill Level Requirement": n.levelReq || 0,
    ...(Array.isArray(n.tiers) && n.tiers.length
      ? { "Skill Tiers": n.tiers }
      : {}),
    "Skill Exclusive With": (n.exclusiveWith || [])
      .map((id) => idToNode[id]?.name)
      .filter(Boolean),
    "Skill Prerequisites": (n.requiredProficiencies || []).map((p) => ({
      type: p.type || "skills",
      name: p.name || "",
    })),
    "Skill Node Type": n.nodeType || "skill",
    "Skill Attribute": n.attributeStat || "",
    "Skill Grants Expertise": !!n.grantsExpertise,
    "Skill Proficiency Grant": n.proficiencyGrant || "none",
    "Skill Proficiencies": (n.proficiencies || []).map((p) => ({
      type: p.type,
      name: p.name,
      expertise: !!p.expertise,
      minPoints: Math.max(1, Number(p.minPoints) || 1),
    })),
    "Skill Cost": n.cost ?? 1,
    "Skill Pool": n.poolOverride || "",
    "Skill Frame Image": n.frameImage || "",
    "Skill Ability Options": (n.options || []).map((o) => ({
      name: o.name,
      description: o.description,
      recovery: o.recovery || "",
      recoveryAmount: o.recoveryAmount || "",
      requires: Array.isArray(o.requires)
        ? o.requires
        : o.requires && o.requires.type && o.requires.type !== "none"
        ? [o.requires]
        : [],
      attached: (o.attached || [])
        .map((a) => ({ nodeId: a.nodeId, optionName: a.optionName }))
        .filter((a) => a.nodeId && a.optionName),
    })),
    "Skill Auto Grants": (n.grants || []).map((g) => ({
      name: g.name,
      description: g.description,
      nodeId: g.nodeId || "",
      optionName: g.optionName || "",
    })),
    "Skill Actions": (n.actions || []).map((a) => ({
      name: a.name,
      category: a.category || "action",
      description: a.description || "",
      usesMode: a.usesMode || "atwill",
      uses: a.uses ?? "1",
      sharedResource: a.sharedResource || "",
      recovery: a.recovery || "none",
      recoveryAmount: a.recoveryAmount || "",
      parts: Array.isArray(a.parts) ? a.parts : [],
      target: a.target || "",
      range: a.range || "",
      duration: a.duration || "",
      concentration: !!a.concentration,
      minPoints: Math.max(1, Number(a.minPoints) || 1),
    })),
    "Skill Passives": (n.passives || []).map((p) => ({
      name: p.name,
      minPoints: Math.max(1, Number(p.minPoints) || 1),
      description: p.description || "",
    })),
    "Skill Benefits": (n.benefits || []).map((b) => ({
      id: b.id || "",
      category: b.category || "feature",
      name: b.name || "",
      source: b.source || "",
      description: b.description || "",
      image: b.image || "",
      table: b.table || null,
      ...(b.value != null ? { value: Number(b.value) || 0 } : {}),
      minPoints: Math.max(1, Number(b.minPoints) || 1),
    })),
    "Skill Resources": (n.resources || []).map((r) => ({
      name: r.name,
      value: r.uses ?? r.value ?? "",
      uses: r.uses ?? r.value ?? "",
      type: r.type || "point",
      valueType: r.valueType || "flat",
      diceCount: r.diceCount ?? "",
      diceSize: r.diceSize || "d6",
      equalTo: r.equalTo || "level",
      mode: r.mode || "add",
      recovery: r.recovery || "none",
      recoveryAmount: r.recoveryAmount || "",
      color: r.color,
      grantPool: r.grantPool || "talent",
      grantVariant: r.grantVariant || "general",
      grantName: r.grantName || "",
      minPoints: Math.max(1, Number(r.minPoints) || 1),
      scaling: r.scaling || { mode: "none" },
      })),
      // The node's own skill trees, exported recursively so nested subtrees
      // round-trip through the RPG file format.
      ...(n.subtrees && n.subtrees.length
      ? {
          "Skill Subtrees": n.subtrees.map((st) => ({
            ...denormalizeTree({
              nodes: st.nodes || [],
              connections: st.connections || [],
              className: tree.className,
              name: tree.name,
            }),
            "Subtree Id": st.id || "",
            "Subtree Name": st.name || "",
            "Subtree Points": Number(st.grantedPoints) || 0,
            "Subtree Pool": st.poolName || "",
            "Subtree Exclusive": !!st.exclusive,
            "Subtree Level": Number(st.level) || 0,
            "Subtree Default": !!st.default,
          })),
        }
      : {}),
      }));
  return {
    Skills: skills,
    // Full connector data (bends, styles, direction flags) — previously
    // connectors were rebuilt only from prerequisites on import, so every
    // decoration was lost.
    "Skill Connectors": (tree?.connections || []).map((c) => {
      const copy = { ...c };
      delete copy.id;
      return copy;
    }),
    "Class Name": tree?.className,
    "Project Name": tree?.name || tree?.className,
    FullData: {
      hideLockedSkills: 0,
      totalStats: {},
      showInfo: false,
      showStatsSummary: true,
    },
  };
}