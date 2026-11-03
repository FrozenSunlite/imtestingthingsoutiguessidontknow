import test from "node:test";
import assert from "node:assert/strict";
import {
  conditionToStatus,
  entriesFromRaw,
  entryName,
  featuresForEntry,
  fiveText,
  itemToLibrary,
  spellToLibrary,
  tableToRollTable,
} from "../src/lib/fiveETools.js";

// Malformed homebrew should be ignored or coerced, never take down the app.

test("fiveText tolerates scalar fields where 5eTools expects lists", () => {
  assert.doesNotThrow(() => fiveText({ type: "list", items: "not-an-array" }));
  assert.doesNotThrow(() =>
    fiveText({ type: "options", entries: "not-an-array" })
  );
  assert.doesNotThrow(() =>
    fiveText({ type: "table", rows: "not-an-array", colLabels: {} })
  );
  assert.match(
    fiveText({ type: "list", items: "one item" }),
    /one item/
  );
});

test("entryName never returns an object", () => {
  assert.equal(entryName({ name: { nested: true } }), "Untitled");
  assert.equal(entryName({ title: "Real Title" }), "Real Title");
});

test("spell conversion survives bad scalar and list fields", () => {
  assert.equal(spellToLibrary(null), null);
  const spell = spellToLibrary({
    name: "Bad Spell",
    level: {},
    school: [],
    time: [null, "x", {}],
    range: { distance: "x" },
    duration: [null, {}],
    components: { m: 5 },
    savingThrow: [{ bad: true }],
  });
  assert.equal(spell.name, "Bad Spell");
  assert.equal(spell.level, "");
  assert.equal(spell.school, "");
  assert.equal(spell.saveAbility, "");
});

test("item conversion accepts a scalar property list", () => {
  const item = itemToLibrary({
    name: "Bad Item",
    type: "M",
    property: "Versatile",
    dmg1: {},
    rarity: "none",
  });
  assert.equal(item.key, "weapons");
  assert.deepEqual(item.value.properties, ["Versatile"]);
});

test("table conversion accepts scalar rows", () => {
  assert.equal(tableToRollTable({ name: "Bad Table", rows: "nope", colLabels: {} }), null);
  const table = tableToRollTable({
    name: "Scalar Table",
    rows: [{ row: "bad" }, null, "x"],
    colLabels: "bad",
  });
  assert.equal(table.rows.length, 2);
});

test("feature extraction ignores null and non-object entries", () => {
  assert.deepEqual(featuresForEntry("classes", null, null), []);
  assert.deepEqual(
    featuresForEntry("classes", { name: "C" }, { classFeature: { not: "array" } }),
    []
  );
});

test("conditions with object names are skipped", () => {
  assert.equal(conditionToStatus({ name: { bad: true } }), null);
});

test("entriesFromRaw handles every malformed wrapper shape", () => {
  for (const value of [null, 0, "x", {}, { monster: "x" }, { monster: [null] }]) {
    assert.doesNotThrow(() => entriesFromRaw(value));
  }
});
