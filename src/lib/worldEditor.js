// World Map editing operations. Every function returns a new world object so
// the World Builder can save edits through the normal autosave/project path.

import {
  BIOMES,
  ERAS,
  SCALES,
  buildMapCells,
  createSettlementAt,
  routeBetween,
} from "@/lib/worldGen";
import { DEVELOPMENT_BY_ID } from "@/lib/worldDevelopments";
import { makeRng } from "@/lib/worldNames";
import { ensureInterior } from "@/lib/interiorGen";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const copy = (world) => JSON.parse(JSON.stringify(world));

const cellAt = (realm, x, y) => {
  const map = realm?.map;
  if (!map?.cells?.length) return null;
  const cx = clamp(Math.floor((x / 1000) * map.width), 0, map.width - 1);
  const cy = clamp(Math.floor((y / 1000) * map.height), 0, map.height - 1);
  return { cx, cy, cell: map.cells.find((item) => item.x === cx && item.y === cy) || null };
};

export function paintTerrain(worldInput, realmId, cellX, cellY, radius, biomeId) {
  const world = { ...worldInput };
  const realmIndex = (world.realms || []).findIndex((item) => item.id === realmId);
  const realm = realmIndex >= 0 ? world.realms[realmIndex] : null;
  if (!realm?.map?.cells?.length) return world;
  const biome = BIOMES.find((item) => item.id === biomeId);
  if (!biome) return world;
  const brush = Math.max(0, Math.min(8, Number(radius) || 0));
  const cells = realm.map.cells.map((cell) => {
    if (Math.abs(cell.x - cellX) > brush || Math.abs(cell.y - cellY) > brush) return cell;
    return { ...cell, biome: biome.id };
  });
  const biomeIds = realm.biomeIds?.includes(biome.id)
    ? realm.biomeIds
    : [...(realm.biomeIds || []), biome.id];
  const biomeLabels = realm.biomeIds?.includes(biome.id)
    ? realm.biomeLabels
    : [...(realm.biomeLabels || []), biome.label];
  const nextRealm = {
    ...realm,
    map: { ...realm.map, cells },
    biomeIds,
    biomeLabels,
  };
  world.realms = world.realms.map((item, index) =>
    index === realmIndex ? nextRealm : item
  );
  world.settlements = (worldInput.settlements || []).map((settlement) => {
    if (settlement.realmId !== realm.id) return settlement;
    const point = cellAt(nextRealm, settlement.x, settlement.y);
    if (!point?.cell) return settlement;
    if (Math.abs(point.cx - cellX) > brush || Math.abs(point.cy - cellY) > brush) return settlement;
    return {
      ...settlement,
      biome: biome.id,
      biomeLabel: biome.label,
      tags: [
        ...new Set([
          ...(settlement.tags || []).filter((tag) => !BIOMES.some((item) => item.id === tag)),
          biome.id,
        ]),
      ],
    };
  });
  world.developments = (worldInput.developments || []).map((development) => {
    if (development.realmId !== realm.id) return development;
    const point = cellAt(nextRealm, development.x, development.y);
    if (!point?.cell) return development;
    if (Math.abs(point.cx - cellX) > brush || Math.abs(point.cy - cellY) > brush) return development;
    return { ...development, biome: biome.id, biomeLabel: biome.label };
  });
  return world;
}

export function paintTerritory(worldInput, realmId, cellX, cellY, radius, nationId) {
  const world = { ...worldInput };
  const realmIndex = (world.realms || []).findIndex((item) => item.id === realmId);
  const realm = realmIndex >= 0 ? world.realms[realmIndex] : null;
  if (!realm?.map?.cells?.length) return world;
  const brush = Math.max(0, Math.min(8, Number(radius) || 0));
  const owner = nationId || "";
  const cells = realm.map.cells.map((cell) => {
    if (Math.abs(cell.x - cellX) > brush || Math.abs(cell.y - cellY) > brush) return cell;
    return { ...cell, nationId: owner };
  });
  world.realms = world.realms.map((item, index) =>
    index === realmIndex ? { ...realm, map: { ...realm.map, cells } } : item
  );
  return world;
}

