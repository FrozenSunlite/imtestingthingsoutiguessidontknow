import {
  difficultyFor,
  encounterXp,
  thresholdsFor,
} from "@/lib/encounterXp";

// Parse the generator's spawn strings ("3× Goblin", "2 x Bandit") back into
// encounter rows so the room editor can show a live XP budget.
export function spawnRows(spawns = []) {
  return (spawns || [])
    .map((text) => {
      const value = String(text || "").trim();
      const match = value.match(/^(\d+)\s*[×x]\s*(.+)$/i);
      if (match) return { count: Number(match[1]) || 1, monster: match[2].trim() };
      return { count: 1, monster: value };
    })
    .filter((row) => row.monster);
}

export function roomThreat(room, monsters = [], partyLevel = 1, partySize = 4) {
  const rows = spawnRows(room?.spawns || []);
  const byName = new Map((monsters || []).map((m) => [String(m.name || "").toLowerCase(), m]));
  const matched = rows.map((row) => ({
    ...row,
    monster: byName.get(String(row.monster).toLowerCase())?.name || row.monster,
    known: byName.has(String(row.monster).toLowerCase()),
  }));
  const knownRows = matched.filter((row) => row.known);
  const xp = encounterXp(knownRows, monsters, { partySize });
  const thresholds = thresholdsFor(partyLevel, partySize);
  const difficulty = difficultyFor(xp.adjustedXp, thresholds);
  return {
    ...xp,
    rows: matched,
    unmatched: matched.filter((row) => !row.known).map((row) => row.monster),
    thresholds,
    difficulty,
    ratio: thresholds[3] ? xp.adjustedXp / thresholds[3] : 0,
  };
}
