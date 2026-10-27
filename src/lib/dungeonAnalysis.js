// Danger and reward analysis for a generated dungeon. "Danger" compares the
// selected party level against the rank's expected level band and boss CR band;
// loot/monster summaries are read from the rooms that were actually generated.
import { DUNGEON_RANKS } from "@/lib/dungeonGen";

const DANGER_ORDER = ["Trivial", "Easy", "Balanced", "Hard", "Deadly"];

const danger = (label, reason) => ({
  label,
  severity: DANGER_ORDER.indexOf(label),
  reason,
});

export function rankLevelRange(rank) {
  const text = String(DUNGEON_RANKS[rank]?.level || "1–1");
  const nums = text.match(/\d+/g)?.map(Number) || [1];
  return { min: nums[0] || 1, max: nums[1] || nums[0] || 1 };
}

export function dungeonDanger(dungeon, partyLevel) {
  const rank = dungeon?.rank || "E";
  const info = DUNGEON_RANKS[rank] || DUNGEON_RANKS.E;
  const level = Math.max(1, Math.round(Number(partyLevel) || 1));
  const range = rankLevelRange(rank);
  const crMin = Number(info.crMin) || 0;
  const crMax = Number(info.crMax) || crMin;

  const levelDanger =
    level < range.min - 2
      ? danger("Deadly", `The party is more than two levels below this rank's band (${range.min}–${range.max}).`)
      : level < range.min
        ? danger("Hard", `The party is below this rank's expected level band (${range.min}–${range.max}).`)
        : level <= range.max
          ? danger("Balanced", `The party is inside this rank's expected level band (${range.min}–${range.max}).`)
          : level <= range.max + 2
            ? danger("Easy", `The party is above this rank's expected band, but not overwhelmingly so.`)
            : danger("Trivial", `The party greatly outclasses this rank's expected level band.`);

  const bossDanger =
    level + 3 <= crMin
      ? danger("Deadly", `The boss band starts at CR ${crMin}, far above the party's level.`)
      : level < crMin
        ? danger("Hard", `The boss band starts at CR ${crMin}, above the party's level.`)
        : level <= crMax
          ? danger("Balanced", `The boss CR band (${crMin}–${crMax}) matches the party's level.`)
          : level <= crMax + 2
            ? danger("Easy", `The party is above the boss CR band (${crMin}–${crMax}).`)
            : danger("Trivial", `The party is far above the boss CR band (${crMin}–${crMax}).`);

  const result =
    levelDanger.severity >= bossDanger.severity ? levelDanger : bossDanger;
  return {
    ...result,
    rank,
    rankInfo: info,
    partyLevel: level,
    levelRange: range,
    crMin,
    crMax,
    levelDanger,
    bossDanger,
  };
}

const LOOT_HINTS = [
  ["coins", /\b(coins?|gold|gp|pp|sp|cp|treasure)\b/i],
  ["gems", /\b(gems?|jewel|jewels|gemstones?)\b/i],
  ["art objects", /\b(art|art objects?|paintings?|idols?|relics?)\b/i],
  ["magic items", /\b(magic|potions?|scrolls?|wands?|rods?|staff|staves|rings?|wondrous)\b/i],
  ["weapons / armor", /\b(weapons?|armou?r|shields?)\b/i],
  ["mundane gear", /\b(mundane|supplies|gear|rations?|ammunition)\b/i],
];

export function dungeonLootProfile(dungeon) {
  const text = (dungeon?.rooms || [])
    .flatMap((room) => room.loot || [])
    .join(" ");
  const seen = LOOT_HINTS.filter(([, re]) => re.test(text)).map(([name]) => name);
  const tier = (DUNGEON_RANKS[dungeon?.rank] || DUNGEON_RANKS.E).loot;
  return {
    tier,
    seen,
    summary: seen.length ? seen.join(", ") : tier,
  };
}

const spawnName = (line) => {
  const text = String(line || "").trim();
  const match = text.match(/^(\d+)(?:\s*[–-]\s*(\d+))?×\s*(.+?)(?:\s*\(CR\s*[^)]*\))?$/i);
  return match ? match[3].trim() : text;
};

export function dungeonMonsterProfile(dungeon, monsters = []) {
  const byName = new Map((monsters || []).filter((m) => m.name).map((m) => [m.name, m]));
  const counts = new Map();
  (dungeon?.rooms || []).forEach((room) => {
    (room.spawns || []).forEach((line) => {
      const name = spawnName(line);
      const monster = byName.get(name);
      if (!monster) return;
      const type =
        monster.type ||
        monster.category ||
        (Array.isArray(monster.tags) ? monster.tags[0] : "") ||
        "Unclassified";
      const n = Number(String(line).match(/^(\d+)/)?.[1]) || 1;
      counts.set(type, (counts.get(type) || 0) + n);
    });
  });
  return [...counts]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

export function dungeonPayout(dungeon) {
  const info = DUNGEON_RANKS[dungeon?.rank] || DUNGEON_RANKS.E;
  const [goldMin, goldMax] = info.gold || [0, 0];
  return {
    goldMin,
    goldMax,
    downtime: info.downtime,
    text: `${Number(goldMin).toLocaleString()}–${Number(goldMax).toLocaleString()} gp · ${info.downtime} downtime`,
  };
}

export function analyzeDungeon(dungeon, partyLevel, monsters = []) {
  return {
    danger: dungeonDanger(dungeon, partyLevel),
    loot: dungeonLootProfile(dungeon),
    monsters: dungeonMonsterProfile(dungeon, monsters),
    payout: dungeonPayout(dungeon),
  };
}
