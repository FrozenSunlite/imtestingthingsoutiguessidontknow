import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const seed = JSON.parse(
  readFileSync(new URL("../public/srd/srd-seed.json", import.meta.url), "utf8")
);

test("bundled SRD seed is populated and attributed", () => {
  assert.equal(seed.version, 1);
  assert.ok(seed.library.monsters.length > 300);
  assert.ok(seed.library.spells.length > 300);
  assert.ok(seed.library.weapons.length > 20);
  assert.match(seed.attribution.srd51, /Creative Commons Attribution 4\.0/);
  assert.match(seed.attribution.srd52, /Creative Commons Attribution 4\.0/);
  assert.match(seed.attribution.srd51, /System Reference Document 5\.1/);
  assert.match(seed.attribution.srd52, /System Reference Document 5\.2/);
});

test("bundled SRD seed carries no artwork", () => {
  const artKeys = [];
  const walk = (value, path) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (/^(image|images|token|fluffImages|portrait)$/i.test(key) && child) {
        artKeys.push(`${path}.${key}`);
      }
      walk(child, `${path}.${key}`);
    }
  };
  walk(seed, "seed");
  assert.deepEqual(artKeys, []);
});

test("every seeded list entry records its SRD edition", () => {
  for (const [key, value] of Object.entries(seed.library)) {
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      assert.equal(
        entry.srdEdition === "5.1" || entry.srdEdition === "5.2",
        true,
        `${key}: ${entry.name} has no SRD edition`
      );
    }
  }
});
