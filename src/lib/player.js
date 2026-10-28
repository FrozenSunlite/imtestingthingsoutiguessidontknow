// Player-facing layer: a small persistent party state on top of the world.
//
// The player state lives on `world.player`, so it is saved with the project,
// browser autosave and filesystem mirror. The Play tab uses these helpers for
// travel, markets, rumors, downtime and dungeon delves.

import { makeRng } from "@/lib/worldNames";
import { routeFor, travelEstimate } from "@/lib/worldGen";
import { advanceWorldTime } from "@/lib/worldSim";
import { rollEncounter } from "@/lib/dmLoot";
import {
  DUNGEON_RANKS,
  crValue,
  generateDungeon,
  scaleEncounters,
} from "@/lib/dungeonGen";
import { dungeonPayout } from "@/lib/dungeonAnalysis";

export const GOODS = [
  { id: "grain", name: "Grain", base: 2, tag: "food" },
  { id: "salt", name: "Salt", base: 5, tag: "food" },
  { id: "fish", name: "Salted Fish", base: 4, tag: "food" },
  { id: "timber", name: "Timber", base: 5, tag: "wood" },
  { id: "cloth", name: "Cloth", base: 8, tag: "cloth" },
  { id: "furs", name: "Furs", base: 10, tag: "cloth" },
  { id: "iron", name: "Iron", base: 12, tag: "metal" },
  { id: "herbs", name: "Herbs", base: 9, tag: "herbs" },
  { id: "wine", name: "Wine", base: 15, tag: "drink" },
  { id: "gems", name: "Gems", base: 55, tag: "luxury" },
  { id: "draught", name: "Healing Draught", base: 25, tag: "potion" },
];

export const DOWNTIME_ACTIONS = [
  {
    id: "work",
    label: "Work for coin",
    days: 7,
    cost: 0,
    detail: "Take steady work in town. Earn 2d10 gold plus your level.",
  },
  {
    id: "carouse",
    label: "Carouse",
    days: 1,
    cost: 5,
    detail: "Spend 5 gp in the taverns and pick up a local rumor.",
  },
  {
    id: "research",
    label: "Research",
    days: 7,
    cost: 0,
    detail: "Read, ask questions and turn up a lead or rumor.",
  },
  {
    id: "craft",
    label: "Craft a draught",
    days: 7,
    cost: 10,
    detail: "Spend 10 gp on reagents to brew one Healing Draught.",
  },
  {
    id: "fish",
    label: "Fish",
    days: 1,
    cost: 0,
    detail: "Fish the local waters and bring back two portions of food.",
  },
  {
    id: "train",
    label: "Train",
    days: 7,
    cost: 0,
    detail: "Drill and practise. Gain a training note for the next encounter.",
  },
];

const rankForLevel = (level) => {
  const value = Math.max(1, Number(level) || 1);
  if (value <= 2) return "E";
  if (value <= 5) return "D";
  if (value <= 8) return "C";
  if (value <= 11) return "B";
  if (value <= 14) return "A";
  if (value <= 17) return "S";
  if (value <= 20) return "SS";
  return "SSS";
};

const fallbackEncounterTable = (monsters, level, rank = "") => {
  const min = Math.max(0, (Number(level) || 1) - 2);
  const max = Math.min(30, (Number(level) || 1) + 2);
  const pool = (monsters || [])
    .filter((monster) => {
      const value = crValue(monster?.cr);
      return Number.isFinite(value) && value >= min && value <= max;
    })
    .slice(0, 18);
  if (!pool.length) return null;
  return {
    id: `fallback_${rank || "road"}`,
    name: rank ? `${rank} rank delve encounter` : "Road encounter",
    mode: "weighted",
    crMin: min,
    crMax: max,
    rows: pool.map((monster) => ({ monster: monster.name, count: "1d3" })),
  };
};

const d10 = (rng) => 1 + Math.floor(rng.rand() * 10);

