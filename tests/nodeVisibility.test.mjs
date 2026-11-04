import test from "node:test";
import assert from "node:assert/strict";
import { hiddenNodeIds, isHiddenForPlay } from "../src/lib/nodeVisibility.js";

test("explicitly hidden nodes are hidden", () => {
  const nodes = [
    { id: "a", hidden: true, dependencies: [] },
    { id: "b", dependencies: [] },
  ];
  assert.deepEqual([...hiddenNodeIds(nodes)], ["a"]);
  assert.equal(isHiddenForPlay(nodes[0], nodes), true);
  assert.equal(isHiddenForPlay(nodes[1], nodes), false);
});

test("a chain exclusively behind a hidden node is hidden", () => {
  const nodes = [
    { id: "a", hidden: true, dependencies: [] },
    { id: "b", dependencies: ["a"] },
    { id: "c", dependencies: ["b"] },
  ];
  assert.deepEqual([...hiddenNodeIds(nodes)].sort(), ["a", "b", "c"]);
});

test("a node with an alternate visible prerequisite stays visible", () => {
  const nodes = [
    { id: "a", hidden: true, dependencies: [] },
    { id: "b", dependencies: [] },
    { id: "c", dependencies: ["a", "b"] },
    { id: "d", dependencies: ["a"] },
  ];
  const hidden = hiddenNodeIds(nodes);
  assert.equal(hidden.has("a"), true);
  assert.equal(hidden.has("d"), true);
  assert.equal(hidden.has("c"), false);
});

test("cyclic malformed dependency data terminates", () => {
  const nodes = [
    { id: "a", hidden: true, dependencies: ["b"] },
    { id: "b", dependencies: ["a"] },
  ];
  assert.doesNotThrow(() => hiddenNodeIds(nodes));
  assert.deepEqual([...hiddenNodeIds(nodes)].sort(), ["a", "b"]);
});

test("no hidden nodes is a cheap empty set", () => {
  const nodes = [{ id: "a", dependencies: [] }, { id: "b", dependencies: ["a"] }];
  const hidden = hiddenNodeIds(nodes);
  assert.equal(hidden.size, 0);
});
