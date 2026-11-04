// Split leading flavor prose out of node descriptions without touching the
// original project. The output keeps mechanics in `description`, moves the
// color text to `flavor`, and writes an audit report for effects that still
// need structured sheet fields.
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith("--"));
const arg = (name, fallback = "") => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
};
if (!input) {
  console.error('Usage: node scripts/split-node-flavor.mjs "project.json" [--out "project - rules.json"]');
  process.exit(1);
}

const inputPath = resolve(input);
const defaultOut = join(
  dirname(inputPath),
  `${basename(inputPath, ".json")} - Rules Split.json`
);
const outputPath = resolve(arg("out", defaultOut));
const reportPath = resolve(arg("report", join("Saves", "rules-flavor-report.json")));

const MECH = new RegExp(
  [
    "\\bhit points?\\b",
    "\\btemporary hit points?\\b",
    "\\barmor class\\b",
    "\\bac\\b",
    "\\bhp\\b",
    "\\bspeed\\b",
    "\\bsaving throws?\\b",
    "\\bsaves?\\b",
    "\\battack(?:s| roll| rolls)?\\b",
    "\\bdamage\\b",
    "\\bbonus action\\b",
    "\\breaction\\b",
    "\\baction\\b",
    "\\bproficien(?:t|cy)\\b",
    "\\b(?:have|has|gain|gains|grant|grants|impose|imposes) advantage\\b",
    "\\badvantage (?:on|against|to)\\b",
    "\\b(?:have|has|gain|gains|grant|grants|impose|imposes) disadvantage\\b",
    "\\bdisadvantage (?:on|against|to)\\b",
    "\\bchecks?\\b",
    "\\bdc\\b",
    "\\bspell slots?\\b",
    "\\bspells?\\b",
    "\\bcantrips?\\b",
    "\\brests?\\b",
    "\\blevels?\\b",
    "\\bfeet\\b",
    "\\bft\\.?\\b",
    "\\bd\\d+\\b",
    "\\brounds?\\b",
    "\\bturns?\\b",
    "\\bminutes?\\b",
    "\\bhours?\\b",
    "\\bdays?\\b",
    "\\bresistance to\\b",
    "\\b(?:have|has|gain|gains) resistance\\b",
    "\\bimmunity\\b",
    "\\bvulnerability\\b",
    "\\bcondition\\b",
    "\\bgrapple\\b",
    "\\bprone\\b",
    "\\bmovement\\b",
    "\\brange\\b",
    "\\breach\\b",
    "\\btargets?\\b",
    "\\bcreatures?\\b",
    "\\bweapons?\\b",
    "\\barmor\\b",
    "\\btools?\\b",
    "\\blanguages?\\b",
    "\\bskills?\\b",
    "\\binitiative\\b",
    "\\bability scores?\\b",
    "\\bmodifiers?\\b",
    "\\bexpertise\\b",
    "\\bthis (?:trait|feature|ability)\\b",
    "\\b(?:you|they) (?:gain|gains|grant|grants|expend|expends|regain|regains|roll|rolls|add|adds|subtract|subtracts|increase|increases|decrease|decreases|reduce|reduces|ignore|ignores|become|becomes|suffer|suffers|deal|deals|heal|heals|move|moves|cast|casts|create|creates|summon|summons|teleport|teleports|activate|activates|trigger|triggers)\\b",
  ].join("|"),
  "i"
);

const splitSentences = (text) => {
  // Keep abbreviations such as "ft." and "e.g." from producing fake sentence
  // breaks while still splitting ordinary prose.
  return String(text || "")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"'(])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
};

const isMechanical = (sentence) => MECH.test(sentence);