const startingInventory = () => [
  { id: "rations", name: "Trail Rations", qty: 6, tag: "food" },
  { id: "torch", name: "Torch", qty: 4, tag: "misc" },
  { id: "rope", name: "Coil of Rope", qty: 1, tag: "misc" },
];

export function ensurePlayer(world, character = null) {
  if (!world) return world;
  const existing = world.player;
  const settlements = world.settlements || [];
  const fallbackSettlement =
    settlements.find((settlement) => settlement.id === existing?.locationSettlementId) ||
    settlements.find((settlement) => settlement.kind === "capital") ||
    settlements[0] ||
    null;
  const level = Math.max(1, Number(character?.level) || Number(existing?.level) || 1);
  const player = {
    id: existing?.id || "player",
    name:
      existing?.name ||
      character?.name ||
      character?.charName ||
      "Wayfarer",
    level,
    gold: Number.isFinite(Number(existing?.gold)) ? Number(existing.gold) : 50,
    inventory: Array.isArray(existing?.inventory)
      ? existing.inventory
      : startingInventory(),
    locationSettlementId:
      existing?.locationSettlementId || fallbackSettlement?.id || "",
    reputation: { ...(existing?.reputation || {}) },
    rumors: Array.isArray(existing?.rumors) ? existing.rumors : [],
    log: Array.isArray(existing?.log) ? existing.log : [],
    pendingEncounter: existing?.pendingEncounter || null,
    delve: existing?.delve || null,
    marketPurchases: { ...(existing?.marketPurchases || {}) },
    nextCombatBonus: Number(existing?.nextCombatBonus) || 0,
    lastTravel: existing?.lastTravel || null,
    flags: { ...(existing?.flags || {}) },
  };
  return { ...world, player };
}

const logPlayer = (player, text) => [
  ...(player.log || []),
  { at: new Date().toISOString(), text },
].slice(-120);

const addItem = (player, item) => {
  const inventory = [...(player.inventory || [])];
  const index = inventory.findIndex((entry) => entry.id === item.id);
  if (index >= 0) {
    inventory[index] = {
      ...inventory[index],
      qty: (Number(inventory[index].qty) || 0) + (Number(item.qty) || 1),
    };
  } else {
    inventory.push({ ...item, qty: Number(item.qty) || 1 });
  }
  return inventory;
};

const removeItem = (player, itemId, qty = 1) => {
  const inventory = [];
  (player.inventory || []).forEach((entry) => {
    if (entry.id !== itemId) {
      inventory.push(entry);
      return;
    }
    const left = (Number(entry.qty) || 0) - qty;
    if (left > 0) inventory.push({ ...entry, qty: left });
  });
  return inventory;
};

const itemQty = (player, itemId) =>
  (player.inventory || [])
    .filter((entry) => entry.id === itemId)
    .reduce((sum, entry) => sum + (Number(entry.qty) || 0), 0);

export function playerSettlement(world, player = world?.player) {
  return (
    (world?.settlements || []).find(
      (settlement) => settlement.id === player?.locationSettlementId
    ) || null
  );
}

export function playerKingdom(world, player = world?.player) {
  const settlement = playerSettlement(world, player);
  if (!settlement) return null;
  return (
    (world?.kingdoms || []).find(
      (kingdom) => kingdom.nationId === settlement.nationId
    ) || null
  );
}

export function destinationOptions(world, player = world?.player) {
  const current = player?.locationSettlementId || "";
  const origin = playerSettlement(world, player);
  return (world?.settlements || [])
    .filter((settlement) => settlement.id !== current)
    .map((settlement) => {
      const route = routeFor(world, current, settlement.id);
      const estimate = travelEstimate(route, "walk");
      const distance = origin
        ? Math.hypot(settlement.x - origin.x, settlement.y - origin.y)
        : 500;
      const days = Math.max(
        1,
        Math.round(Number(estimate.days) || Number(estimate.hours) / 24 || distance / 120)
      );
      return {
        settlement,
        route,
        days,
        distance: Math.round(distance),
        nation: (world?.nations || []).find(
          (nation) => nation.id === settlement.nationId
        ),
      };
    })
    .sort((a, b) => a.days - b.days || a.settlement.name.localeCompare(b.settlement.name));
}