// Deterministic value noise used to make borders irregular instead of circular.
const mapNoise = (x, y, seed) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 0.017) * 43758.5453;
  return n - Math.floor(n);
};
const seedOf = (value) =>
  [...String(value)].reduce((sum, char) => sum + char.charCodeAt(0), 0);

const territoryCentroid = (cells) => {
  const owned = (cells || []).filter((cell) => cell.nationId);
  if (!owned.length) return null;
  return {
    x: owned.reduce((sum, cell) => sum + cell.x, 0) / owned.length,
    y: owned.reduce((sum, cell) => sum + cell.y, 0) / owned.length,
  };
};

// Grow or shrink one nation's territory around its centroid. Expansion claims
// the nearest unclaimed cells; shrinking releases the outer cells. A little
// noise keeps the edge organic rather than a perfect circle.
export function scaleNationTerritory(worldInput, realmId, nationId, factor = 1, seed = "") {
  if (!nationId) return worldInput;
  const world = { ...worldInput };
  const realmIndex = (world.realms || []).findIndex((item) => item.id === realmId);
  const realm = realmIndex >= 0 ? world.realms[realmIndex] : null;
  if (!realm?.map?.cells?.length) return world;
  const cells = realm.map.cells;
  const owned = cells.filter((cell) => cell.nationId === nationId);
  if (!owned.length) return world;
  const centroid = territoryCentroid(owned);
  const target = Math.max(1, Math.round(owned.length * Math.max(0.1, Number(factor) || 1) ** 2));
  if (target === owned.length) return world;
  const noiseSeed = seedOf(`${nationId}:${seed}:${realm.id}`);
  const score = (cell) =>
    Math.hypot(cell.x - centroid.x, cell.y - centroid.y) +
    (mapNoise(cell.x, cell.y, noiseSeed) - 0.5) * 3.2;
  const keyOf = (cell) => `${cell.x},${cell.y}`;
  const selected = new Set(
    (target > owned.length
      ? cells.filter((cell) => !cell.nationId).sort((a, b) => score(a) - score(b))
      : [...owned].sort((a, b) => score(b) - score(a))
    )
      .slice(0, Math.abs(target - owned.length))
      .map(keyOf)
  );
  const nextCells = cells.map((cell) => {
    const key = keyOf(cell);
    if (!selected.has(key)) return cell;
    return { ...cell, nationId: target > owned.length ? nationId : "" };
  });
  world.realms = world.realms.map((item, index) =>
    index === realmIndex ? { ...realm, map: { ...realm.map, cells: nextCells } } : item
  );
  return world;
}

// Keep the same rough area but push the border in and out in a noisy pattern.
export function randomizeNationTerritory(worldInput, realmId, nationId, seed = "") {
  if (!nationId) return worldInput;
  const world = { ...worldInput };
  const realmIndex = (world.realms || []).findIndex((item) => item.id === realmId);
  const realm = realmIndex >= 0 ? world.realms[realmIndex] : null;
  if (!realm?.map?.cells?.length) return world;
  const cells = realm.map.cells;
  const owned = cells.filter((cell) => cell.nationId === nationId);
  if (owned.length < 2) return world;
  const centroid = territoryCentroid(owned);
  const noiseSeed = seedOf(`${nationId}:${seed}:${realm.id}`);
  const score = (cell) =>
    Math.hypot(cell.x - centroid.x, cell.y - centroid.y) +
    (mapNoise(cell.x, cell.y, noiseSeed) - 0.5) * 4.5;
  const keyOf = (cell) => `${cell.x},${cell.y}`;
  const churn = Math.max(1, Math.round(owned.length * 0.16));
  const release = new Set(
    [...owned].sort((a, b) => score(b) - score(a)).slice(0, churn).map(keyOf)
  );
  const claim = new Set(
    cells
      .filter((cell) => !cell.nationId)
      .sort((a, b) => score(a) - score(b))
      .slice(0, churn)
      .map(keyOf)
  );
  const nextCells = cells.map((cell) => {
    const key = keyOf(cell);
    if (release.has(key)) return { ...cell, nationId: "" };
    if (claim.has(key)) return { ...cell, nationId };
    return cell;
  });
  world.realms = world.realms.map((item, index) =>
    index === realmIndex ? { ...realm, map: { ...realm.map, cells: nextCells } } : item
  );
  return world;
}

