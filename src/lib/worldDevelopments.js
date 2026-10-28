// World-map developments from the homebrew table. These are plots planted by a
// nation outside its towns and cities: highways, castles, toll booths, magical
// nexuses, trade ports and similar works. They occupy a world-map space rather
// than a city lot, and some of them (Village, Town) plant a new settlement when
// construction finishes.

import { makeRng, generateNpc, generateSettlementName } from "@/lib/worldNames";
import { BIOMES } from "@/lib/worldBiomes";
import {
  footprintFor,
  BUILDING_COMFORT,
  generateCityLayout,
  facilityClassForComfort,
  facilitySpacesForComfort,
  buildMonthsForComfort,
} from "@/lib/cityLayout";
import { generateInterior } from "@/lib/interiorGen";

export const DEVELOPMENT_TERRAIN_LABELS = {
  Any: "Any",
  Difficult: "Difficult terrain",
  Water: "Water",
  River: "River crossing",
  Highway: "Highway",
  Neutral: "Neutral",
};

const DIFFICULT_BIOMES = new Set([
  "forest",
  "jungle",
  "hills",
  "mountains",
  "swamp",
  "tundra",
  "volcanic",
  "underground",
]);
const WATER_BIOMES = new Set(["coast", "ocean", "swamp", "river"]);