export function travelTo(
  worldInput,
  toSettlementId,
  { character = null, seed = "", monsters = [] } = {}
) {
  let world = ensurePlayer(worldInput, character);
  const player = world.player;
  const fromId = player.locationSettlementId;
  const to = (world.settlements || []).find(
    (settlement) => settlement.id === toSettlementId
  );
  if (!to) return { world, error: "Choose a destination." };
  if (fromId === to.id) return { world, error: "You are already there." };
  const route = routeFor(world, fromId, to.id);
  const estimate = travelEstimate(route, "walk");
  const from = (world.settlements || []).find((settlement) => settlement.id === fromId);
  const distance = from ? Math.hypot(to.x - from.x, to.y - from.y) : 500;
  const days = Math.max(
    1,
    Math.round(Number(estimate.days) || Number(estimate.hours) / 24 || distance / 120)
  );
  const cost = Math.max(1, Math.round(days * 1.5));
  if (player.gold < cost) {
    return {
      world,
      error: `Travel to ${to.name} costs ${cost} gp; you have ${player.gold} gp.`,
    };
  }
  const next = {
    ...world,
    player: {
      ...player,
      gold: player.gold - cost,
      locationSettlementId: to.id,
      pendingEncounter: null,
      lastTravel: {
        fromId,
        toId: to.id,
        fromName: from?.name || "the road",
        toName: to.name,
        days,
        cost,
      },
      log: logPlayer(
        player,
        `Travelled from ${from?.name || "the road"} to ${to.name} (${days} day${days === 1 ? "" : "s"}, ${cost} gp).`
      ),
    },
  };
  let advanced = advanceWorldTime(next, days * 24);
  advanced = ensurePlayer(advanced, character);
  const rng = makeRng(`${world.id}:travel:${fromId}:${to.id}:${seed || Date.now()}`);
  const kingdom = (advanced.kingdoms || []).find(
    (item) => item.nationId === to.nationId
  );
  const tables = advanced.encounterTables || [];
  const table =
    tables.find(
      (item) =>
        item.crMin != null &&
        Number(item.crMin) <= player.level + 2 &&
        Number(item.crMax) >= player.level - 1
    ) ||
    tables.find((item) => item.name?.toLowerCase().includes("road")) ||
    tables[0] ||
    fallbackEncounterTable(monsters, player.level);
  let encounter = null;
  if (table && rng.chance(0.28)) {
    const rows = rollEncounter(table, monsters);
    if (rows.length) {
      encounter = {
        name: `Ambush on the road to ${to.name}`,
        table: table.name || "Road encounter",
        rows,
        kingdomId: kingdom?.id || "",
      };
      advanced.player = {
        ...advanced.player,
        pendingEncounter: encounter,
        log: logPlayer(
          advanced.player,
          `Encounter on the road: ${rows
            .map((row) => `${row.count} x ${row.monster}`)
            .join(", ")}.`
        ),
      };
    }
  }
  return { world: advanced, days, cost, encounter, destination: to };
}

export function clearPendingEncounter(worldInput) {
  const world = ensurePlayer(worldInput);
  return {
    ...world,
    player: {
      ...world.player,
      pendingEncounter: null,
      log: logPlayer(world.player, "Avoided the encounter on the road."),
    },
  };
}

export function claimTravelVictory(worldInput, { character = null, seed = "" } = {}) {
  const world = ensurePlayer(worldInput, character);
  const player = world.player;
  const pending = player.pendingEncounter;
  if (!pending) return { world, error: "There is no road encounter to claim." };
  const rng = makeRng(`${world.id}:road-victory:${pending.name}:${seed || Date.now()}`);
  const threat = (pending.rows || []).reduce(
    (sum, row) => sum + (Number(row.count) || 0),
    0
  );
  const gold = d10(rng) + d10(rng) + player.level + Math.min(12, threat * 2);
  const nextPlayer = {
    ...player,
    gold: player.gold + gold,
    pendingEncounter: null,
    nextCombatBonus: Math.max(0, (player.nextCombatBonus || 0) - 1),
    log: logPlayer(
      player,
      `Won the road encounter at ${pending.name}; recovered ${gold} gp.`
    ),
  };
  return {
    world: { ...world, player: nextPlayer },
    message: `Victory claimed: ${gold} gp.`,
    gold,
  };
}

