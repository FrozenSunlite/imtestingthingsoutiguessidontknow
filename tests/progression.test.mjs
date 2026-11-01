import test from "node:test";
import assert from "node:assert/strict";
import { nodeMaxPoints, tierGate, tierPlan } from "../src/lib/nodeTiers.js";
import { stripLegacyAutoGrants } from "../src/lib/subtrees.js";
import { filterSpells, tableOptions, tableSummary } from "../src/lib/benefits.js";

test("tiers add up to Max Points and gate each level", () => {
  const node = {
    currentPoints: 1,
    tiers: [
      { level: 3, points: 1, label: "Tier 1" },
      { level: 5, points: 2, label: "Tier 2" },
    ],
  };
  assert.equal(nodeMaxPoints(node), 3);
  const plan = tierPlan(node);
  assert.equal(plan.active.level, 5);
  assert.equal(plan.index, 1);
  assert.equal(tierGate(node, 4).ok, false);
  assert.equal(tierGate(node, 5).ok, true);
});

test("a completed tier chain has nothing left to buy", () => {
  const node = { currentPoints: 2, tiers: [{ level: 1, points: 2 }] };
  const plan = tierPlan(node);
  assert.equal(plan.complete, true);
  assert.equal(tierGate(node, 20).ok, false);
});

test("legacy free subtree points are removed but manual points remain", () => {
  const tree = {
    nodes: [
      {
        id: "host",
        currentPoints: 1,
        subtrees: [
          {
            autoGrantFirst: true,
            nodes: [
              { id: "free", currentPoints: 1, __autoGranted: true },
              { id: "manual", currentPoints: 2, __autoGranted: true },
              { id: "kept", currentPoints: 1 },
            ],
          },
        ],
      },
    ],
  };
  const out = stripLegacyAutoGrants(tree);
  const subtree = out.nodes[0].subtrees[0];
  assert.equal(subtree.autoGrantFirst, undefined);
  assert.equal(subtree.nodes[0].currentPoints, 0);
  assert.equal(subtree.nodes[0].__autoGranted, undefined);
  assert.equal(subtree.nodes[1].currentPoints, 1);
  assert.equal(subtree.nodes[2].currentPoints, 1);
});

test("spell table filters by school and level relation", () => {
  const spells = [
    { name: "Fire Bolt", school: "Evocation", level: 0 },
    { name: "Fireball", school: "Evocation", level: 3 },
    { name: "Shield", school: "Abjuration", level: 1 },
  ];
  assert.deepEqual(
    filterSpells(spells, { schools: ["Evocation"], levelMode: "upTo", level: 1 }).map(
      (s) => s.name
    ),
    ["Fire Bolt"]
  );
  assert.deepEqual(
    filterSpells(spells, { levelMode: "equalOrGreater", level: 3 }).map((s) => s.name),
    ["Fireball"]
  );
});

test("custom tables list options and summarise the roll", () => {
  const table = {
    source: "custom",
    mode: "roll",
    die: "d6",
    optionsText: "Fire Bolt\nShield\n",
  };
  assert.deepEqual(tableOptions(table, []), ["Fire Bolt", "Shield"]);
  assert.match(tableSummary(table, []), /Roll d6/);
});