export const WORLD_DEVELOPMENTS = [
  {
    id: "highway",
    name: "Highway",
    category: "Transport",
    cost: { ec: 3 },
    months: 1,
    terrain: "Any",
    requiresRoute: true,
    minSpacing: 24,
    mpDamage: 30,
    armor: 0,
    benefit: "Free movement once per turn; connects provinces.",
  },
  {
    id: "castle",
    name: "Castle",
    category: "Military",
    cost: { mc: 10, pc: 4 },
    months: 2,
    terrain: "Any",
    mpDamage: 70,
    armor: "1d6",
    benefit: "Blocks movement in a 3-space radius without permission; +70 MP and +1 damage die to the province it guards.",
  },
  {
    id: "industrial_encampment",
    name: "Industrial Encampment",
    category: "Industry",
    cost: { ec: 10, pc: 2 },
    months: 1,
    terrain: "Difficult",
    minSpacing: 18,
    mpDamage: 40,
    armor: "1d4",
    benefit: "+2 to one Kingdom stat for 12 turns, then it is destroyed and its Difficult terrain becomes Plain.",
  },
  {
    id: "military_encampment",
    name: "Military Encampment",
    category: "Military",
    cost: { ec: 6, mc: 6 },
    months: 2,
    terrain: "Any",
    minSpacing: 18,
    mpDamage: 60,
    armor: "1d6",
    benefit: "+2 BCR to allies within 6 spaces; provides knights in encounters within 6 miles.",
  },
  {
    id: "toll_booth",
    name: "Toll Booth",
    category: "Transport",
    cost: { ec: 10, pc: 6 },
    months: 1,
    terrain: "Highway",
    requiresRoute: true,
    minSpacing: 30,
    mpDamage: 30,
    armor: 0,
    benefit: "+1 EC per province adjacent to the highway, up to 10 spaces away. Cannot be built within 20 spaces of another Toll Booth on the same highway.",
  },
  {
    id: "lookout_tower",
    name: "Lookout Tower",
    category: "Military",
    cost: { ec: 4, ic: 4 },
    months: 2,
    terrain: "Any",
    minSpacing: 16,
    mpDamage: 30,
    armor: "1d4",
    benefit: "Reveals unit names and cargo within 5 spaces; adds 1d4 damage to up to 3 units within 5 spaces. Does not stack.",
  },
  {
    id: "wall",
    name: "Wall",
    category: "Military",
    cost: { mc: 3 },
    months: 3,
    terrain: "Any",
    minSpacing: 10,
    mpDamage: 50,
    armor: 0,
    benefit: "Blocks movement past this space; +2 MC for a gate version on highways, allowing travel over it.",
  },
  {
    id: "village",
    name: "Village",
    category: "Settlement",
    cost: { ec: 10, mc: 10, pc: 10, ic: 10 },
    months: 3,
    terrain: "Any",
    minSpacing: 30,
    settlementKind: "village",
    benefit: "Creates a Wretched province no closer than 3 spaces to another non-encampment province. Comes with a Shanty, Guide Services, a Garden and three roads.",
  },
  {
    id: "town",
    name: "Town",
    category: "Settlement",
    cost: { ec: 30, mc: 30, pc: 30, ic: 30 },
    months: 3,
    terrain: "Any",
    minSpacing: 60,
    settlementKind: "town",
    benefit: "Creates a Squalid province no closer than 10 spaces to another Squalid-or-better province. Comes with the buildings of a new kingdom, including a Franchise Network.",
  },
  {
    id: "bridge_fort",
    name: "Bridge Fort",
    category: "Transport",
    cost: { mc: 8, ec: 4 },
    months: 2,
    terrain: "River",
    mpDamage: 60,
    armor: "1d6",
    benefit: "Blocks a river crossing; functions as a highway and a castle.",
  },
  {
    id: "magical_nexus",
    name: "Magical Nexus",
    category: "Magic",
    cost: { ec: 15, ic: 8 },
    months: 3,
    terrain: "Difficult",
    minSpacing: 24,
    mpDamage: 20,
    armor: 0,
    benefit: "+5 EC to one research each Recruitment Phase; hostile Domain Magic has no effect within 6 spaces.",
  },
  {
    id: "sacred_grove",
    name: "Sacred Grove",
    category: "Civic",
    cost: { pc: 8, ic: 6 },
    months: 2,
    terrain: "Difficult",
    minSpacing: 22,
    mpDamage: 40,
    armor: "1d4",
    benefit: "+2 loyalty to provinces within 10 spaces.",
  },
  {
    id: "trade_port",
    name: "Trade Port",
    category: "Trade",
    cost: { ec: 12, pc: 6 },
    months: 2,
    terrain: "Water",
    minSpacing: 20,
    mpDamage: 45,
    armor: "1d4",
    benefit: "+2 ECO; enables naval trade.",
  },
  {
    id: "observation_balloon",
    name: "Observation Balloon",
    category: "Military",
    cost: { ec: 5, ic: 3 },
    months: 1,
    terrain: "Any",
    tech: 4,
    minSpacing: 20,
    mpDamage: 10,
    armor: 0,
    benefit: "Reveals an 8-space radius, including spies. Immune to non-flying and non-artillery units.",
  },
  {
    id: "arcanum_simulacrum",
    name: "Arcanum Simulacrum",
    category: "Magic",
    cost: { ic: 10, ec: 8 },
    months: 2,
    terrain: "Any",
    tech: 5,
    minSpacing: 26,
    mpDamage: 35,
    armor: "1d8",
    benefit: "8-space vision. As a Warden or General order, deals 1d8 damage to one military unit within 4 spaces.",
  },
  {
    id: "refugee_camp",
    name: "Refugee Camp",
    category: "Civic",
    cost: { pc: 8, ic: 8 },
    months: 1,
    terrain: "Any",
    minSpacing: 16,
    mpDamage: 25,
    armor: 0,
    benefit: "Steals 1 population capacity per turn from warring provinces within 5 spaces that are not yours. If destroyed, returns the stolen capacity and grants no loyalty penalty.",
  },
  {
    id: "diplomatic_enclave",
    name: "Diplomatic Enclave",
    category: "Diplomacy",
    cost: { ic: 10, ec: 5 },
    months: 2,
    terrain: "Neutral",
    minSpacing: 22,
    mpDamage: 30,
    armor: 0,
    benefit: "Advantage on Accord/FTA negotiations within 10 spaces.",
  },
  {
    id: "open_market",
    name: "Open Market",
    category: "Trade",
    cost: { ic: 8, ec: 8 },
    months: 2,
    terrain: "Neutral",
    minSpacing: 18,
    mpDamage: 30,
    armor: 0,
    benefit: "Each turn during the Trade Sub-Phase, the Steward may exchange up to 2 next-INT resources for INT resources of any type.",
  },
  {
    id: "insurrectionists_operations",
    name: "Insurrectionists Operations",
    category: "Intrigue",
    cost: { ic: 7, ec: 7, mc: 7 },
    months: 4,
    terrain: "Neutral",
    tech: 4,
    minSpacing: 30,
    mpDamage: 60,
    armor: 0,
    benefit: "While building, it is invisible and never triggers combat. When finished it becomes Rebellious under its own control, creates 1 Spearman and 1 Shortbow Archer per Harvest (limit 6), and its units attack anyone within 8 spaces. The builder is revealed when it is destroyed.",
  },
];