const normalizeRules = (text) =>
  String(text || "")
    .replace(/\bAs a Bonus Action\b/g, "As a bonus action")
    .replace(/\bBonus Action\b/g, "bonus action")
    .replace(/\bAs a Reaction\b/g, "As a reaction")
    .replace(/\bReaction\b/g, "reaction")
    .replace(/\bLong Rest\b/g, "long rest")
    .replace(/\bShort Rest\b/g, "short rest")
    .replace(/\bAdvantage\b/g, "advantage")
    .replace(/\bDisadvantage\b/g, "disadvantage")
    .replace(/\bHit Points\b/g, "hit points")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();

function splitFlavor(description, existingFlavor = "") {
  const text = String(description || "").trim();
  if (!text) return { description: text, flavor: existingFlavor, moved: 0 };
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const flavorParts = [];
  const rulesParts = [];
  let foundMechanical = false;

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    if (foundMechanical) {
      rulesParts.push(paragraph);
      continue;
    }
    const sentences = splitSentences(paragraph);
    let cursor = 0;
    while (cursor < sentences.length && !isMechanical(sentences[cursor])) {
      cursor += 1;
    }
    if (cursor < sentences.length) {
      foundMechanical = true;
      if (cursor) flavorParts.push(sentences.slice(0, cursor).join(" "));
      rulesParts.push(sentences.slice(cursor).join(" "));
      continue;
    }
    // No mechanics in this paragraph. If a later paragraph has mechanics, this
    // is introductory flavor; otherwise keep it as the node's only rules text.
    const laterMechanical = paragraphs
      .slice(index + 1)
      .some((later) => splitSentences(later).some(isMechanical));
    if (laterMechanical) flavorParts.push(paragraph);
    else rulesParts.push(paragraph);
  }

  const moved = flavorParts.length;
  if (!moved || !rulesParts.length) {
    return { description: text, flavor: existingFlavor, moved: 0 };
  }
  return {
    description: normalizeRules(rulesParts.join("\n\n")),
    flavor: [existingFlavor, flavorParts.join("\n\n")].filter(Boolean).join("\n\n"),
    moved,
  };
}

const project = JSON.parse(readFileSync(inputPath, "utf8"));
const tree = project.tree || project;
const seen = new Set();
const stats = {
  input: inputPath,
  output: outputPath,
  nodes: 0,
  updated: 0,
  flavorParagraphsMoved: 0,
  noMechanicalLanguage: 0,
  alreadyFlavor: 0,
  withActions: 0,
  withBenefits: 0,
  withProficiencies: 0,
  withGrants: 0,
  withResources: 0,
};

function visit(nodes) {
  for (const node of nodes || []) {
    if (!node || typeof node !== "object") continue;
    if (!seen.has(node.id)) {
      seen.add(node.id);
      stats.nodes += 1;
      const hadFlavor = !!String(node.flavor || "").trim();
      if (hadFlavor) stats.alreadyFlavor += 1;
      const result = splitFlavor(node.description, node.flavor || "");
      if (result.moved) {
        node.description = result.description;
        node.flavor = result.flavor;
        stats.updated += 1;
        stats.flavorParagraphsMoved += result.moved;
      } else if (node.description && !splitSentences(node.description).some(isMechanical)) {
        stats.noMechanicalLanguage += 1;
      }
      if ((node.actions || []).length) stats.withActions += 1;
      if ((node.benefits || []).length) stats.withBenefits += 1;
      if ((node.proficiencies || []).length) stats.withProficiencies += 1;
      if ((node.grants || []).length) stats.withGrants += 1;
      if ((node.resources || []).length) stats.withResources += 1;
    }
    for (const subtree of node.subtrees || []) visit(subtree.nodes || []);
  }
}

visit(tree.nodes);
for (const tab of tree.tabs || []) visit(tab.nodes);
for (const side of Object.values(tree.sideTrees || {})) visit(side?.nodes || []);

writeFileSync(outputPath, `${JSON.stringify(project, null, 2)}\n`);
writeFileSync(reportPath, `${JSON.stringify(stats, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
console.log(`Report ${reportPath}`);
console.log(JSON.stringify(stats, null, 2));