export function marketFor(world, settlementId, player = world?.player) {
  const settlement =
    (world?.settlements || []).find((item) => item.id === settlementId) ||
    playerSettlement(world, player);
  if (!settlement) return { goods: [], factor: 1, notes: [] };
  const kingdom = (world?.kingdoms || []).find(
    (item) => item.nationId === settlement.nationId
  );
  const active = kingdom?.activeEvents || [];
  const rng = makeRng(
    `${world?.id || "world"}:market:${settlement.id}:${world?.calendar?.month || 1}:${kingdom?.turn || 1}`
  );
  const prosperity = Number(settlement.prosperity) || 5;
  const biome = String(settlement.biome || settlement.biomeLabel || "").toLowerCase();
  const notes = [];
  const factorFor = (good) => {
    let factor = 1 + Math.max(-0.18, Math.min(0.22, (5 - prosperity) * 0.035));
    if (/coast|ocean|river|dock/.test(biome)) {
      if (good.id === "fish" || good.id === "salt") factor *= 0.75;
      if (good.id === "grain") factor *= 1.12;
    }
    if (/forest/.test(biome) && (good.id === "timber" || good.id === "furs")) factor *= 0.78;
    if (/hill|mountain/.test(biome) && (good.id === "iron" || good.id === "gems")) factor *= 0.8;
    if (/farm|grass|plain/.test(biome) && (good.id === "grain" || good.id === "herbs")) factor *= 0.82;
    if (active.some((event) => event.name === "Supply Drought") && good.tag === "food") {
      factor *= 1.5;
      notes.push("Supply Drought: food prices are up 50%.");
    }
    if (active.some((event) => event.name === "Bumper Crop") && good.tag === "food") {
      factor *= 0.75;
      notes.push("Bumper Crop: food is cheap.");
    }
    if (active.some((event) => event.name === "Mining Growth") && good.tag === "metal") {
      factor *= 0.8;
      notes.push("Mining Growth: metal is cheap.");
    }
    if (active.some((event) => event.name === "Bandit Activity")) {
      factor *= 1.1;
      notes.push("Bandit Activity: road prices are up 10%.");
    }
    if (active.some((event) => event.name === "Market Crash")) {
      factor *= 1.15;
      notes.push("Market Crash: prices are unstable.");
    }
    if (active.some((event) => event.name === "Trade Route Expansion")) {
      factor *= 0.9;
      notes.push("Trade Route Expansion: imported goods are cheaper.");
    }
    return Math.max(0.4, factor);
  };
  const stockKey = (goodId) =>
    `${settlement.id}:${kingdom?.turn || 0}:${goodId}`;
  const goods = GOODS.map((good) => {
    const factor = factorFor(good);
    const buy = Math.max(1, Math.round(good.base * factor * 1.1));
    const sell = Math.max(1, Math.round(good.base * factor * 0.72));
    const baseQty = Math.round(
      (settlement.kind === "capital" ? 10 : settlement.kind === "city" ? 7 : 4) *
        (0.6 + rng.rand() * 0.9)
    );
    const bought = Number(player.marketPurchases?.[stockKey(good.id)] || 0);
    const qty = Math.max(0, baseQty - bought);
    return {
      ...good,
      buy,
      sell,
      qty,
      owned: itemQty(player, good.id),
    };
  });
  return { goods, factor: 1, notes: [...new Set(notes)], settlement, kingdom };
}

