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

const CR_NUM = (cr) => {
  const s = String(cr ?? "").trim();
  if (s === "1/8") return 0.125;
  if (s === "1/4") return 0.25;
  if (s === "1/2") return 0.5;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const weightedRow = (rows) => {
  const list = (rows || []).filter((r) => r && (r.monster || r.tag));
  if (!list.length) return null;
  const total = list.reduce((sum, r) => sum + Math.max(1, Number(r.weight) || 1), 0);
  let roll = Math.random() * total;
  for (const row of list) {
    roll -= Math.max(1, Number(row.weight) || 1);
    if (roll < 0) return row;
  }
  return list[list.length - 1];
};

// Roll an encounter table: each row's count is rolled (dice allowed) and the
// surviving monsters are returned as [{ monster, count }]. A row can name a
// specific monster or a tag/category; tag rows resolve to a random monster
// carrying that tag, type or category. Weighted tables choose one entry first,
// like a classic d100 encounter table.
export function rollEncounter(table, monsters = []) {
  const minCR = table?.crMin != null && table.crMin !== "" ? CR_NUM(table.crMin) : null;
  const maxCR = table?.crMax != null && table.crMax !== "" ? CR_NUM(table.crMax) : null;
  const rows =
    table?.mode === "weighted" ? [weightedRow(table.rows)].filter(Boolean) : table?.rows || [];
  return rows
    .map((r) => {
      if (!r) return null;
      let name = r.monster || r.tag || "";
      if (!name) return null;
      if (r.kind === "tag" || r.tag) {
        const tag = String(r.tag || r.monster || "").toLowerCase();
        const pool = (monsters || []).filter((m) => {
          const value = CR_NUM(m?.cr);
          if (minCR != null && value < minCR) return false;
          if (maxCR != null && value > maxCR) return false;
          const hay = [
            m?.type,
            m?.category,
            ...(Array.isArray(m?.tags) ? m.tags : []),
          ]
            .filter(Boolean)
            .map((x) => String(x).toLowerCase());
          return hay.some((h) => h === tag || h.includes(tag));
        });
        if (pool.length) {
          name = pool[Math.floor(Math.random() * pool.length)].name;
        }
      }
      return { monster: name, count: rollExpr(r.count) };
    })
    .filter((r) => r && r.count > 0);
}