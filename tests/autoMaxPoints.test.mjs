import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAutoMaxPoints,
  applyAutoMaxPointsToTree,
  autoMaxPointsFor,
  countSubtreeNodes,
  isInvestableSubtreeNode,
} from "../src/lib/autoMaxPoints.js";
import { nodeMaxPoints, tiersForNode } from "../src/lib/nodeTiers.js";

const subtreeHost = () => ({
  id: "host",
  name: "Host",
  cost: 1,
  maxPoints: 1,
  subtrees: [
    {
      id: "s1",
      name: "First",
      nodes: [
        { id: "one", cost: 1, maxPoints: 1 },
        { id: "free", cost: 0, maxPoints: 1 },
        { id: "auto", cost: 1, maxPoints: 1, __autoGranted: true },
        { id: "return", cost: 0, maxPoints: 0, __returnNode: true },
        { id: "zero", cost: 0, maxPoints: 0 },
        { id: "info", cost: 1, maxPoints: 1, nodeType: "informative" },
        {
          id: "two",
          cost: 1,
          maxPoints: 1,
          subtrees: [
            {
              id: "s2",
              nodes: [{ id: "three", cost: 1, maxPoints: 1 }],
            },
          ],
        },
      ],
    },
    { id: "s2b", name: "Second", nodes: [{ id: "four", cost: 1, maxPoints: 1 }] },
  ],
});

test("subtree counting excludes free, auto-granted, return, informative and 0-point nodes", () => {
  const host = subtreeHost();
  assert.equal(isInvestableSubtreeNode({ cost: 0, maxPoints: 1 }), false);
  assert.equal(isInvestableSubtreeNode({ cost: 1, maxPoints: 1, __autoGranted: true }), false);
  assert.equal(isInvestableSubtreeNode({ cost: 1, maxPoints: 1 }), true);
  assert.equal(countSubtreeNodes(host.subtrees.flatMap((s) => s.nodes)), 4);
});

test("all subtrees versus one selected subtree", () => {
  const host = subtreeHost();
  host.maxPointsMode = "subtreeAll";
  assert.equal(autoMaxPointsFor(host), 4);
  host.maxPointsMode = "subtreeSelected";
  host.maxPointsSubtree = 0;
  assert.equal(autoMaxPointsFor(host), 3);
  host.maxPointsSubtree = 1;
  assert.equal(autoMaxPointsFor(host), 1);
  host.maxPointsBonus = 2;
  assert.equal(autoMaxPointsFor(host), 3);
});

test("tier count and tier count plus a flat bonus", () => {
  const node = {
    id: "tiered",
    cost: 1,
    maxPointsMode: "tiers",
    tiers: [
      { level: 1, points: 2, label: "One" },
      { level: 5, points: 2, label: "Two" },
      { level: 10, points: 2, label: "Three" },
    ],
  };
  assert.equal(autoMaxPointsFor(node), 3);
  assert.equal(autoMaxPointsFor({ ...node, maxPointsBonus: 2 }), 5);
});

test("applyAutoMaxPoints writes the formula result and rebalances tiers", () => {
  const host = subtreeHost();
  host.maxPointsMode = "subtreeAll";
  host.maxPointsBonus = 1;
  host.tiers = [
    { level: 1, points: 2, label: "One" },
    { level: 5, points: 2, label: "Two" },
  ];
  const [next] = applyAutoMaxPoints([host]);
  assert.equal(next.maxPoints, 5);
  assert.equal(nodeMaxPoints(next), 5);
  assert.equal(next.tiers.length, 2);
  assert.equal(next.tiers[0].level, 1);
  assert.equal(next.tiers[1].level, 5);
});

test("tier mode shrinks tier point costs to the tier count plus bonus", () => {
  const [next] = applyAutoMaxPoints([
    {
      id: "tiered",
      maxPointsMode: "tiers",
      maxPointsBonus: 1,
      tiers: [
        { level: 1, points: 2, label: "One" },
        { level: 5, points: 2, label: "Two" },
        { level: 10, points: 2, label: "Three" },
      ],
    },
  ]);
  assert.equal(next.maxPoints, 4);
  assert.deepEqual(
    next.tiers.map((tier) => tier.points),
    [1, 1, 2]
  );
  assert.equal(nodeMaxPoints(next), 4);
});

test("manual nodes stay untouched and zero-point bridges remain zero", () => {
  const manual = { id: "m", maxPoints: 7, cost: 1, tiers: [] };
  const [same] = applyAutoMaxPoints([manual]);
  assert.equal(same, manual);
  assert.equal(nodeMaxPoints({ maxPoints: 0, cost: 0 }), 0);
  assert.deepEqual(tiersForNode({ maxPoints: 0, cost: 0 }), []);
});

test("tree-level pass handles tabs and nested subtrees", () => {
  const host = subtreeHost();
  host.maxPointsMode = "subtreeAll";
  const tree = {
    nodes: [host],
    tabs: [
      { id: "a", nodes: [host] },
      { id: "b", nodes: [{ id: "tabHost", maxPointsMode: "subtreeAll", subtrees: host.subtrees, cost: 1, maxPoints: 1 }] },
    ],
  };
  const next = applyAutoMaxPointsToTree(tree);
  assert.equal(next.nodes[0].maxPoints, 4);
  assert.equal(next.tabs[1].nodes[0].maxPoints, 4);
});
