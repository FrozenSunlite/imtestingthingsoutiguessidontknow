import test from "node:test";
import assert from "node:assert/strict";
import { sharedSubtreeConflict } from "../src/lib/subtrees.js";

const makeSubtree = (points = [0, 0]) => ({
  id: "st",
  sharedId: "shared-1",
  exclusive: true,
  nodes: [
    { id: "return", __returnNode: true, dependencies: [] },
    { id: "a", name: "A", currentPoints: points[0], dependencies: [] },
    { id: "b", name: "B", currentPoints: points[1], dependencies: [] },
    { id: "a-child", name: "A child", currentPoints: 0, dependencies: ["a"] },
  ],
});

test("an exclusive shared subtree locks equivalent roots in other hosts", () => {
  const first = makeSubtree([1, 0]);
  const second = makeSubtree([0, 0]);
  const tree = {
    nodes: [
      { id: "host-1", subtrees: [first] },
      { id: "host-2", subtrees: [second] },
    ],
  };
  const conflict = sharedSubtreeConflict(
    tree,
    second,
    second.nodes.find((node) => node.id === "a"),
    "host-2"
  );
  assert.equal(conflict?.name, "A");
});

test("branches inside the same shared subtree do not conflict", () => {
  const first = makeSubtree([1, 0]);
  const second = makeSubtree([0, 0]);
  const tree = {
    nodes: [
      { id: "host-1", subtrees: [first] },
      { id: "host-2", subtrees: [second] },
    ],
  };
  const child = second.nodes.find((node) => node.id === "a-child");
  assert.equal(sharedSubtreeConflict(tree, second, child, "host-2"), null);
});

test("different shared subtrees do not conflict", () => {
  const first = makeSubtree([1, 0]);
  const second = { ...makeSubtree([0, 0]), sharedId: "shared-2" };
  const tree = {
    nodes: [
      { id: "host-1", subtrees: [first] },
      { id: "host-2", subtrees: [second] },
    ],
  };
  assert.equal(
    sharedSubtreeConflict(tree, second, second.nodes.find((node) => node.id === "a"), "host-2"),
    null
  );
});