export const DEVELOPMENT_BY_ID = Object.fromEntries(
  WORLD_DEVELOPMENTS.map((development) => [development.id, development])
);

// Monthly ledger values for permanent developments. Build costs are paid when
// the plot is planted; these are the recurring income/upkeep entries shown in
// the kingdom ledger.
export const DEVELOPMENT_FINANCE = {
  highway: { income: 1, upkeep: 0 },
  castle: { income: 0, upkeep: 5 },
  industrial_encampment: { income: 3, upkeep: 1 },
  military_encampment: { income: 0, upkeep: 3 },
  toll_booth: { income: 3, upkeep: 0 },
  lookout_tower: { income: 0, upkeep: 1 },
  wall: { income: 0, upkeep: 1 },
  village: { income: 0, upkeep: 0 },
  town: { income: 0, upkeep: 0 },
  bridge_fort: { income: 2, upkeep: 2 },
  magical_nexus: { income: 5, upkeep: 1 },
  sacred_grove: { income: 0, upkeep: 1 },
  trade_port: { income: 6, upkeep: 1 },
  observation_balloon: { income: 0, upkeep: 1 },
  arcanum_simulacrum: { income: 0, upkeep: 2 },
  refugee_camp: { income: 1, upkeep: 1 },
  diplomatic_enclave: { income: 1, upkeep: 1 },
  open_market: { income: 4, upkeep: 1 },
  insurrectionists_operations: { income: 0, upkeep: 0 },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const distance = (a, b) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));

function mapCellAt(realm, x, y) {
  const map = realm?.map;
  if (!map?.cells?.length) return null;
  const cx = clamp(Math.floor((x / 1000) * map.width), 0, map.width - 1);
  const cy = clamp(Math.floor((y / 1000) * map.height), 0, map.height - 1);
  return (
    map.cells.find((cell) => cell.x === cx && cell.y === cy) || {
      x: cx,
      y: cy,
      biome: "grassland",
      nationId: "",
    }
  );
}

function routeDistance(world, x, y) {
  let best = Infinity;
  (world?.routes || []).forEach((route) => {
    const from = (world.settlements || []).find((settlement) => settlement.id === route.from);
    const to = (world.settlements || []).find((settlement) => settlement.id === route.to);
    if (!from || !to) return;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSq = dx * dx + dy * dy || 1;
    const t = clamp(((x - from.x) * dx + (y - from.y) * dy) / lengthSq, 0, 1);
    const px = from.x + t * dx;
    const py = from.y + t * dy;
    best = Math.min(best, Math.hypot(x - px, y - py));
  });
  return best;
}

function nearRouteOfType(world, x, y, types, maxDistance = 18) {
  return (world?.routes || []).some((route) => {
    if (!types.includes(route.type)) return false;
    const from = (world.settlements || []).find((settlement) => settlement.id === route.from);
    const to = (world.settlements || []).find((settlement) => settlement.id === route.to);
    if (!from || !to) return false;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSq = dx * dx + dy * dy || 1;
    const t = clamp(((x - from.x) * dx + (y - from.y) * dy) / lengthSq, 0, 1);
    const px = from.x + t * dx;
    const py = from.y + t * dy;
    return Math.hypot(x - px, y - py) <= maxDistance;
  });
}

