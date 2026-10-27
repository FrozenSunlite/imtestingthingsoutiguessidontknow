import { normText } from "@/lib/textSearch";

// Skill-tree search: plain text searches every field; a `key:` or
// `key:"quoted value"` prefix restricts the match to one field.
// Matching is unicode-safe (see textSearch.js) and failsafe on any value type.
export const SEARCH_FIELDS = [
  { key: "n", field: "name", label: "Name", example: 'n:"Fire Bolt"', desc: "Node name" },
  { key: "d", field: "description", label: "Description", example: 'd:"+2 to hit"', desc: "Node description" },
  { key: "f", field: "flavor", label: "Flavor", example: 'f:"forbidden"', desc: "Flavor text" },
  { key: "t", field: "talentType", label: "Talent type", example: 't:"expertise"', desc: "Talent type (Skill, Heritage, Dilettante, Expertise, Mundane)" },
  { key: "y", field: "nodeType", label: "Category", example: 'y:"attribute"', desc: "Node category (skill, heritage, dilettante, expertise, mundane, attribute)" },
  { key: "a", field: "attributeStat", label: "Attribute", example: 'a:"STR"', desc: "Attribute stat (STR, DEX, …)" },
];

// "n:fire" / 'n:"Fire Bolt"' → { field: Name, value: "fire" }; plain text →
// { field: null, value: "fire bolt" } which searches every field.
export function parseSearch(raw) {
  const s = String(raw || "");
  const m = s.match(/^\s*([a-zA-Z]):\s*(?:"([^"]*)"|(.*))$/);
  if (m) {
    const f = SEARCH_FIELDS.find((x) => x.key === m[1].toLowerCase());
    if (f) {
      const value = (m[2] !== undefined ? m[2] : m[3]).trim();
      return { field: f, value };
    }
  }
  return { field: null, value: s.trim() };
}

// Ranked matches: [{node, matched}] — best relevance first, ties alphabetical.
export function searchNodes(nodes, raw) {
  const { field, value } = parseSearch(raw);
  const q = normText(value);
  if (!q || !Array.isArray(nodes)) return [];
  const out = [];
  for (const n of nodes) {
    let matched = null;
    let score = 0;
    if (field) {
      const v = normText(n[field.field]);
      if (v.includes(q)) {
        matched = field.label;
        score = field.key === "n" ? (v === q ? 100 : v.startsWith(q) ? 80 : 60) : 50;
      }
    } else {
      const name = normText(n.name);
      const desc = normText(n.description);
      const flavor = normText(n.flavor);
      const talent = normText(n.talentType);
      const cat = normText(n.nodeType);
      const attr = normText(n.attributeStat);
      if (name === q) { matched = "Name"; score = 100; }
      else if (name.startsWith(q)) { matched = "Name"; score = 80; }
      else if (name.includes(q)) { matched = "Name"; score = 60; }
      else if (desc.includes(q)) { matched = "Description"; score = 40; }
      else if (talent.includes(q)) { matched = "Talent type"; score = 30; }
      else if (cat.includes(q)) { matched = "Category"; score = 25; }
      else if (attr.includes(q)) { matched = "Attribute"; score = 20; }
      else if (flavor.includes(q)) { matched = "Flavor"; score = 10; }
    }
    if (matched) out.push({ node: n, matched, score });
  }
  out.sort(
    (a, b) =>
      b.score - a.score ||
      String(a.node.name || "").localeCompare(String(b.node.name || ""))
  );
  return out;
}