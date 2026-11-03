import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_NODE_SIZE,
  MIN_NODE_SIZE,
  scaleNodeList,
  scaledNodeSize,
} from "../src/lib/nodeSizing.js";

test("percent changes scale each node proportionally", () => {
  assert.equal(scaledNodeSize(200, -20), 160);
  assert.equal(scaledNodeSize(100, -20), 80);
  assert.equal(scaledNodeSize(150, 10), 165);
  assert.equal(scaledNodeSize(150, 25), 188); // 187.5 rounds
  assert.equal(scaledNodeSize(40, -50), 20);
});

test("invalid percentages leave the size alone", () => {
  assert.equal(scaledNodeSize(100, 0), 100);
  assert.equal(scaledNodeSize(100, -100), null);
  assert.equal(scaledNodeSize(100, "nope"), null);
});

test("scaled sizes stay inside the usable range", () => {
  assert.equal(scaledNodeSize(100, -99), MIN_NODE_SIZE);
  assert.equal(scaledNodeSize(2000, 300), MAX_NODE_SIZE);
});

test("node lists and nested subtrees are scaled immutably", () => {
  const tree = {
    nodes: [
      { id: "a", size: 200 },
      { id: "b", size: 100, subtrees: [{ id: "s1", nodes: [{ id: "c", size: 50 }] }] },
      { id: "d" }, // no explicit size -> default 100
    ],
  };

  const scaled = scaleNodeList(tree.nodes, -20);

  assert.equal(scaled[0].size, 160);
  assert.equal(scaled[1].size, 80);
  assert.equal(scaled[1].subtrees[0].nodes[0].size, 40);
  assert.equal(scaled[2].size, 80);
  // The original tree is untouched for undo/redo.
  assert.equal(tree.nodes[0].size, 200);
  assert.equal(tree.nodes[1].subtrees[0].nodes[0].size, 50);
});