function terrainMatches(development, biomeId, world, x, y) {
  const terrain = development.terrain || "Any";
  const nearRoute = routeDistance(world, x, y) <= 18;
  if (development.requiresRoute && !nearRoute) return false;
  if (terrain === "Any") return true;
  if (terrain === "Neutral") return !WATER_BIOMES.has(biomeId);
  if (terrain === "Difficult") return DIFFICULT_BIOMES.has(biomeId);
  if (terrain === "Water") return WATER_BIOMES.has(biomeId);
  if (terrain === "River") {
    return (
      WATER_BIOMES.has(biomeId) ||
      nearRouteOfType(world, x, y, ["River", "Sea route"])
    );
  }
  if (terrain === "Highway") {
    return nearRouteOfType(world, x, y, ["Highway", "Road"]);
  }
  return true;
}

export function developmentSiteFor(world, nation, development, rng = makeRng("development")) {
  const realm = (world?.realms || []).find((item) => item.id === nation?.realmId);
  const settlements = (world?.settlements || []).filter((item) => item.nationId === nation?.id);
  const capital = settlements.find((item) => item.id === nation?.capitalId) || settlements[0];
  const sameKind = development.settlementKind;
  const minSpacing = development.minSpacing || 16;
  let best = null;
  for (let attempt = 0; attempt < 320; attempt += 1) {
    const x = 40 + rng.rand() * 920;
    const y = 40 + rng.rand() * 920;
    if (settlements.some((settlement) => distance(settlement, { x, y }) < 24)) continue;
    if ((world.developments || []).some((item) => distance(item, { x, y }) < 16)) continue;
    if (
      (world.developments || []).some(
        (item) =>
          item.typeId === development.id && distance(item, { x, y }) < minSpacing
      )
    )
      continue;
    if (
      sameKind &&
      (world.settlements || []).some(
        (settlement) =>
          settlement.kind === sameKind &&
          distance(settlement, { x, y }) < (sameKind === "town" ? 60 : 30)
      )
    )
      continue;
    const cell = mapCellAt(realm, x, y);
    if (!terrainMatches(development, cell?.biome, world, x, y)) continue;
    if (cell?.nationId && cell.nationId !== nation.id) continue;
    const distanceFromCapital = capital ? distance(capital, { x, y }) : 0;
    const score = distanceFromCapital + (cell?.nationId === nation.id ? 0 : 20) + rng.rand() * 12;
    if (!best || score < best.score) {
      best = { x: Math.round(x), y: Math.round(y), cell, score };
    }
  }
  if (!best) return null;
  return {
    x: best.x,
    y: best.y,
    biome: best.cell?.biome || "grassland",
    biomeLabel: BIOMES.find((biome) => biome.id === best.cell?.biome)?.label || "Wilderness",
    terrain: development.terrain,
  };
}

export function developmentCostText(development) {
  return (
    Object.entries(development?.cost || {})
      .map(([key, value]) => `${value} ${key.toUpperCase()}`)
      .join(" + ") || "Free"
  );
}

export function canAffordDevelopment(kingdom, development) {
  return Object.entries(development?.cost || {}).every(
    ([key, value]) => (kingdom?.counts?.[key] || 0) >= value
  );
}

export function availableDevelopments(world, kingdomId) {
  const kingdom = (world?.kingdoms || []).find((item) => item.id === kingdomId);
  return WORLD_DEVELOPMENTS.map((development) => ({
    ...development,
    affordable: canAffordDevelopment(kingdom, development),
  }));
}

