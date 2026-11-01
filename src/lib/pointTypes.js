// Configurable node types and point currencies.
//
// A node's `nodeType` decides which currency pays for it. Point types map one
// node type to one currency, and each point type gets a field in the Levels
// tab plus its own pool on the character sheet. Node types that are not mapped
// (Dilettante, Expertise, Mundane, Informative) fall back to the first point
// type, which keeps existing projects behaving like Talent.

import { NODE_TYPES } from "@/lib/treeFormat";

export const DEFAULT_NODE_TYPES = NODE_TYPES.map(({ value, label }) => ({ value, label }));

export const DEFAULT_POINT_TYPES = [
  { id: "talent", label: "Talent", nodeType: "skill", currency: "Talent Points" },
  { id: "heritage", label: "Heritage", nodeType: "heritage", currency: "Heritage Points" },
  { id: "attribute", label: "Attribute", nodeType: "attribute", currency: "Attribute Points" },
];

const DEFAULT_ZERO = { talent: 2, heritage: 12, attribute: 72 };
const DEFAULT_PER_LEVEL = { talent: 1, heritage: 0, attribute: 0 };

const slug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function normalizeNodeTypes(list) {
  const source = Array.isArray(list) && list.length ? list : DEFAULT_NODE_TYPES;
  const seen = new Set();
  const out = [];
  source.forEach((entry) => {
    const raw = typeof entry === "string" ? { value: entry, label: entry } : entry || {};
    const label = String(raw.label || raw.name || raw.value || "").trim();
    const value = String(raw.value || raw.id || slug(label)).trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push({ value, label: label || value });
  });
  return out.length ? out : DEFAULT_NODE_TYPES.map((t) => ({ ...t }));
}

export function normalizePointTypes(list) {
  const source = Array.isArray(list) && list.length ? list : DEFAULT_POINT_TYPES;
  const seen = new Set();
  const out = [];
  source.forEach((entry, index) => {
    const raw = entry || {};
    const label = String(raw.label || raw.name || raw.id || `Type ${index + 1}`).trim();
    let id = slug(raw.id || raw.pool || label);
    if (!id) id = `type-${index + 1}`;
    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    out.push({
      id,
      label: label || id,
      nodeType: String(raw.nodeType || raw.type || "skill"),
      currency: String(raw.currency || `${label || id} Points`),
    });
  });
  return out.length ? out : DEFAULT_POINT_TYPES.map((t) => ({ ...t }));
}

export function pointTypesFor(settings) {
  return normalizePointTypes(settings?.library?.pointTypes);
}

export function nodeTypesFor(settings) {
  return normalizeNodeTypes(settings?.library?.nodeTypes);
}

// First point type whose assigned node type matches, with legacy fallbacks for
// the three built-in currencies.
export function pointTypeForNodeType(pointTypes, nodeType) {
  const list = normalizePointTypes(pointTypes);
  const type = String(nodeType || "skill");
  const exact = list.find((pt) => pt.nodeType === type);
  if (exact) return exact;
  const legacy = list.find((pt) => pt.id === type);
  if (legacy) return legacy;
  const talent = list.find((pt) => pt.id === "talent");
  return talent || list[0];
}

export function poolForNodeType(nodeType, pointTypes) {
  return pointTypeForNodeType(pointTypes, nodeType).id;
}

export function pointTypeById(pointTypes, id) {
  const list = normalizePointTypes(pointTypes);
  return list.find((pt) => pt.id === id) || null;
}

export function poolLabel(pointTypes, id) {
  return pointTypeById(pointTypes, id)?.label || (id === "__subtree" ? "Subtree" : id);
}

export function poolCurrency(pointTypes, id) {
  return pointTypeById(pointTypes, id)?.currency || `${poolLabel(pointTypes, id)} Points`;
}

export function legacyPointLevelValue(id) {
  return DEFAULT_PER_LEVEL[id] ?? 0;
}

export function legacyPointZeroValue(id) {
  return DEFAULT_ZERO[id] ?? 0;
}

// Normalise the per-level defaults and level-0 starting values, accepting the
// old flat keys (talentPoints, heritagePoints, attributePoints…).
export function pointDefaultsFor(settings) {
  const rules = settings?.levelRules || {};
  const types = pointTypesFor(settings);
  const out = {};
  types.forEach((pt) => {
    const explicit = rules.pointDefaults?.[pt.id];
    const legacy = rules[`${pt.id}Points`];
    const value = explicit ?? legacy ?? legacyPointLevelValue(pt.id);
    out[pt.id] = Math.max(0, Number(value) || 0);
  });
  return out;
}

export function levelZeroPointsFor(settings) {
  const rules = settings?.levelRules || {};
  const types = pointTypesFor(settings);
  const out = {};
  types.forEach((pt) => {
    const explicit = rules.levelZeroPoints?.[pt.id];
    const legacy =
      pt.id === "talent" ? rules.levelZeroTalentPoints : rules[`levelZero${pt.id}Points`];
    const value = explicit ?? legacy ?? legacyPointZeroValue(pt.id);
    out[pt.id] = Math.max(0, Number(value) || 0);
  });
  return out;
}
