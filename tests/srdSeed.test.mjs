import test from "node:test";
import assert from "node:assert/strict";
import { mergeSrdSeed } from "../src/lib/srdSeed.js";

const seed = {
  library: {
    monsters: [
      { name: "Goblin", hp: 7 },
      { name: "Adult Red Dragon", hp: 256 },
    ],
    spells: [{ name: "Fireball", level: "3" }],
    lists: {
      languages: ["Common", "Dwarvish"],
      skills: [{ name: "Arcana", ability: "INT" }],
    },
    fiveETools: {
      backgrounds: [{ name: "Acolyte", source: "SRD" }],
    },
  },
};

test("SRD seed adds missing entries without overwriting edits", () => {
  const library = {
    monsters: [{ name: "Goblin", hp: 99, note: "my edit" }],
    spells: [],
    lists: { languages: ["Common"], skills: [] },
    fiveETools: { backgrounds: [{ name: "Acolyte", source: "SRD", note: "edited" }] },
  };
  const { library: next, added } = mergeSrdSeed(library, seed);
  assert.equal(next.monsters.length, 2);
  assert.equal(next.monsters[0].hp, 99);
  assert.equal(next.monsters[0].note, "my edit");
  assert.equal(next.monsters[1].name, "Adult Red Dragon");
  assert.equal(next.spells[0].name, "Fireball");
  assert.deepEqual(next.lists.languages, ["Common", "Dwarvish"]);
  assert.equal(next.lists.skills[0].name, "Arcana");
  assert.equal(next.fiveETools.backgrounds.length, 1);
  assert.equal(next.fiveETools.backgrounds[0].note, "edited");
  assert.equal(added, 4);
});

test("SRD seed is idempotent", () => {
  const first = mergeSrdSeed({}, seed);
  const second = mergeSrdSeed(first.library, seed);
  assert.equal(second.added, 0);
  assert.equal(second.library.monsters.length, 2);
});
