// Encounter XP calculator for a party of four. The assumed party level is the
// highest monster CR in the encounter (and one level below it), so the DM can
// see whether a generated grouping is easy, medium, hard or deadly at both
// plausible levels.
import { crValue } from "@/lib/dungeonGen";

export const XP_BY_CR = {
  0: 10,
  0.125: 25,
  0.25: 50,
  0.5: 100,
  1: 200,
  2: 450,
  3: 700,
  4: 1100,
  5: 1800,
  6: 2300,
  7: 2900,
  8: 3900,
  9: 5000,
  10: 5900,
  11: 7200,
  12: 8400,
  13: 10000,
  14: 11500,
  15: 13000,
  16: 15000,
  17: 18000,
  18: 20000,
  19: 22000,
  20: 25000,
  21: 33000,
  22: 41000,
  23: 50000,
  24: 62000,
  25: 75000,
  26: 90000,
  27: 105000,
  28: 120000,
  29: 135000,
  30: 155000,
};

// 2014 DMG thresholds per character: Easy / Medium / Hard / Deadly.
export const XP_THRESHOLDS = {
  1: [25, 50, 75, 100],
  2: [50, 100, 150, 200],
  3: [75, 150, 225, 400],
  4: [125, 250, 375, 500],
  5: [250, 500, 750, 1100],
  6: [300, 600, 900, 1400],
  7: [350, 750, 1100, 1700],
  8: [450, 900, 1400, 2100],
  9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800],
  11: [800, 1600, 2400, 3600],
  12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100],
  14: [1250, 2500, 3800, 5700],
  15: [1400, 2800, 4300, 6400],
  16: [1600, 3200, 4800, 7200],
  17: [2000, 3900, 5900, 8800],
  18: [2100, 4200, 6300, 9500],
  19: [2400, 4900, 7300, 10900],
  20: [2800, 5700, 8500, 12700],
};

export const DIFFICULTIES = ["Easy", "Medium", "Hard", "Deadly"];

export function monsterXp(monster) {
  const raw = Number(String(monster?.xp ?? "").replace(/[^\d]/g, ""));
  if (Number.isFinite(raw) && raw > 0) return raw;
  return XP_BY_CR[crValue(monster?.cr)] || 0;
}

export function thresholdsFor(level, partySize = 4) {
  const lv = Math.max(1, Math.min(20, Math.round(Number(level) || 1)));
  const per = XP_THRESHOLDS[lv] || XP_THRESHOLDS[1];
  return per.map((n) => n * Math.max(1, Number(partySize) || 4));
}

export function encounterMultiplier(count) {
  const n = Math.max(1, Number(count) || 1);
  if (n === 1) return 1;
  if (n === 2) return 1.5;
  if (n <= 6) return 2;
  if (n <= 10) return 2.5;
  if (n <= 14) return 3;
  return 4;
}

export function difficultyFor(adjustedXp, thresholds) {
  if (!thresholds?.length) return "—";
  if (adjustedXp >= thresholds[3]) return "Deadly";
  if (adjustedXp >= thresholds[2]) return "Hard";
  if (adjustedXp >= thresholds[1]) return "Medium";
  if (adjustedXp >= thresholds[0]) return "Easy";
  return "Trivial";
}

// Average a dice/range count for table rows without rolling, so the calculator
// is stable until the DM changes a quantity.
export function averageCount(value) {
  const text = String(value ?? "").trim();
  if (!text) return 1;
  const dice = text.match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (dice) {
    const n = Number(dice[1]) || 1;
    const size = Number(dice[2]) || 1;
    const mod = dice[3] ? (dice[3] === "-" ? -1 : 1) * (Number(dice[4]) || 0) : 0;
    return Math.max(1, Math.round(n * ((size + 1) / 2) + mod));
  }
  const range = text.match(/^(\d+)\s*[–-]\s*(\d+)$/);
  if (range) return Math.max(1, Math.round((Number(range[1]) + Number(range[2])) / 2));
  const flat = Number(text);
  return Number.isFinite(flat) && flat > 0 ? Math.round(flat) : 1;
}

export function encounterXp(rows = [], monsters = [], { partySize = 4 } = {}) {
  const byName = new Map((monsters || []).map((m) => [m.name, m]));
  const items = (rows || [])
    .map((row) => {
      const monster = byName.get(row.monster);
      if (!monster) return null;
      const count = Math.max(1, Math.round(Number(row.count) || 1));
      const cr = crValue(monster.cr);
      const xp = monsterXp(monster);
      return { ...row, monsterData: monster, count, cr, xp, total: xp * count };
    })
    .filter(Boolean);
  const totalCount = items.reduce((sum, item) => sum + item.count, 0);
  const baseXp = items.reduce((sum, item) => sum + item.total, 0);
  const highestCR = items.reduce((max, item) => Math.max(max, item.cr), 0);
  const level = Math.max(1, Math.min(20, Math.ceil(highestCR) || 1));
  const lowerLevel = Math.max(1, level - 1);
  const multiplier = encounterMultiplier(totalCount);
  const adjustedXp = Math.round(baseXp * multiplier);
  return {
    items,
    totalCount,
    baseXp,
    multiplier,
    adjustedXp,
    highestCR,
    level,
    lowerLevel,
    levelThresholds: thresholdsFor(level, partySize),
    lowerThresholds: thresholdsFor(lowerLevel, partySize),
    levelDifficulty: difficultyFor(adjustedXp, thresholdsFor(level, partySize)),
    lowerDifficulty: difficultyFor(adjustedXp, thresholdsFor(lowerLevel, partySize)),
  };
}