export function regenerateRealmTerrain(worldInput, realmId, { seed = "", biomeIds = [] } = {}) {
  const world = copy(worldInput);
  const realm = (world.realms || []).find((item) => item.id === realmId);
  if (!realm) return world;
  const currentMap = realm.map;
  const scale = SCALES.find((item) => item.id === world.scaleId);
  // One square cell: keep the larger dimension for both axes so the terrain
  // never stretches into rectangles on the 1000×1000 world map.
  const side = Math.max(
    currentMap?.width || scale?.cells?.[0] || 46,
    currentMap?.height || scale?.cells?.[1] || 28
  );
  const width = side;
  const height = side;
  const selectedBiomes =
    biomeIds.length > 0
      ? BIOMES.filter((biome) => biomeIds.includes(biome.id))
      : BIOMES.filter((biome) => realm.biomeIds?.includes(biome.id));
  const biomes = selectedBiomes.length ? selectedBiomes : BIOMES;
  if (biomeIds.length > 0) {
    realm.biomeIds = biomes.map((biome) => biome.id);
    realm.biomeLabels = biomes.map((biome) => biome.label);
  }
  const rng = makeRng(seed || `${world.id}:${realm.id}:terrain:${Date.now()}`);
  realm.map = buildMapCells({
    realm,
    nations: (world.nations || []).filter((nation) => nation.realmId === realm.id),
    settlements: (world.settlements || []).filter((settlement) => settlement.realmId === realm.id),
    rng,
    width,
    height,
    biomes,
  });
  (world.settlements || []).forEach((settlement) => {
    if (settlement.realmId !== realm.id) return;
    const point = cellAt(realm, settlement.x, settlement.y);
    if (!point?.cell) return;
    const biome = BIOMES.find((item) => item.id === point.cell.biome);
    if (!biome) return;
    settlement.biome = biome.id;
    settlement.biomeLabel = biome.label;
    settlement.tags = [
      ...new Set([...(settlement.tags || []).filter((tag) => !BIOMES.some((b) => b.id === tag)), biome.id]),
    ];
  });
  (world.developments || []).forEach((development) => {
    if (development.realmId !== realm.id) return;
    const point = cellAt(realm, development.x, development.y);
    if (!point?.cell) return;
    const biome = BIOMES.find((item) => item.id === point.cell.biome);
    if (!biome) return;
    development.biome = biome.id;
    development.biomeLabel = biome.label;
  });
  world.logs = [
    ...(world.logs || []),
    { at: new Date().toISOString(), text: `${realm.name}: terrain regenerated.` },
  ];
  return world;
}

export function addSettlementOnMap(
  worldInput,
  { realmId = "", nationId = "", kind = "village", x = 500, y = 500, name = "" } = {}
) {
  const result = createSettlementAt(worldInput, {
    realmId,
    nationId,
    kind,
    x,
    y,
    name,
    withNpcs: false,
    withBuildings: false,
    seed: `editor:${Date.now()}`,
  });
  return result;
}

