// Spell helpers shared by the Reference Library, the character sheet's Spell
// List, and Cast a Spell actions.

// Map a spell's casting time to the action category it takes, e.g.
// "1 bonus action" → "bonus". Any other time (1 minute, 1 hour, 1 day…)
// falls back to the normal Cast a Spell action.
export function parseCastingTime(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return { category: null, label: "" };
  if (t.includes("bonus")) return { category: "bonus", label: text };
  if (t.includes("reaction")) return { category: "reaction", label: text };
  if (t.includes("free")) return { category: "free", label: text };
  return { category: "action", label: text };
}

// Required named material components (comma-separated in the field).
export function materialItemsOf(spell) {
  return String(spell?.materialItems || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Does the character have everything this spell's material components need?
// Checks named inventory items (with qty > 0) and a gold cost against coins.
export function materialStatus(spell, character = {}) {
  const s = spell || {};
  const cost = Number(s.materialCost) || 0;
  const items = materialItemsOf(s);
  if (!s.m || (items.length === 0 && cost <= 0)) {
    return { ok: true, missing: [], goldShort: false, cost, items };
  }
  const inventory = character.inventory || [];
  const missing = items.filter(
    (name) =>
      !inventory.some(
        (it) =>
          String(it?.name || "").toLowerCase() === name.toLowerCase() &&
          (Number(it?.qty) || 1) > 0
      )
  );
  const goldShort = cost > 0 && (Number(character?.coins?.gold) || 0) < cost;
  return { ok: missing.length === 0 && !goldShort, missing, goldShort, cost, items };
}

// Consume this spell's materials on a cast: remove one unit of each named
// item (dropping items that hit 0) and subtract the gold cost. Returns
// { inventory, coins } to merge into a setCharacter patch, or null when
// nothing is consumed.
export function consumeMaterials(spell, character = {}) {
  const s = spell || {};
  const cost = Number(s.materialCost) || 0;
  if (!s.m || (!s.materialConsumed && cost <= 0)) return null;
  let inventory = [...(character.inventory || [])];
  if (s.materialConsumed) {
    materialItemsOf(s).forEach((name) => {
      const idx = inventory.findIndex(
        (it) => String(it?.name || "").toLowerCase() === name.toLowerCase()
      );
      if (idx >= 0) {
        const qty = (Number(inventory[idx].qty) || 1) - 1;
        if (qty <= 0) inventory.splice(idx, 1);
        else inventory[idx] = { ...inventory[idx], qty };
      }
    });
  }
  let coins = character.coins;
  if (cost > 0) {
    coins = { ...(character.coins || {}) };
    coins.gold = Math.max(0, (Number(coins.gold) || 0) - cost);
  }
  return { inventory, coins };
}

// Stat modifier for a derived-sheet value (the effective, node-adjusted score).
const sheetMod = (stat, sheet = {}) =>
  Math.floor((Number(sheet?.[stat]?.final ?? 10) - 10) / 2);

// Spell-attack and save-DC bonuses from wondrous items (type "Special").
// Equipped or carried items count; anything stored away or in a chest doesn't.
export function wondrousSpellBonuses(character = {}) {
  const active = (loc) => !loc || loc === "equipped" || loc === "carried";
  return (character.inventory || []).reduce(
    (acc, it) =>
      it?.type === "Special" && active(it.location)
        ? {
            attack: acc.attack + (Number(it.spellAttackBonus) || 0),
            dc: acc.dc + (Number(it.saveDCBonus) || 0),
          }
        : acc,
    { attack: 0, dc: 0 }
  );
}

// Attack bonus and save DC for a spell, from its chosen casting stat: the
// sheet's "Spell Attacks"/"Save DCs" values (proficiency + the character's
// default casting stat, plus any node-resource contributions), shifted when
// the spell uses a different casting stat, plus wondrous-item bonuses.
export function spellNumbers(spell = {}, character = {}, sheet = {}) {
  const def = character.spellStat || "CHA";
  const st = spell.spellStat || def;
  const shift = sheetMod(st, sheet) - sheetMod(def, sheet);
  const wb = wondrousSpellBonuses(character);
  return {
    stat: st,
    attack: Number(sheet["Spell Attacks"]?.final ?? 0) + shift + wb.attack,
    dc: Number(sheet["Save DCs"]?.final ?? 8) + shift + wb.dc,
  };
}

// "20-foot-radius Sphere" style text from the structured AoE fields, falling
// back to the spell's free-text aoe field for anything non-standard or older.
export function aoeText(spell = {}) {
  const shape = spell.aoeShape;
  if (!shape) return spell.aoe || "";
  const size = Number(spell.aoeSize) || 0;
  if (!size) return shape;
  if (shape === "Sphere" || shape === "Cylinder" || shape === "Emanation") {
    const measure = spell.aoeMeasure === "diameter" ? "diameter" : "radius";
    return `${size}-foot-${measure} ${shape}`;
  }
  return `${size}-foot ${shape}`;
}

// "V, S, M (300 gp, diamond — consumed)" style component summary.
export function componentsText(spell) {
  const s = spell || {};
  const parts = [];
  if (s.v) parts.push("V");
  if (s.s) parts.push("S");
  if (s.m) {
    const bits = [];
    if (Number(s.materialCost) > 0) bits.push(`${s.materialCost} gp`);
    materialItemsOf(s).forEach((i) => bits.push(i));
    if (s.materialConsumed && bits.length) bits.push("consumed");
    parts.push(bits.length ? `M (${bits.join(", ")})` : "M");
  }
  return parts.join(", ");
}