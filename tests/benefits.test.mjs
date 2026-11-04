import test from "node:test";
import assert from "node:assert/strict";
import {
  BENEFIT_CATEGORIES,
  BENEFIT_CATEGORY_FOR_5E,
  benefitCategoryForDrop,
  spellTableForDrop,
} from "../src/lib/benefits.js";

test("dropped Reference Index categories map to useful benefit buckets", () => {
  assert.equal(benefitCategoryForDrop({ category: "spells", name: "Fireball" }), "spell");
  assert.equal(benefitCategoryForDrop({ category: "items", name: "Longsword" }), "equipment");
  assert.equal(benefitCategoryForDrop({ category: "feats", name: "Alert" }), "feature");
  assert.equal(benefitCategoryForDrop({ category: "optionalFeatures", name: "Maneuver" }), "feature");
  assert.equal(benefitCategoryForDrop({ category: "classes", name: "Fighter" }), "feature");
});

test("local library payloads keep their own benefit category", () => {
  assert.equal(benefitCategoryForDrop({ category: "skill", name: "Stealth" }), "skill");
  assert.equal(benefitCategoryForDrop({ category: "language", name: "Elvish" }), "language");
});

test("unknown categories fall back to Features", () => {
  assert.equal(benefitCategoryForDrop({ category: "not-a-real-category", name: "Thing" }), "feature");
  assert.equal(benefitCategoryForDrop(null), "feature");
});

test("every 5e mapping points at a rendered benefit category", () => {
  const rendered = new Set(BENEFIT_CATEGORIES.map((entry) => entry.id));
  for (const [category, target] of Object.entries(BENEFIT_CATEGORY_FOR_5E)) {
    assert.ok(rendered.has(target), `${category} -> ${target}`);
  }
});

test("dropped spell schools start a filtered, editable spell table", () => {
  const school = spellTableForDrop({ school: "Evocation" });
  assert.equal(school.source, "spells");
  assert.equal(school.mode, "choose");
  assert.equal(school.count, 1);
  assert.deepEqual(school.filters.schools, ["Evocation"]);
  assert.equal(school.filters.levelMode, "any");

  const subschool = spellTableForDrop({ subschool: "Dunamancy", parent: "Evocation" });
  assert.equal(subschool.filters.subschool, "Dunamancy");
  assert.deepEqual(subschool.filters.schools, ["Evocation"]);
});