export function generateWorldDevelopments(world) {
  if (!world) return [];
  const rng = makeRng(`${world.id || world.seed}:developments`);
  const developments = [];
  (world.nations || []).forEach((nation) => {
    const kingdom = (world.kingdoms || []).find((item) => item.nationId === nation.id);
    const settlements = (world.settlements || []).filter((item) => item.nationId === nation.id);
    const biomes = new Set(settlements.map((settlement) => settlement.biome));
    const eraTech =
      Number(world.eraTech) ||
      { medieval: 4, renaissance: 5, industrial: 6, modern: 7, space: 8, cosmos: 9 }[world.eraId] ||
      4;
    const pool = [
      "open_market",
      "lookout_tower",
      "diplomatic_enclave",
      "wall",
      "observation_balloon",
    ];
    if ([...biomes].some((biome) => WATER_BIOMES.has(biome))) {
      pool.push("trade_port", "bridge_fort", "observation_balloon");
    }
    if ([...biomes].some((biome) => ["hills", "mountains", "underground"].includes(biome))) {
      pool.push("industrial_encampment", "military_encampment", "castle");
    }
    if ([...biomes].some((biome) => DIFFICULT_BIOMES.has(biome))) {
      pool.push("magical_nexus", "sacred_grove");
    }
    if ((world.routes || []).some((route) => route.type === "Highway" || route.type === "Road")) {
      pool.push("highway", "toll_booth");
    }
    if (eraTech >= 5) pool.push("arcanum_simulacrum");
    if (eraTech >= 4 && (world.theme || "").toLowerCase().includes("dark")) {
      pool.push("insurrectionists_operations");
    }
    const chosen = rng.shuffle([...new Set(pool)]).slice(0, rng.int(2, 4));
    chosen.forEach((id) => {
      const development = DEVELOPMENT_BY_ID[id];
      if (!development) return;
      const site = developmentSiteFor(world, nation, development, rng);
      if (!site) return;
      if (developments.some((item) => distance(item, site) < 16)) return;
      developments.push({
        id: `dev_${world.id || "w"}_${id}_${developments.length}_${Math.floor(rng.rand() * 1e5)}`,
        typeId: id,
        name: development.name,
        category: development.category,
        nationId: nation.id,
        kingdomId: kingdom?.id || "",
        realmId: nation.realmId,
        x: site.x,
        y: site.y,
        biome: site.biome,
        biomeLabel: site.biomeLabel,
        terrain: development.terrain,
        status: "built",
        months: development.months,
        monthsRemaining: 0,
        builtTurn: kingdom?.turn || 1,
        benefit: development.benefit,
        mpDamage: development.mpDamage,
        armor: development.armor,
      });
    });
  });
  return developments;
}

export function placeDevelopment(worldInput, kingdomId, developmentId) {
  const world = JSON.parse(JSON.stringify(worldInput));
  const kingdom = (world.kingdoms || []).find((item) => item.id === kingdomId);
  const nation = (world.nations || []).find((item) => item.id === kingdom?.nationId);
  const development = DEVELOPMENT_BY_ID[developmentId];
  if (!kingdom || !nation || !development) {
    return { error: "That development is not available to this kingdom." };
  }
  if (!canAffordDevelopment(kingdom, development)) {
    return { error: "The kingdom cannot afford that development." };
  }
  const rng = makeRng(`${world.id}:${developmentId}:${Date.now()}`);
  const site = developmentSiteFor(world, nation, development, rng);
  if (!site) {
    return { error: `No valid ${development.terrain.toLowerCase()} site is available for ${development.name}.` };
  }
  Object.entries(development.cost || {}).forEach(([key, value]) => {
    kingdom.counts[key] = Math.max(0, (kingdom.counts[key] || 0) - value);
  });
  const entry = {
    id: `dev_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e5)}`,
    typeId: developmentId,
    name: development.name,
    category: development.category,
    nationId: nation.id,
    kingdomId: kingdom.id,
    realmId: nation.realmId,
    x: site.x,
    y: site.y,
    biome: site.biome,
    biomeLabel: site.biomeLabel,
    terrain: development.terrain,
    status: "building",
    months: development.months,
    monthsRemaining: development.months,
    startedTurn: kingdom.turn || 1,
    benefit: development.benefit,
    mpDamage: development.mpDamage,
    armor: development.armor,
  };
  world.developments = [...(world.developments || []), entry];
  world.logs = [
    ...(world.logs || []),
    {
      at: new Date().toISOString(),
      text: `${kingdom.name} plants ${development.name} at ${site.biomeLabel} (${development.months} month${development.months === 1 ? "" : "s"}).`,
    },
  ];
  return { world, development: entry };
}

