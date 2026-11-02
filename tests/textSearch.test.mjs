import test from "node:test";
import assert from "node:assert/strict";
import { entryName, matchesQuery, normText } from "../src/lib/textSearch.js";

test("entryName extracts printable titles from every library shape", () => {
  assert.equal(entryName("Longsword"), "Longsword");
  assert.equal(entryName({ name: "Darkvision" }), "Darkvision");
  assert.equal(
    entryName({ name: "Aberration", description: "A creature type." }),
    "Aberration"
  );
  assert.equal(entryName({ name: { name: "Nested" } }), "Nested");
  assert.equal(entryName(null), "");
  assert.equal(entryName({ description: "No name" }), "");
});

test("entryName never returns an object that React cannot render", () => {
  for (const value of [
    { name: { name: "Two levels" } },
    [{ name: "ignored" }],
    { name: 42 },
    "",
    undefined,
  ]) {
    assert.equal(typeof entryName(value), "string");
  }
});

test("search folds case and accents", () => {
  assert.equal(normText("  Pokémon "), "pokemon");
  assert.equal(matchesQuery("Aberration", "aberr"), true);
  assert.equal(matchesQuery("Darkvision", "OBJECT"), false);
});
