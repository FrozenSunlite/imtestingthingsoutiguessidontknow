import test from "node:test";
import assert from "node:assert/strict";
import { isAvailable, isBridgeNode } from "../src/lib/geometry.js";

const nodesById = (list) => Object.fromEntries(list.map((n) => [n.id, n]));

test("a zero-point zero-cost node is a bridge", () => {
  assert.equal(isBridgeNode({ maxPoints: 0, cost: 0 }), true);
  assert.equal(isBridgeNode({ maxPoints: 0, cost: 1 }), false);
  assert.equal(isBridgeNode({ maxPoints: 1, cost: 0 }), false);
  assert.equal(isBridgeNode({ maxPoints: undefined, cost: 0 }), false);
});

test("a bridge passes availability to the next node without points", () => {
  const a = { id: "a", maxPoints: 1, cost: 1, currentPoints: 0 };
  const bridge = {
    id: "bridge",
    maxPoints: 0,
    cost: 0,
    currentPoints: 0,
    dependencies: ["a"],
  };
  const b = {
    id: "b",
    maxPoints: 1,
    cost: 1,
    currentPoints: 0,
    dependencies: ["bridge"],
  };
  const byId = nodesById([a, bridge, b]);

  assert.equal(isAvailable(bridge, byId), false);
  assert.equal(isAvailable(b, byId), false);

  a.currentPoints = 1;
  assert.equal(isAvailable(bridge, byId), true);
  assert.equal(isAvailable(b, byId), true);

  a.currentPoints = 0;
  assert.equal(isAvailable(b, byId), false);
});

test("a free bridge with no prerequisites is immediately available", () => {
  const bridge = { id: "bridge", maxPoints: 0, cost: 0, currentPoints: 0 };
  const b = {
    id: "b",
    maxPoints: 1,
    cost: 1,
    currentPoints: 0,
    dependencies: ["bridge"],
  };
  const byId = nodesById([bridge, b]);
  assert.equal(isAvailable(bridge, byId), true);
  assert.equal(isAvailable(b, byId), true);
});

test("a zero-cost node that still needs a point is not a bridge", () => {
  const free = { id: "free", maxPoints: 1, cost: 0, currentPoints: 0 };
  const b = {
    id: "b",
    maxPoints: 1,
    cost: 1,
    currentPoints: 0,
    dependencies: ["free"],
  };
  const byId = nodesById([free, b]);
  assert.equal(isAvailable(free, byId), true);
  assert.equal(isAvailable(b, byId), false);
});

test("cyclic malformed bridge data does not recurse forever", () => {
  const a = {
    id: "a",
    maxPoints: 0,
    cost: 0,
    dependencies: ["b"],
  };
  const b = {
    id: "b",
    maxPoints: 0,
    cost: 0,
    dependencies: ["a"],
  };
  const byId = nodesById([a, b]);
  assert.equal(isAvailable(a, byId), false);
  assert.equal(isAvailable(b, byId), false);
});