export function moveSettlement(worldInput, settlementId, x, y) {
  const world = copy(worldInput);
  const settlement = (world.settlements || []).find((item) => item.id === settlementId);
  if (!settlement) return world;
  settlement.x = clamp(Number(x) || 0, 0, 1000);
  settlement.y = clamp(Number(y) || 0, 0, 1000);
  const realm = (world.realms || []).find((item) => item.id === settlement.realmId);
  const point = cellAt(realm, settlement.x, settlement.y);
  if (point?.cell) {
    const biome = BIOMES.find((item) => item.id === point.cell.biome);
    if (biome) {
      settlement.biome = biome.id;
      settlement.biomeLabel = biome.label;
    }
  }
  const era = ERAS.find((item) => item.id === world.eraId) || ERAS[4];
  const rng = makeRng(`${world.id}:move:${settlementId}:${Date.now()}`);
  world.routes = (world.routes || []).map((route) => {
    if (route.from !== settlementId && route.to !== settlementId) return route;
    const from = (world.settlements || []).find((item) => item.id === route.from);
    const to = (world.settlements || []).find((item) => item.id === route.to);
    if (!from || !to) return route;
    const next = routeBetween(from, to, era, world.widthKm || 400, rng);
    return { ...next, id: route.id, type: route.type || next.type };
  });
  world.logs = [
    ...(world.logs || []),
    { at: new Date().toISOString(), text: `${settlement.name} moved on the world map.` },
  ];
  return world;
}

export function deleteSettlement(worldInput, settlementId) {
  const world = copy(worldInput);
  const settlement = (world.settlements || []).find((item) => item.id === settlementId);
  if (!settlement) return { world, deleted: null };
  world.settlements = (world.settlements || []).filter((item) => item.id !== settlementId);
  world.routes = (world.routes || []).filter(
    (route) => route.from !== settlementId && route.to !== settlementId
  );
  world.npcs = (world.npcs || []).filter((npc) => npc.settlementId !== settlementId);
  (world.realms || []).forEach((realm) => {
    realm.settlementIds = (realm.settlementIds || []).filter((id) => id !== settlementId);
  });
  (world.nations || []).forEach((nation) => {
    if (nation.capitalId === settlementId) {
      const replacement = (world.settlements || []).find(
        (item) => item.nationId === nation.id && item.kind === "capital"
      ) || (world.settlements || []).find((item) => item.nationId === nation.id);
      nation.capitalId = replacement?.id || "";
    }
  });
  (world.kingdoms || []).forEach((kingdom) => {
    kingdom.provinces = (kingdom.provinces || []).filter(
      (province) => province.settlementId !== settlementId
    );
    kingdom.provinceIds = (kingdom.provinceIds || []).filter((id) => id !== settlementId);
    if (kingdom.loyalty) delete kingdom.loyalty[settlementId];
    kingdom.buildings = (kingdom.buildings || []).filter(
      (building) => building.settlementId !== settlementId
    );
    if (kingdom.capitalId === settlementId) {
      const replacement = (world.settlements || []).find(
        (item) => item.nationId === kingdom.nationId
      );
      kingdom.capitalId = replacement?.id || "";
    }
  });
  (world.developments || []).forEach((development) => {
    if (development.settlementId === settlementId) development.settlementId = "";
  });
  world.logs = [
    ...(world.logs || []),
    { at: new Date().toISOString(), text: `${settlement.name} removed from the world map.` },
  ];
  return { world, deleted: settlement };
}

export function addRouteOnMap(worldInput, fromId, toId, type = "Road") {
  const world = copy(worldInput);
  if (!fromId || !toId || fromId === toId) return { world, error: "Choose two different settlements." };
  const exists = (world.routes || []).some(
    (route) =>
      (route.from === fromId && route.to === toId) ||
      (route.from === toId && route.to === fromId)
  );
  if (exists) return { world, error: "Those settlements are already connected." };
  const from = (world.settlements || []).find((item) => item.id === fromId);
  const to = (world.settlements || []).find((item) => item.id === toId);
  if (!from || !to) return { world, error: "Settlement not found." };
  const era = ERAS.find((item) => item.id === world.eraId) || ERAS[4];
  const route = routeBetween(from, to, era, world.widthKm || 400, makeRng(`${world.id}:${fromId}:${toId}:${Date.now()}`));
  world.routes = [...(world.routes || []), { ...route, type: type || route.type }];
  world.logs = [
    ...(world.logs || []),
    { at: new Date().toISOString(), text: `Route added: ${from.name} to ${to.name}.` },
  ];
  return { world, route };
}