const VILLAGE_BUILDINGS = [
  { type: "Shanty", category: "Residential", district: "Residential", rooms: ["Living Room", "Storage"] },
  { type: "Shanty", category: "Residential", district: "Residential", rooms: ["Living Room", "Storage"] },
  { type: "Cottage", category: "Residential", district: "Residential", rooms: ["Living Room", "Bedroom", "Kitchen"] },
  { type: "Cottage", category: "Residential", district: "Residential", rooms: ["Living Room", "Bedroom", "Kitchen"] },
  { type: "Cottage", category: "Residential", district: "Residential", rooms: ["Living Room", "Bedroom"] },
  { type: "Farm", category: "Food", district: "Farm", rooms: ["Farmhouse", "Barn", "Granary"] },
  { type: "Farm", category: "Food", district: "Farm", rooms: ["Farmhouse", "Barn"] },
  { type: "Tavern", category: "Commercial", district: "Road", rooms: ["Common Room", "Kitchen", "Cellar"] },
  { type: "Guide Services", category: "Civic", district: "Road", rooms: ["Office", "Bunk Room"] },
  { type: "Garden", category: "Food", district: "Farm", rooms: ["Garden", "Shed"] },
];

const TOWN_BUILDINGS = [
  { type: "Town Hall", category: "Civic", district: "Noble", rooms: ["Hall", "Office", "Archive", "Cells"] },
  { type: "Tavern", category: "Commercial", district: "Market", rooms: ["Common Room", "Kitchen", "Cellar"] },
  { type: "Inn", category: "Commercial", district: "Gate", rooms: ["Common Room", "Kitchen", "Bedroom", "Bath"] },
  { type: "Townhouse", category: "Residential", district: "Residential", rooms: ["Living Room", "Bedroom", "Kitchen"] },
  { type: "Townhouse", category: "Residential", district: "Residential", rooms: ["Living Room", "Bedroom", "Kitchen"] },
  { type: "Cottage", category: "Residential", district: "Residential", rooms: ["Living Room", "Bedroom", "Kitchen"] },
  { type: "Cottage", category: "Residential", district: "Residential", rooms: ["Living Room", "Bedroom"] },
  { type: "Market Hall", category: "Commercial", district: "Market", rooms: ["Hall", "Stalls", "Office"] },
  { type: "Temple", category: "Civic", district: "Temple", rooms: ["Sanctuary", "Shrine", "Vestry"] },
  { type: "Barracks", category: "Military", district: "Barracks", rooms: ["Bunk Room", "Armory", "Mess Hall"] },
  { type: "Courthouse", category: "Civic", district: "Noble", rooms: ["Courtroom", "Archive", "Office"] },
  { type: "Guildhall", category: "Civic", district: "Market", rooms: ["Meeting Hall", "Office", "Treasury"] },
  { type: "Farm", category: "Food", district: "Farm", rooms: ["Farmhouse", "Barn", "Granary"] },
  { type: "Farm", category: "Food", district: "Farm", rooms: ["Farmhouse", "Barn"] },
  { type: "Blacksmith", category: "Industrial", district: "Craft", rooms: ["Smithy", "Workshop", "Storage"] },
  { type: "Bakery", category: "Food", district: "Market", rooms: ["Bakery", "Kitchen", "Storage"] },
  { type: "Library", category: "Civic", district: "Noble", rooms: ["Reading Room", "Archive", "Study"] },
];

function makeDevelopmentBuilding({ template, settlement, eraId, rng, index }) {
  const comfort = BUILDING_COMFORT[template.type] || "Poor";
  const footprintSize = footprintFor(comfort);
  const floors = template.type === "Town Hall" || template.type === "Temple" ? 2 : rng.int(1, 2);
  const footprint = { w: footprintSize, h: footprintSize };
  const id = `bld_${settlement.id}_${index}_${Math.floor(rng.rand() * 1e6).toString(36)}`;
  const interior = generateInterior({
    building: { id, type: template.type, floors, comfort },
    footprint,
    floors,
    roomTypes: template.rooms,
    facilityClass: facilityClassForComfort(comfort),
    rng,
  });
  return {
    id,
    name: `${template.type} of ${settlement.name}`,
    type: template.type,
    category: template.category,
    district: template.district,
    floors,
    size: footprint,
    comfort,
    footprint,
    facilityClass: facilityClassForComfort(comfort),
    facilitySpaces: facilitySpacesForComfort(comfort),
    buildMonths: buildMonthsForComfort(comfort),
    interior,
    rooms: interior.rooms,
    workstations: [],
    floorTexture: interior.rooms[0]?.floorTexture || "stone",
    propertyValue: Math.round(footprint.w * footprint.h * floors * 120),
    ownerId: "",
    residentIds: [],
    staffIds: [],
    notes: "",
    terrain: [],
    era: eraId,
  };
}