export function buyGood(worldInput, settlementId, goodId, qty = 1) {
  const world = ensurePlayer(worldInput);
  const player = world.player;
  const market = marketFor(world, settlementId, player);
  const good = market.goods.find((item) => item.id === goodId);
  if (!good) return { world, error: "That good is not sold here." };
  const count = Math.max(1, Math.round(Number(qty) || 1));
  const cost = good.buy * count;
  if (good.qty < count) return { world, error: "The market does not have that many." };
  if (player.gold < cost) return { world, error: `Need ${cost} gp.` };
  const kingdom = market.kingdom;
  const stockKey = `${settlementId}:${kingdom?.turn || 0}:${good.id}`;
  return {
    world: {
      ...world,
      player: {
        ...player,
        gold: player.gold - cost,
        inventory: addItem(player, { id: good.id, name: good.name, tag: good.tag, qty: count }),
        marketPurchases: {
          ...(player.marketPurchases || {}),
          [stockKey]: Number(player.marketPurchases?.[stockKey] || 0) + count,
        },
        log: logPlayer(player, `Bought ${count} ${good.name} for ${cost} gp.`),
      },
    },
    message: `Bought ${count} ${good.name} for ${cost} gp.`,
  };
}

export function sellGood(worldInput, settlementId, goodId, qty = 1) {
  const world = ensurePlayer(worldInput);
  const player = world.player;
  const market = marketFor(world, settlementId, player);
  const good = market.goods.find((item) => item.id === goodId);
  if (!good) return { world, error: "That good is not traded here." };
  const count = Math.max(1, Math.round(Number(qty) || 1));
  if (itemQty(player, good.id) < count) {
    return { world, error: "You do not carry that many." };
  }
  const value = good.sell * count;
  return {
    world: {
      ...world,
      player: {
        ...player,
        gold: player.gold + value,
        inventory: removeItem(player, good.id, count),
        log: logPlayer(player, `Sold ${count} ${good.name} for ${value} gp.`),
      },
    },
    message: `Sold ${count} ${good.name} for ${value} gp.`,
  };
}

export function rumorsFor(world, settlementId, limit = 6) {
  const settlement =
    (world?.settlements || []).find((item) => item.id === settlementId) || null;
  const kingdom = (world?.kingdoms || []).find(
    (item) => item.nationId === settlement?.nationId
  );
  const rng = makeRng(
    `${world?.id || "world"}:rumors:${settlementId}:${world?.calendar?.month || 1}:${kingdom?.turn || 0}`
  );
  const rumors = [];
  (kingdom?.activeEvents || []).forEach((event) => {
    rumors.push(
      `${event.name}: ${event.ongoing || event.effect}${event.goal ? ` Goal: ${event.goal}.` : ""}`
    );
  });
  (kingdom?.eventHistory || [])
    .filter((entry) => entry.event && entry.event.name !== "All is well")
    .slice(-3)
    .reverse()
    .forEach((entry) => {
      rumors.push(`${entry.event.name}: ${entry.event.effect}`);
    });
  (world?.quests || [])
    .filter((quest) => quest.status !== "completed")
    .slice(0, 3)
    .forEach((quest) => {
      rumors.push(`${quest.title} - ${quest.summary || quest.description || "a job is posted at the board"}`);
    });
  if (!rumors.length) {
    rumors.push(
      "The roads are quiet for now. A good time to work, craft or ask after old ruins."
    );
  }
  if (rng.chance(0.55)) {
    const good = GOODS[Math.floor(rng.rand() * GOODS.length)];
    rumors.push(
      `${settlement?.name || "Local traders"} are paying attention to ${good.name.toLowerCase()} this week.`
    );
  }
  return [...new Set(rumors)].slice(0, limit);
}

