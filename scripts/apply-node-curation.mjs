// Apply a curated mechanical mapping to a project copy. Matching is by node
// name so it survives the project's duplicate tab snapshots.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const projectPath = resolve(process.argv[2] || "");
const mappingPath = resolve(process.argv[3] || "");
const outputPath = resolve(process.argv[4] || projectPath);
if (!process.argv[2] || !process.argv[3]) {
  console.error("Usage: node scripts/apply-node-curation.mjs project.json mapping.json [out.json]");
  process.exit(1);
}

const project = JSON.parse(readFileSync(projectPath, "utf8"));
const mapping = JSON.parse(readFileSync(mappingPath, "utf8")).nodes || {};
const tree = project.tree || project;
const seen = new Set();
let applied = 0;
let missing = new Set(Object.keys(mapping));

const apply = (node) => {
  const patch = mapping[node.name];
  if (!patch) return;
  seen.add(node.name);
  missing.delete(node.name);
  applied += 1;
  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) node[key] = value.map((entry) => ({ ...entry }));
    else node[key] = value;
  }
};

const visit = (nodes) => {
  for (const node of nodes || []) {
    apply(node);
    for (const subtree of node.subtrees || []) visit(subtree.nodes);
  }
};
visit(tree.nodes);
for (const tab of tree.tabs || []) visit(tab.nodes);
for (const side of Object.values(tree.sideTrees || {})) visit(side?.nodes || []);

writeFileSync(outputPath, `${JSON.stringify(project, null, 2)}\n`);
console.log(`Applied ${applied} node update(s) -> ${outputPath}`);
if (missing.size) console.log(`Missing nodes: ${[...missing].join(", ")}`);