function spawnDevelopmentSettlement(world, development, kingdom) {
  const nation = (world.nations || []).find((item) => item.id === development.nationId);
  const realm = (world.realms || []).find((item) => item.id === development.realmId);
  if (!nation || !realm) return null;
  if (
    (world.settlements || []).some(
      (settlement) => distance(settlement, development) < 12
    )
  ) {
    return null;
  }
  const rng = makeRng(`${world.id}:${development.id}:settlement`);
  const kind = development.typeId === "town" ? "town" : "village";
  const id = `set_dev_${Date.now().toString(36)}_${Math.floor(rng.rand() * 1e5)}`;
  const name = generateSettlementName(nation.culture, rng, kind);
  const templates = kind === "town" ? TOWN_BUILDINGS : VILLAGE_BUILDINGS;
  const biomeLabel = BIOMES.find((biome) => biome.id === development.biome)?.label || "Wilderness";
  const settlement = {
    id,
    realmId: realm.id,
    nationId: nation.id,
    name,
    kind,
    typeLabel: kind === "town" ? "Town" : "Village",
    x: development.x,
    y: development.y,
    biome: development.biome,
    biomeLabel,
    population: kind === "town" ? rng.int(700, 2400) : rng.int(80, 500),
    prosperity: kind === "town" ? rng.int(3, 6) : rng.int(1, 4),
    defense: kind === "town" ? rng.int(2, 6) : rng.int(1, 3),
    tags: [development.biome, kind, "development"],
    districts: [],
    buildings: [],
    npcIds: [],
    notes: `Founded by ${kingdom?.name || nation.name} as a ${development.name.toLowerCase()} development.`,
    mapSeed: rng.int(1, 999999),
  };
  settlement.buildings = templates.map((template, index) =>
    makeDevelopmentBuilding({
      template,
      settlement,
      eraId: kingdom?.era || world.eraId,
      rng,
      index,
    })
  );
  settlement.districts = [...new Set(settlement.buildings.map((building) => building.district))];
  // A handful of locals so the new plot is alive.
  const localCount = kind === "town" ? 8 : 4;
  for (let i = 0; i < localCount; i += 1) {
    const npc = generateNpc({
      culture: nation.culture,
      role: "settlement",
      settlementKind: kind,
      rng,
      settlementId: id,
      nationId: nation.id,
    });
    const home = rng.pick(settlement.buildings.filter((building) => building.category === "Residential"));
    const work = rng.pick(settlement.buildings);
    npc.homeBuildingId = home?.id || "";
    npc.workBuildingId = work?.id || "";
    npc.schedule = [
      { start: 0, end: 6, place: "home", buildingId: npc.homeBuildingId, label: "Sleeping" },
      { start: 6, end: 8, place: "home", buildingId: npc.homeBuildingId, label: "Morning routine" },
      { start: 8, end: 18, place: "work", buildingId: npc.workBuildingId, label: "Working" },
      { start: 18, end: 21, place: "tavern", buildingId: settlement.buildings.find((b) => b.type === "Tavern")?.id || "", label: "Evening at the tavern" },
      { start: 21, end: 24, place: "home", buildingId: npc.homeBuildingId, label: "Sleeping" },
    ];
    npc.currentLocation = { place: "work", buildingId: npc.workBuildingId, label: "Working" };
    home?.residentIds.push(npc.id);
    work?.staffIds.push(npc.id);
    settlement.npcIds.push(npc.id);
    world.npcs.push(npc);
  }
  settlement.mapLayout = generateCityLayout(settlement, settlement.buildings);
  world.settlements.push(settlement);
  realm.settlementIds = [...new Set([...(realm.settlementIds || []), id])];
  if (kingdom) {
    const province = {
      id: `prov_${id}`,
      settlementId: id,
      name,
      comfort: kind === "town" ? "Squalid" : "Wretched",
      loyalty: 8,
      size: kind === "town" ? 400 : 100,
      population: settlement.population,
      buildings: settlement.buildings.map((building) => building.id),
      notes: settlement.notes,
    };
    kingdom.provinces = [...(kingdom.provinces || []), province];
    kingdom.provinceIds = [...new Set([...(kingdom.provinceIds || []), id])];
    kingdom.loyalty = { ...(kingdom.loyalty || {}), [id]: 8 };
  }
  world.logs = [
    ...(world.logs || []),
    {
      at: new Date().toISOString(),
      text: `${development.name} completed: ${name} founded as a ${kind} of ${nation.name}.`,
    },
  ];
  return settlement;
}