export function performDowntime(worldInput, actionId, { character = null, seed = "" } = {}) {
  let world = ensurePlayer(worldInput, character);
  const action = DOWNTIME_ACTIONS.find((item) => item.id === actionId);
  if (!action) return { world, error: "Choose a downtime action." };
  const player = world.player;
  if (player.gold < action.cost) {
    return { world, error: `That costs ${action.cost} gp.` };
  }
  let nextPlayer = {
    ...player,
    gold: player.gold - action.cost,
  };
  const rng = makeRng(`${world.id}:downtime:${action.id}:${seed || Date.now()}`);
  let message = "";
  if (action.id === "work") {
    const total = d10(rng) + d10(rng) + player.level;
    nextPlayer.gold += total;
    message = `Worked for a week and earned ${total} gp.`;
  } else if (action.id === "carouse") {
    const rumor = rumorsFor(world, player.locationSettlementId, 4)[0];
    nextPlayer.rumors = [...new Set([...(nextPlayer.rumors || []), rumor])].slice(-20);
    message = `Spent the evening carousing. New rumor: ${rumor}`;
  } else if (action.id === "research") {
    const rumor = rumorsFor(world, player.locationSettlementId, 6)[1] ||
      rumorsFor(world, player.locationSettlementId, 6)[0];
    nextPlayer.rumors = [...new Set([...(nextPlayer.rumors || []), rumor])].slice(-20);
    message = `Researched local lore. Lead: ${rumor}`;
  } else if (action.id === "craft") {
    nextPlayer.inventory = addItem(nextPlayer, {
      id: "draught",
      name: "Healing Draught",
      tag: "potion",
      qty: 1,
    });
    message = "Brewed one Healing Draught.";
  } else if (action.id === "fish") {
    nextPlayer.inventory = addItem(nextPlayer, {
      id: "fish",
      name: "Fresh Fish",
      tag: "food",
      qty: 2,
    });
    message = "Caught two portions of fresh fish.";
  } else if (action.id === "train") {
    nextPlayer.nextCombatBonus = (nextPlayer.nextCombatBonus || 0) + 1;
    message = "Trained hard. You are sharp for the next fight.";
  }
  nextPlayer.log = logPlayer(nextPlayer, message);
  world = { ...world, player: nextPlayer };
  world = advanceWorldTime(world, action.days * 24);
  world = ensurePlayer(world, character);
  return { world, message };
}

const parseSpawns = (spawns = []) =>
  (spawns || []).flatMap((text) => {
    const raw = String(text || "").trim();
    if (!raw) return [];
    const match = raw.match(/^(\d+)\s*[x×]\s*(.+)$/i);
    if (match) return [{ monster: match[2].trim(), count: Number(match[1]) || 1 }];
    return [{ monster: raw.replace(/^\d+\s*/, ""), count: 1 }];
  });

