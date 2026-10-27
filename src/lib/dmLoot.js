// Shared engine for the DM Screen's loot and encounter rolling: dice-style
// quantities ("1d6+2"), recursive loot pool resolution and encounter rolls.

// Loot pool entry item categories, each with a getter for its library list.
export const LOOT_CATEGORIES = [
  ["weapons", "Weapons", (lib) => lib.weapons || []],
  ["armor", "Armor", (lib) => lib.armor || []],
  ["poisons", "Poisons", (lib) => lib.poisons || []],
  ["explosives", "Explosives", (lib) => lib.explosives || []],
  ["adventuringGear", "Adventuring Gear", (lib) => lib.adventuringGear || []],
  ["ammo", "Ammunition", (lib) => lib.ammo || []],
  ["trinkets", "Trinkets", (lib) => lib.trinkets || []],
  ["wondrousItems", "Wondrous Items", (lib) => lib.wondrousItems || []],
];
export const catLabel = (key) => LOOT_CATEGORIES.find(([k]) => k === key)?.[1] || key;

// DEX modifier from a "STR 18, DEX 11, …" ability string — the initiative bonus.
export function dexMod(abilities) {
  const m = String(abilities || "").match(/DEX\s*[:=]?\s*(-?\d+)/i);
  return m ? Math.floor((Number(m[1]) - 10) / 2) : 0;
}

// "45 (7d8+14)" → 45
export function parseMaxHp(hp) {
  const n = parseInt(String(hp ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}

// "1/2" → 0.5, "13" → 13
export function crNum(cr) {
  const s = String(cr ?? "").trim();
  if (s.includes("/")) {
    const [a, b] = s.split("/").map(Number);
    return b > 0 ? a / b : 0;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : -1;
}

// A quantity or count: a plain number ("3") or a dice expression ("1d6+2").
// Anything unparsable rolls as 1.
export function rollExpr(expr) {
  const s = String(expr ?? "").trim().toLowerCase().replace(/\s+/g, "");
  const m = s.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (m) {
    const n = Math.min(100, Math.max(1, parseInt(m[1] || "1", 10)));
    const size = Math.max(1, parseInt(m[2], 10));
    let total = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * size)).reduce(
      (a, b) => a + b,
      0
    );
    if (m[3]) total += parseInt(m[3], 10);
    return total;
  }
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

// Roll one loot pool recursively: pick a random entry, roll its quantity;
// an entry that is another pool is rolled that many times, recursing down
// until every branch ends in decided loot. Returns { lines, error } where
// each line is { qty, name, category, via } and via is the pool path taken.
export function rollLootPool(poolName, pools, depth = 0, path = []) {
  if (depth > 12)
    return { lines: [], error: "Rolled more than 12 table levels deep." };
  if (path.includes(poolName))
    return { lines: [], error: `Circular reference: ${[...path, poolName].join(" → ")}` };
  const pool = (pools || []).find((p) => p.name === poolName);
  if (!pool) return { lines: [], error: `Loot pool "${poolName}" not found.` };
  const entries = (pool.entries || []).filter((e) => e?.name);
  if (!entries.length) return { lines: [], error: `Loot pool "${poolName}" is empty.` };

  const e = entries[Math.floor(Math.random() * entries.length)];
  const qty = rollExpr(e.qty);
  const lines = [];
  if (e.kind === "table") {
    for (let i = 0; i < qty; i++) {
      const r = rollLootPool(e.name, pools, depth + 1, [...path, poolName]);
      lines.push(...r.lines);
      if (r.error) return { lines, error: r.error };
    }
    return { lines, error: null };
  }
  lines.push({
    qty,
    name: e.name,
    category: e.kind === "item" ? catLabel(e.category) : "",
    via: [...path, poolName],
  });
  return { lines, error: null };
}

// Roll an encounter table: each row's count is rolled (dice allowed) and the
// surviving monsters are returned as [{ monster, count }].
export function rollEncounter(table) {
  return (table.rows || [])
    .filter((r) => r?.monster)
    .map((r) => ({ monster: r.monster, count: rollExpr(r.count) }))
    .filter((r) => r.count > 0);
}