function completeDevelopmentBenefit(world, development, kingdom) {
  if (!kingdom) return [];
  const log = [];
  switch (development.typeId) {
    case "trade_port":
      kingdom.stats.economy += 2;
      kingdom.flags = { ...(kingdom.flags || {}), navalTrade: true };
      log.push("Trade Port open: +2 ECO and naval trade enabled.");
      break;
    case "sacred_grove":
      kingdom.loyalty = { ...(kingdom.loyalty || {}) };
      Object.keys(kingdom.loyalty).forEach((id) => {
        kingdom.loyalty[id] = Math.min(20, (kingdom.loyalty[id] || 0) + 2);
      });
      log.push("Sacred Grove consecrated: +2 loyalty to provinces.");
      break;
    case "magical_nexus":
      kingdom.counts.ec += 5;
      kingdom.flags = { ...(kingdom.flags || {}), nexus: true };
      log.push("Magical Nexus attuned: +5 EC to research.");
      break;
    case "open_market":
      kingdom.flags = { ...(kingdom.flags || {}), openMarket: true };
      log.push("Open Market chartered: the Steward can exchange resources each turn.");
      break;
    case "diplomatic_enclave":
      kingdom.flags = { ...(kingdom.flags || {}), diplomaticEnclave: true };
      log.push("Diplomatic Enclave opened: advantage on nearby accords.");
      break;
    case "observation_balloon":
      kingdom.flags = { ...(kingdom.flags || {}), observationBalloon: true };
      log.push("Observation Balloon aloft: 8-space vision.");
      break;
    case "arcanum_simulacrum":
      kingdom.flags = { ...(kingdom.flags || {}), arcanum: true };
      log.push("Arcanum Simulacrum activated: one 1d8 strike per turn.");
      break;
    case "toll_booth":
      kingdom.counts.ec += 2;
      log.push("Toll Booth collecting: +2 EC.");
      break;
    case "village":
    case "town": {
      const settlement = spawnDevelopmentSettlement(world, development, kingdom);
      if (settlement) {
        development.settlementId = settlement.id;
        log.push(`${settlement.name} founded.`);
      }
      break;
    }
    default:
      break;
  }
  return log;
}

// Called from the kingdom turn. Mutates world.developments and returns log lines.
export function advanceDevelopments(kingdom, world) {
  if (!world || !kingdom) return [];
  const log = [];
  (world.developments || []).forEach((development) => {
    if (development.kingdomId !== kingdom.id || development.status !== "building") return;
    development.monthsRemaining = Math.max(0, (development.monthsRemaining || 1) - 1);
    if (development.monthsRemaining === 0) {
      development.status = "built";
      development.builtTurn = kingdom.turn || 1;
      log.push(`${development.name} completed.`);
      log.push(...completeDevelopmentBenefit(world, development, kingdom));
    } else {
      log.push(`${development.name} continues (${development.monthsRemaining} month${development.monthsRemaining === 1 ? "" : "s"} left).`);
    }
  });
  return log;
}

export function developmentsForNation(world, nationId) {
  return (world?.developments || []).filter((development) => development.nationId === nationId);
}