export function startDelve(worldInput, { character = null, monsters = [], seed = "" } = {}) {
  let world = ensurePlayer(worldInput, character);
  const player = world.player;
  const settlement = playerSettlement(world, player);
  if (!settlement) return { world, error: "Travel to a settlement first." };
  if (player.delve?.rooms?.some((room) => !room.cleared)) {
    return { world, error: "Finish or abandon your current delve first." };
  }
  const rank = rankForLevel(player.level);
  const delveSeed = seed || `${world.id}:${settlement.id}:${Date.now()}`;
  const table =
    (world.encounterTables || []).find(
      (item) =>
        Number(item.crMin) <= player.level + 1 &&
        Number(item.crMax) >= player.level - 1
    ) ||
    (world.encounterTables || [])[0] ||
    fallbackEncounterTable(monsters, player.level, rank);
  const dungeon = generateDungeon({
    mode: "single",
    rank,
    seed: delveSeed,
    monsters,
    name: `Ruins near ${settlement.name}`,
    players: 4,
  });
  const scaled = scaleEncounters(dungeon, {
    players: 4,
    partyLevel: player.level,
    monsters,
    rank,
    encounterTable: table,
  });
  const rankLimit = Math.min(15, DUNGEON_RANKS[rank]?.rooms || 9);
  const allRooms = scaled.rooms || [];
  const bossRoom = allRooms.find((room) => room.category === "Boss") || null;
  const otherRooms = allRooms.filter(
    (room) => room !== bossRoom && !room.hall
  );
  const combatRooms = otherRooms
    .filter((room) => (room.spawns || []).length > 0)
    .slice(0, Math.max(1, rankLimit - (bossRoom ? 2 : 1)));
  const quietRooms = otherRooms
    .filter((room) => !(room.spawns || []).length)
    .slice(0, Math.max(0, rankLimit - combatRooms.length - (bossRoom ? 1 : 0)));
  const selectedRooms = [
    ...combatRooms,
    ...quietRooms,
    ...(bossRoom ? [bossRoom] : []),
  ].slice(0, rankLimit);
  const rooms = selectedRooms.map((room, index) => ({
    id: room.id || `delve_room_${index}`,
    name: room.name || `Room ${index + 1}`,
    category: room.category || "Chamber",
    spawns: room.spawns || [],
    loot: room.loot || [],
    cleared: false,
    inProgress: false,
  }));
  const payout = dungeonPayout(scaled, "gp");
  world = {
    ...world,
    player: {
      ...player,
      delve: {
        id: `delve_${Date.now().toString(36)}`,
        name: scaled.name || `Ruins near ${settlement.name}`,
        rank,
        seed: delveSeed,
        settlementId: settlement.id,
        settlementName: settlement.name,
        rooms,
        payout,
        startedAt: new Date().toISOString(),
        completed: false,
      },
      log: logPlayer(
        player,
        `Began a delve into ${scaled.name || `the ruins near ${settlement.name}`} (rank ${rank}).`
      ),
    },
  };
  return { world, delve: world.player.delve };
}

export function exploreDelveRoom(worldInput, roomId) {
  const world = ensurePlayer(worldInput);
  const player = world.player;
  const delve = player.delve;
  const room = delve?.rooms?.find((item) => item.id === roomId);
  if (!delve || !room) return { world, error: "That room is not part of the delve." };
  if (room.cleared) return { world, error: "That room is already cleared." };
  const monsters = parseSpawns(room.spawns);
  if (!monsters.length) {
    return { world, room, monsters: [], empty: true };
  }
  return {
    world: {
      ...world,
      player: {
        ...player,
        delve: {
          ...delve,
          rooms: delve.rooms.map((item) =>
            item.id === roomId ? { ...item, inProgress: true } : item
          ),
        },
      },
    },
    room,
    monsters,
  };
}

export function clearDelveRoom(worldInput, roomId) {
  const world = ensurePlayer(worldInput);
  const player = world.player;
  const delve = player.delve;
  const room = delve?.rooms?.find((item) => item.id === roomId);
  if (!delve || !room) return { world, error: "That room is not part of the delve." };
  const payoutMin = Number(delve.payout?.goldMin) || 25;
  const payoutMax = Number(delve.payout?.goldMax) || payoutMin;
  const share = Math.max(
    1,
    Math.round(((payoutMin + payoutMax) / 2) / Math.max(1, delve.rooms.length))
  );
  const rooms = delve.rooms.map((item) =>
    item.id === roomId
      ? { ...item, cleared: true, inProgress: false, claimedGold: share }
      : item
  );
  const allCleared = rooms.every((item) => item.cleared);
  const nextPlayer = {
    ...player,
    gold: player.gold + share,
    delve: {
      ...delve,
      rooms,
      completed: allCleared,
    },
    log: logPlayer(
      player,
      `Cleared ${room.name} in ${delve.name}; recovered ${share} gp.${allCleared ? " The delve is complete." : ""}`
    ),
  };
  return {
    world: { ...world, player: nextPlayer },
    message: `Cleared ${room.name}. Found ${share} gp.${allCleared ? " Delve complete." : ""}`,
    allCleared,
  };
}

export function abandonDelve(worldInput) {
  const world = ensurePlayer(worldInput);
  const player = world.player;
  if (!player.delve) return world;
  return {
    ...world,
    player: {
      ...player,
      delve: null,
      log: logPlayer(player, `Abandoned the delve into ${player.delve.name}.`),
    },
  };
}