export function removeRouteOnMap(worldInput, routeId) {
  const world = copy(worldInput);
  world.routes = (world.routes || []).filter((route) => route.id !== routeId);
  return world;
}

export function placeDevelopmentOnMap(
  worldInput,
  { kingdomId = "", developmentId = "", x = 500, y = 500 } = {}
) {
  const world = copy(worldInput);
  const kingdom = (world.kingdoms || []).find((item) => item.id === kingdomId);
  const nation = (world.nations || []).find((item) => item.id === kingdom?.nationId);
  const development = DEVELOPMENT_BY_ID[developmentId];
  if (!kingdom || !nation || !development) {
    return { world, error: "Choose a kingdom and development first." };
  }
  const realm = (world.realms || []).find((item) => item.id === nation.realmId);
  const point = cellAt(realm, x, y);
  const biome = BIOMES.find((item) => item.id === point?.cell?.biome) || BIOMES[0];
  const entry = {
    id: `dev_edit_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e5)}`,
    typeId: development.id,
    name: development.name,
    category: development.category,
    nationId: nation.id,
    kingdomId: kingdom.id,
    realmId: realm?.id || nation.realmId,
    x: clamp(Number(x) || 0, 0, 1000),
    y: clamp(Number(y) || 0, 0, 1000),
    biome: biome.id,
    biomeLabel: biome.label,
    terrain: development.terrain,
    status: development.settlementKind ? "building" : "built",
    months: development.months,
    monthsRemaining: development.settlementKind ? development.months : 0,
    startedTurn: kingdom.turn || 1,
    builtTurn: development.settlementKind ? 0 : kingdom.turn || 1,
    benefit: development.benefit,
    mpDamage: development.mpDamage,
    armor: development.armor,
    editorPlaced: true,
  };
  world.developments = [...(world.developments || []), entry];
  world.logs = [
    ...(world.logs || []),
    { at: new Date().toISOString(), text: `${development.name} placed on the world map by the editor.` },
  ];
  return { world, development: entry };
}

export function removeDevelopmentOnMap(worldInput, developmentId) {
  const world = copy(worldInput);
  world.developments = (world.developments || []).filter((item) => item.id !== developmentId);
  return world;
}

