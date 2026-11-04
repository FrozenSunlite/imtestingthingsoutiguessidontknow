import test from "node:test";
import assert from "node:assert/strict";
import { collectNodePassives } from "../src/lib/passives.js";

test("passives appear only after their minimum investment", () => {
  const tree = {
    nodes: [
      {
        id: "n1",
        name: "Trait",
        currentPoints: 1,
        passives: [
          { name: "Base", minPoints: 1, description: "Always" },
          { name: "Upgrade", minPoints: 2, description: "Second point" },
        ],
      },
    ],
  };
  const passives = collectNodePassives(tree);
  assert.deepEqual(passives.map((p) => p.name), ["Base"]);
  tree.nodes[0].currentPoints = 2;
  assert.deepEqual(
    collectNodePassives(tree).map((p) => p.name),
    ["Base", "Upgrade"]
  );
});

test("uninvested and unnamed passives are ignored", () => {
  const tree = {
    nodes: [
      { id: "a", name: "Off", currentPoints: 0, passives: [{ name: "Hidden" }] },
      { id: "b", name: "On", currentPoints: 1, passives: [{ name: "" }] },
    ],
  };
  assert.deepEqual(collectNodePassives(tree), []);
});
