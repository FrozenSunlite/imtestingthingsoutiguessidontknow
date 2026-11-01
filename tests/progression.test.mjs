import test from "node:test";
import assert from "node:assert/strict";
import { nodeMaxPoints, tierGate, tierPlan } from "../src/lib/nodeTiers.js";
import {
  RETURN_NODE_NAME,
  cloneSubtreeForNode,
  makeReturnNode,
  migrateReturnNodes,
  snapshotSubtree,
  stripLegacyAutoGrants,
} from "../src/lib/subtrees.js";
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

test("the return node is not investable and keeps only its name", () => {
  const node = makeReturnNode();
  assert.equal(node.__returnNode, true);
  assert.equal(node.name, RETURN_NODE_NAME);
  assert.equal(node.description, "");
  assert.equal(nodeMaxPoints(node), 0);
  assert.equal(tierPlan(node).complete, true);
  assert.equal(tierGate(node, 20).ok, false);
});

test("legacy host-copy anchors migrate to return nodes", () => {
  const tree = {
    nodes: [
      {
        id: "host",
        subtrees: [
          {
            nodes: [
              { id: "old-anchor", __hostCopy: true, name: "Host" },
              { id: "child", currentPoints: 1 },
            ],
            connections: [{ id: "old-anchor->child", from: "old-anchor", to: "child" }],
          },
          { nodes: [{ id: "plain" }], connections: [] },
        ],
      },
    ],
  };
  const out = migrateReturnNodes(tree);
  const first = out.nodes[0].subtrees[0];
  const anchor = first.nodes.find((n) => n.id === "old-anchor");
  assert.equal(anchor.__returnNode, true);
  assert.equal(anchor.__hostCopy, undefined);
  assert.equal(anchor.name, RETURN_NODE_NAME);
  assert.equal(anchor.description, "");
  assert.equal(anchor.maxPoints, 0);
  assert.ok(first.connections.some((c) => c.from === "old-anchor" && c.to === "child"));
  // A subtree with no anchor gets one prepended.
  const second = out.nodes[0].subtrees[1];
  assert.equal(second.nodes[0].__returnNode, true);
  assert.equal(second.nodes[1].id, "plain");
});

test("shared subtrees clone independently for every host", () => {
  const source = {
    id: "shared",
    name: "Fighting Styles",
    exclusive: true,
    purchases: 4,
    grantedPoints: 3,
    nodes: [
      { id: "a", maxPoints: 1, currentPoints: 1, acquiredOrder: 9 },
      { id: "b", maxPoints: 1, dependencies: ["a"], exclusiveWith: ["a"] },
    ],
    connections: [{ id: "a->b", from: "a", to: "b" }],
  };
  const one = cloneSubtreeForNode(source);
  const two = cloneSubtreeForNode(source);
  assert.notEqual(one.id, two.id);
  assert.notEqual(one.nodes[0].id, two.nodes[0].id);
  assert.equal(one.nodes[0].currentPoints, 0);
  assert.equal(one.nodes[0].acquiredOrder, undefined);
  assert.equal(one.purchases, 0);
  assert.equal(one.exclusive, true);
  assert.deepEqual(one.nodes[1].dependencies, [one.nodes[0].id]);
  assert.deepEqual(one.nodes[1].exclusiveWith, [one.nodes[0].id]);
  // Mutating one clone must not touch the source or the other clone.
  one.exclusive = false;
  assert.equal(two.exclusive, true);
  assert.equal(source.exclusive, true);
});

test("snapshots drop play state but keep the subtree structure", () => {
  const snap = snapshotSubtree(
    {
      name: "Original",
      purchases: 2,
      exclusive: false,
      nodes: [
        makeReturnNode(),
        { id: "n1", currentPoints: 3, maxPoints: 3 },
      ],
      connections: [],
    },
    "Saved"
  );
  assert.equal(snap.name, "Saved");
  assert.equal(snap.purchases, 0);
  assert.equal(snap.exclusive, false);
  assert.equal(snap.nodes[0].__returnNode, true);
  assert.equal(snap.nodes[1].currentPoints, 0);
});