// Add one or more generated settlements to a nation, avoiding existing ones.
// Found a new player-owned kingdom from one settlement. The settlement is
// detached from its old nation, nearby map cells are claimed, and the new
// kingdom starts with a blank ledger: one capital province, no free buildings
// beyond what that settlement already has, and minimal starting counts.
export function foundPlayerKingdom(
  worldInput,
  { settlementId = "", name = "", rulerName = "" } = {}
) {
  const world = copy(worldInput);
  const settlement = (world.settlements || []).find((item) => item.id === settlementId);
  if (!settlement) return { world, error: "Choose a settlement to found the kingdom." };
  const realm = (world.realms || []).find((item) => item.id === settlement.realmId);
  if (!realm) return { world, error: "That settlement has no realm." };
  const oldNation = (world.nations || []).find((item) => item.id === settlement.nationId);
  const oldKingdom = (world.kingdoms || []).find((item) => item.id === oldNation?.kingdomId);
  settlement.kind = "capital";
  settlement.typeLabel = "Capital";
  settlement.rulerLevel = Math.max(5, Number(settlement.rulerLevel) || 0);
  // Promote one capital building to the seat of government and regenerate its
  // interior so the new ruler's Bastion facilities and Seat of Power appear.
  const seatOrder = ["Castle", "Palace", "Manor", "Town Hall"];
  const seatBuilding =
    seatOrder
      .map((type) => (settlement.buildings || []).find((building) => building.type === type))
      .find(Boolean) || (settlement.buildings || [])[0] || null;
  if (seatBuilding) {
    settlement.buildings = (settlement.buildings || []).map((building) => {
      const next = { ...building, capitalSeat: building.id === seatBuilding.id };
      return next.capitalSeat
        ? ensureInterior(next, settlement, { force: true })
        : next;
    });
  }
  const stamp = Date.now().toString(36);
  const nationId = `nation_player_${stamp}`;
  const kingdomId = `kingdom_player_${stamp}`;
  const rulerId = `npc_player_${stamp}`;
  const kingdomName = name.trim() || `${settlement.name} Realm`;
  const ruler = {
    id: rulerId,
    name: rulerName.trim() || "Player Ruler",
    first: (rulerName.trim() || "Player").split(" ")[0],
    last: "",
    sex: "",
    age: "",
    abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    culture: oldNation?.culture || "Human",
    role: "ruler",
    occupation: "Ruler",
    personality: {
      trait: "Ambitious",
      ideal: "A crown of one's own.",
      bond: "The people who followed them here.",
      flaw: "Trusts too few people.",
      background: "Founded a new kingdom on the world map.",
    },
    settlementId: settlement.id,
    nationId,
    homeBuildingId: "",
    workBuildingId: "",
    status: "Alive",
    notes: "Player ruler",
    disposition: "allied",
    level: 5,
    player: true,
  };
  const nation = {
    id: nationId,
    name: kingdomName,
    culture: oldNation?.culture || "Human",
    government: "Player Realm",
    realmId: realm.id,
    theme: world.theme,
    color: "#e5c15a",
    centerX: settlement.x,
    centerY: settlement.y,
    capitalId: settlement.id,
    rulerId,
    kingdomId,
    description: "A player-founded kingdom.",
    tags: ["player", "player realm"],
    player: true,
  };
  const oldProvince = (oldKingdom?.provinces || []).find(
    (province) => province.settlementId === settlement.id
  );
  const province = oldProvince
    ? { ...oldProvince, loyalty: 10 }
    : {
        id: `prov_${settlement.id}`,
        settlementId: settlement.id,
        name: settlement.name,
        comfort: "Wretched",
        loyalty: 10,
        size: 100,
        population: settlement.population || 0,
        buildings: (settlement.buildings || []).map((building) => building.id),
        notes: "",
      };
  province.loyalty = 10;
  const kingdom = {
    id: kingdomId,
    name: kingdomName,
    nationId,
    realmId: realm.id,
    era: world.eraId,
    ruler,
    council: [],
    government: "Player Realm",
    culture: nation.culture,
    capitalId: settlement.id,
    provinceIds: [settlement.id],
    provinces: [province],
    stats: { economy: 1, military: 1, influence: 1, prosperity: 1 },
    counts: { ec: 0, mc: 0, ic: 0, pc: 0 },
    treasury: 0,
    resources: { food: 0, wood: 0, stone: 0, metal: 0, cloth: 0, herbs: 0 },
    loyalty: { [settlement.id]: 10 },
    turn: 1,
    month: world.calendar?.month || 1,
    year: world.calendar?.year || 1,
    season: world.calendar?.season || "Spring",
    townCap: 1,
    provinceCap: 1,
    research: [],
    knownResearch: [],
    units: [],
    armies: [],
    caravans: [],
    decrees: [],
    accords: [],
    wars: [],
    tradeRoutes: [],
    buildings: (settlement.buildings || []).map((building) => ({
      id: building.id,
      name: building.name,
      tier: building.comfort || "",
      category: building.category,
      benefit: "",
      settlementId: settlement.id,
      cityBuilding: true,
    })),
    construction: [],
    log: [],
    eventHistory: [],
    activeEvents: [],
    ledger: [],
    ai: { expansion: 1, aggression: 1, trade: 1, culture: 1 },
    relations: {},
    player: true,
  };

  // Detach the settlement from the old kingdom and nation.
  if (oldKingdom) {
    oldKingdom.provinces = (oldKingdom.provinces || []).filter(
      (item) => item.settlementId !== settlement.id
    );
    oldKingdom.provinceIds = (oldKingdom.provinceIds || []).filter(
      (id) => id !== settlement.id
    );
    if (oldKingdom.loyalty) delete oldKingdom.loyalty[settlement.id];
    oldKingdom.buildings = (oldKingdom.buildings || []).filter(
      (building) => building.settlementId !== settlement.id
    );
    if (oldKingdom.capitalId === settlement.id) {
      oldKingdom.capitalId = oldKingdom.provinces[0]?.settlementId || "";
    }
  }
  if (oldNation) {
    if (oldNation.capitalId === settlement.id) {
      const replacement = (world.settlements || []).find(
        (item) => item.nationId === oldNation.id && item.id !== settlement.id
      );
      oldNation.capitalId = replacement?.id || "";
    }
  }
  settlement.nationId = nationId;
  settlement.tags = [...new Set([...(settlement.tags || []), "player", "player settlement"])];
  realm.nationIds = [...new Set([...(realm.nationIds || []), nationId])];

  // Claim nearby cells for the new realm, taking them from the old nation or
  // unclaimed wilderness rather than from third parties.
  if (realm.map?.cells?.length) {
    const cx = Math.max(0, Math.min(realm.map.width - 1, Math.floor((settlement.x / 1000) * realm.map.width)));
    const cy = Math.max(0, Math.min(realm.map.height - 1, Math.floor((settlement.y / 1000) * realm.map.height)));
    realm.map.cells = realm.map.cells.map((cell) => {
      if (Math.abs(cell.x - cx) > 8 || Math.abs(cell.y - cy) > 8) return cell;
      if (cell.nationId && cell.nationId !== oldNation?.id) return cell;
      return { ...cell, nationId };
    });
  }

  const oldNationHasSettlements = (world.settlements || []).some(
    (item) => item.nationId === oldNation?.id && item.id !== settlement.id
  );
  if (!oldNationHasSettlements && oldNation) {
    world.nations = (world.nations || []).filter((item) => item.id !== oldNation.id);
    realm.nationIds = (realm.nationIds || []).filter((id) => id !== oldNation.id);
    if (oldKingdom) {
      world.kingdoms = (world.kingdoms || []).filter((item) => item.id !== oldKingdom.id);
    }
  }
  world.nations = [...(world.nations || []), nation];
  world.kingdoms = [...(world.kingdoms || []), kingdom];
  world.npcs = [...(world.npcs || []), ruler];
  world.logs = [
    ...(world.logs || []),
    {
      at: new Date().toISOString(),
      text: `${kingdomName} founded at ${settlement.name}. The new kingdom starts with a blank ledger.`,
    },
  ];
  return { world, kingdom, nation, settlement };
}

