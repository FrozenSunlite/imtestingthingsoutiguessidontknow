// Audit a project's freeform node descriptions for mechanical effects that are
// not represented by the structured sheet fields. This is read-only.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const input = process.argv[2];
const output = process.argv[3] || "Saves/rules-effects-audit.json";
if (!input) {
  console.error("Usage: node scripts/audit-node-effects.mjs project.json [report.json]");
  process.exit(1);
}

const project = JSON.parse(readFileSync(input, "utf8"));
const tree = project.tree || project;
const seen = new Set();
const nodes = [];
const visit = (list) => {
  for (const node of list || []) {
    if (!node || typeof node !== "object") continue;
    if (!seen.has(node.id)) {
      seen.add(node.id);
      nodes.push(node);
    }
    for (const subtree of node.subtrees || []) visit(subtree.nodes);
  }
};
visit(tree.nodes);
for (const tab of tree.tabs || []) visit(tab.nodes);
for (const side of Object.values(tree.sideTrees || {})) visit(side?.nodes || []);

const patterns = {
  hitPoints: /hit point maximum|maximum hit points?/i,
  armorClass: /armor class|(?:\+|\bplus\s+)\d+\s+(?:bonus to\s+)?ac\b|\bac\b/i,
  initiative: /initiative/i,
  speed: /\bspeed\b|walking speed|flying speed|swimming speed/i,
  savingThrows: /saving throw|save\b/i,
  skills: /proficien(?:t|cy) in (?:the )?(?:[A-Z][a-z]+|skill)/i,
  tools: /proficien(?:t|cy) with/i,
  languages: /language/i,
  attacks: /attack roll|weapon attack|spell attack/i,
  damage: /\bdamage\b/i,
  advantage: /\badvantage\b|\bdisadvantage\b/i,
  actions: /as an? (?:bonus )?action|as a reaction|magic action/i,
  resources: /uses?\b|per (?:short|long) rest|recharge|regain/i,
  resistances: /resistance|immunity|vulnerab/i,
  spells: /\bspells?\b|cantrip|spell slot/i,
  dice: /\bd\d+\b/i,
};

const results = nodes.map((node) => {
  const text = String(node.description || "");
  const flags = Object.fromEntries(
    Object.entries(patterns)
      .filter(([, re]) => re.test(text))
      .map(([key]) => [key, true])
  );
  const structured = {
    actions: (node.actions || []).length,
    benefits: (node.benefits || []).length,
    proficiencies: (node.proficiencies || []).length,
    grants: (node.grants || []).length,
    resources: (node.resources || []).length,
  };
  const missing = Object.values(structured).every((count) => count === 0);
  return {
    name: node.name,
    talentType: node.talentType || "",
    flags,
    structured,
    missingStructuredEffects: missing && Object.keys(flags).length > 0,
  };
});

const summary = {
  nodes: nodes.length,
  nodesWithNoStructuredEffects: results.filter((r) => r.missingStructuredEffects).length,
  nodesWithAnyStructuredEffects: results.filter((r) => !Object.values(r.structured).every((n) => n === 0)).length,
  flagCounts: Object.fromEntries(
    Object.keys(patterns).map((key) => [key, results.filter((r) => r.flags[key]).length])
  ),
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify({ summary, results }, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
console.log(`Report: ${output}`);
