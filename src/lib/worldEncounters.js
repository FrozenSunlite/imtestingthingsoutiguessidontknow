import { monsterXp, thresholdsFor } from "@/lib/encounterXp";
import { crValue, hasCr } from "@/lib/dungeonGen";

const TYPE_FALLBACK = "Unclassified";

export function monsterTypeOf(monster) {
  const type = typeof monster?.type === "object" ? monster.type?.type : monster?.type;
  return String(type || monster?.category || TYPE_FALLBACK).trim() || TYPE_FALLBACK;
}

// Build one encounter table per monster type per character level, gauged for a
// four-player party. Each table has several difficulty rows so a random roll is
// not always a deadly fight.
export function buildWorldEncounterTables(monsters = [], { partySize = 4 } = {}) {
  const usable = (monsters || []).filter(
    (monster) => monster?.name && hasCr(monster.cr) && !monster.dungeonExempt
  );
  const byType = new Map();
  usable.forEach((monster) => {
    const type = monsterTypeOf(monster);
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(monster);
  });

  const tables = [];
  const allTypes = [...byType.keys()].sort((a, b) => a.localeCompare(b));
  allTypes.forEach((type) => {
    const pool = byType.get(type).sort((a, b) => crValue(a.cr) - crValue(b.cr));
    for (let level = 1; level <= 20; level += 1) {
      const thresholds = thresholdsFor(level, partySize);
      const nearby = pool.filter((monster) => {
        const cr = crValue(monster.cr);
        return cr >= Math.max(0, level - 5) && cr <= level + 2;
      });
      const candidates = nearby.length ? nearby : pool;
      if (!candidates.length) continue;
      const rows = [];
      const difficulties = [
        ["Easy", 0.8],
        ["Medium", 1.35],
        ["Hard", 2.1],
        ["Deadly", 3.2],
        ["Boss", 4.2],
      ];
      difficulties.forEach(([difficulty, factor]) => {
        const target = thresholds[2] * factor;
        const monster = candidates[Math.min(candidates.length - 1, Math.floor(candidates.length * (0.25 + factor / 8)))];
        const xp = Math.max(1, monsterXp(monster));
        const count = Math.max(1, Math.min(16, Math.round(target / xp)));
        rows.push({
          monster: monster.name,
          count: String(count),
          difficulty,
          cr: monster.cr,
        });
      });
      tables.push({
        id: `enc_${type.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${level}`,
        name: `${type} · Level ${level}`,
        monsterType: type,
        level,
        partySize,
        crMin: candidates[0]?.cr || "",
        crMax: candidates[candidates.length - 1]?.cr || "",
        rows,
        mode: "weighted",
        notes: `4-player encounter table for ${type} creatures around level ${level}.`,
      });
    }
  });
  return tables;
}

export function tableForTypeAndLevel(tables, type, level) {
  return (
    (tables || []).find(
      (table) =>
        String(table.monsterType || "").toLowerCase() === String(type || "").toLowerCase() &&
        Number(table.level) === Number(level)
    ) || null
  );
}

export function worldEncounterSummary(tables) {
  const types = [...new Set((tables || []).map((t) => t.monsterType))];
  return {
    tables: (tables || []).length,
    types,
    levels: 20,
  };
}