export function generateSettlementsOnMap(
  worldInput,
  { realmId = "", nationId = "", count = 1, kind = "village", seed = "" } = {}
) {
  let world = copy(worldInput);
  const nation = (world.nations || []).find((item) => item.id === nationId);
  const realm = (world.realms || []).find((item) => item.id === (realmId || nation?.realmId));
  if (!nation || !realm) return { world, added: [], error: "Choose a nation first." };
  const rng = makeRng(seed || `${world.id}:${nation.id}:settlements:${Date.now()}`);
  const added = [];
  for (let index = 0; index < Math.max(1, Math.min(20, Number(count) || 1)); index += 1) {
    let spot = null;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const x = 40 + rng.rand() * 920;
      const y = 40 + rng.rand() * 920;
      if ((world.settlements || []).some((item) => Math.hypot(item.x - x, item.y - y) < 55)) continue;
      const point = cellAt(realm, x, y);
      if (point?.cell?.nationId && point.cell.nationId !== nation.id) continue;
      if (["ocean", "void"].includes(point?.cell?.biome)) continue;
      spot = { x, y };
      break;
    }
    if (!spot) break;
    const result = createSettlementAt(world, {
      realmId: realm.id,
      nationId: nation.id,
      kind,
      x: spot.x,
      y: spot.y,
      withNpcs: true,
      seed: `${seed}:${index}`,
    });
    world = result.world;
    if (result.settlement) added.push(result.settlement);
  }
  if (added.length) {
    world.logs = [
      ...(world.logs || []),
      {
        at: new Date().toISOString(),
        text: `${added.length} settlement${added.length === 1 ? "" : "s"} generated in ${nation.name}.`,
      },
    ];
  }
  return { world, added };
}
