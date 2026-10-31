import {
  CULTURES,
  generateKingdomName,
  generateNpc,
  generateRealmName,
  generateSettlementName,
  generateTavernName,
  makeRng,
} from "@/lib/worldNames";

import { BIOMES } from "@/lib/worldBiomes";
import {
  applyCityLayout,
  BUILDING_COMFORT,
  adjustComfort,
  footprintFor,
  facilityClassForComfort,
  facilitySpacesForComfort,
  buildMonthsForComfort,
} from "@/lib/cityLayout";
import { generateInterior } from "@/lib/interiorGen";
import { generateWorldDevelopments } from "@/lib/worldDevelopments";

export { BIOMES };

export const ERAS = [
  { id: "caveman", label: "Caveman", tech: 0, travel: { walk: 4, horse: 0, cart: 0, ship: 2, airship: 0, portal: 0 }, description: "Stone, bone and survival." },
  { id: "bronze", label: "Bronze Age", tech: 1, travel: { walk: 4, horse: 0, cart: 4, ship: 6, airship: 0, portal: 0 }, description: "First cities, bronze, river kingdoms." },
  { id: "iron", label: "Iron Age", tech: 2, travel: { walk: 4, horse: 7, cart: 5, ship: 8, airship: 0, portal: 0 }, description: "Iron, hill forts and raiding fleets." },
  { id: "classical", label: "Classical", tech: 3, travel: { walk: 4, horse: 9, cart: 5, ship: 11, airship: 0, portal: 0 }, description: "Empires, roads, legions and forums." },
  { id: "medieval", label: "Medieval", tech: 4, travel: { walk: 4, horse: 10, cart: 5, ship: 12, airship: 0, portal: 0 }, description: "Kingdoms, castles, guilds and crusades." },
  { id: "renaissance", label: "Renaissance", tech: 5, travel: { walk: 4, horse: 11, cart: 6, ship: 14, airship: 0, portal: 0 }, description: "Gunpowder, printing, courts and exploration." },
  { id: "industrial", label: "Industrial", tech: 6, travel: { walk: 4, horse: 11, cart: 6, ship: 16, airship: 20, portal: 0 }, description: "Steam, rail, factories and empire." },
  { id: "modern", label: "Modern", tech: 7, travel: { walk: 5, horse: 12, cart: 7, ship: 25, airship: 60, portal: 0 }, description: "Nations, media, machines and global trade." },
  { id: "space", label: "Spacefaring", tech: 8, travel: { walk: 5, horse: 12, cart: 7, ship: 35, airship: 120, portal: 0 }, description: "Planets, stations, colonies and void lanes." },
  { id: "cosmos", label: "Cosmos", tech: 9, travel: { walk: 6, horse: 14, cart: 8, ship: 60, airship: 300, portal: 1000 }, description: "Realms, planes, gods and star-spanning powers." },
];

export const THEMES = [
  "High Fantasy", "Dark Fantasy", "Grimdark", "Mythic", "Fairy Tale", "Sword & Sorcery",
  "Steampunk", "Gaslamp", "Science Fantasy", "Space Opera", "Post-Apocalyptic",
  "Cosmic Horror", "Wuxia", "Age of Sail", "Frontier", "Political Intrigue",
];

export const SCALES = [
  { id: "town", label: "Town", nations: [1, 1], settlements: [2, 4], widthKm: 40, cells: [28, 18], realms: [1, 1], description: "A single town and its hinterland." },
  { id: "city-state", label: "City-State", nations: [1, 2], settlements: [3, 6], widthKm: 120, cells: [36, 22], realms: [1, 1], description: "A city and the villages that feed it." },
  { id: "kingdom", label: "Kingdom", nations: [2, 4], settlements: [8, 14], widthKm: 400, cells: [46, 28], realms: [1, 1], description: "Several kingdoms sharing a region." },
  { id: "nation", label: "Nation", nations: [3, 6], settlements: [14, 24], widthKm: 1200, cells: [56, 34], realms: [1, 1], description: "A continent-sized nation and its neighbours." },
  { id: "continent", label: "Continent", nations: [5, 8], settlements: [22, 34], widthKm: 3500, cells: [64, 40], realms: [1, 2], description: "A whole continent of powers." },
  { id: "world", label: "World", nations: [6, 10], settlements: [30, 45], widthKm: 12000, cells: [72, 44], realms: [1, 3], description: "A full world with multiple realms or continents." },
  { id: "solar", label: "Solar System", nations: [6, 10], settlements: [24, 40], widthKm: 900000000, cells: [60, 36], realms: [2, 4], description: "Planets, moons and orbital settlements." },
  { id: "galactic", label: "Galactic", nations: [8, 14], settlements: [30, 55], widthKm: 100000, cells: [64, 40], realms: [3, 6], description: "Star clusters and interstellar powers." },
  { id: "multiverse", label: "Multiverse", nations: [6, 12], settlements: [24, 45], widthKm: 100000, cells: [60, 36], realms: [3, 5], description: "Planes, planets and parallel realms." },
];

// BIOMES lives in worldBiomes.js so the city and development generators can
// share it without importing worldGen.

export const GOVERNMENTS = [
  "Monarchy", "Feudal Monarchy", "Elective Kingdom", "Council Republic", "Oligarchy",
  "Theocracy", "Magocracy", "Merchant League", "Clan Confederacy", "Military Junta",
  "Hive Mind", "AI Directorate", "Divine Imperium",
];

export const CULTURE_BY_THEME = {
  "High Fantasy": ["Human", "Elven", "Dwarven", "Halfling", "Orcish", "Gnomish"],
  "Dark Fantasy": ["Human", "Elven", "Dwarven", "Orcish", "Infernal"],
  Grimdark: ["Human", "Orcish", "Infernal", "Giant"],
  Mythic: ["Human", "Celestial", "Giant", "Draconic"],
  "Fairy Tale": ["Human", "Elven", "Halfling", "Gnomish"],
  "Sword & Sorcery": ["Human", "Draconic", "Orcish", "Infernal"],
  Steampunk: ["Human", "Gnomish", "Dwarven"],
  Gaslamp: ["Human", "Elven", "Infernal"],
  "Science Fantasy": ["Human", "Alien", "Elven", "Cosmic"],
  "Space Opera": ["Human", "Alien", "Cosmic"],
  "Post-Apocalyptic": ["Human", "Orcish", "Alien"],
  "Cosmic Horror": ["Human", "Cosmic", "Alien", "Infernal"],
  Wuxia: ["Human", "Celestial", "Draconic"],
  "Age of Sail": ["Human", "Halfling", "Elven"],
  Frontier: ["Human", "Dwarven", "Orcish", "Halfling"],
  "Political Intrigue": ["Human", "Elven", "Dwarven", "Infernal"],
};

const NATION_COLORS = ["#4f7cac", "#a44a4a", "#6b8e4e", "#8a6fbf", "#c08a3e", "#3f8f8a", "#b45f8c", "#7c7c8a", "#b07a4a", "#4a9a6a"];

export const ERA_TECH_LABEL = Object.fromEntries(ERAS.map((era) => [era.id, era.label]));

const SETTLEMENT_KINDS = {
  capital: "Capital",
  city: "City",
  town: "Town",
  village: "Village",
  camp: "Camp",
  station: "Station",
  plane: "Planar hub",
};

const BUILDING_TEMPLATES = [
  // Civic anchors
  { type: "Town Hall", category: "Civic", comfort: "Modest", districts: ["Noble", "Market"], floors: [2, 3], rooms: ["Hall", "Office", "Archive", "Cells"], workstations: ["Records", "Council Table"], terrain: [], prereq: [], kinds: ["town", "city", "capital", "station", "plane"] },
  { type: "Courthouse", category: "Civic", comfort: "Modest", districts: ["Noble", "Market"], floors: [2, 3], rooms: ["Courtroom", "Archive", "Office", "Cells"], workstations: ["Judge's Bench", "Records", "Cells"], terrain: [], prereq: ["Town Hall"], kinds: ["town", "city", "capital"] },
  { type: "Guildhall", category: "Civic", comfort: "Modest", districts: ["Craft", "Market"], floors: [2, 4], rooms: ["Meeting Hall", "Office", "Archive", "Treasury", "Kitchen"], workstations: ["Ledger", "Council Table"], terrain: [], prereq: ["Market Hall"], kinds: ["town", "city", "capital"] },
  { type: "Library", category: "Civic", comfort: "Modest", districts: ["Noble", "Temple"], floors: [2, 3], rooms: ["Reading Room", "Archive", "Study", "Office"], workstations: ["Desk", "Shelves", "Scriptorium"], terrain: [], prereq: ["Town Hall"], kinds: ["city", "capital"] },
  { type: "Temple", category: "Civic", comfort: "Comfortable", districts: ["Temple", "Noble"], floors: [1, 3], rooms: ["Sanctuary", "Shrine", "Vestry", "Hall", "Garden"], workstations: ["Altar", "Reliquary", "Font"], terrain: [], prereq: [], kinds: ["town", "city", "capital", "station", "plane"] },
  { type: "Guide Services", category: "Civic", comfort: "Wretched", districts: ["Road", "Market"], floors: [1, 1], rooms: ["Office", "Bunk Room"], workstations: ["Map Table"], terrain: [], prereq: [], kinds: ["village", "town", "city", "capital"], repeatable: 2 },
  // Commerce and hospitality
  { type: "Tavern", category: "Commercial", comfort: "Poor", districts: ["Market", "Road"], floors: [1, 2], rooms: ["Common Room", "Kitchen", "Cellar", "Bedroom"], workstations: ["Bar", "Brewing", "Cooking", "Tables"], terrain: [], prereq: [], kinds: ["village", "town", "city", "capital", "station", "plane"], repeatable: 2 },
  { type: "Inn", category: "Commercial", comfort: "Poor", districts: ["Market", "Gate"], floors: [2, 4], rooms: ["Common Room", "Kitchen", "Bedroom", "Bath", "Storage"], workstations: ["Bar", "Cooking", "Laundry", "Stable"], terrain: [], prereq: ["Tavern"], kinds: ["town", "city", "capital", "station", "plane"], repeatable: 2 },
  { type: "Market Hall", category: "Commercial", comfort: "Modest", districts: ["Market"], floors: [1, 2], rooms: ["Hall", "Stalls", "Office", "Storage"], workstations: ["Stalls", "Scales", "Ledger"], terrain: [], prereq: [], kinds: ["town", "city", "capital", "station", "plane"] },
  // Homes
  { type: "Shanty", category: "Residential", comfort: "Wretched", districts: ["Residential", "Outskirts"], floors: [1, 1], rooms: ["Living Room", "Storage"], workstations: ["Hearth"], terrain: [], prereq: [], kinds: ["village", "town", "camp"], repeatable: 3 },
  { type: "Cottage", category: "Residential", comfort: "Squalid", districts: ["Residential", "Farm"], floors: [1, 2], rooms: ["Living Room", "Bedroom", "Kitchen", "Storage"], workstations: ["Hearth", "Loom"], terrain: [], prereq: [], kinds: ["village", "town", "city", "capital", "camp"], repeatable: 3 },
  { type: "Townhouse", category: "Residential", comfort: "Poor", districts: ["Residential"], floors: [2, 3], rooms: ["Living Room", "Bedroom", "Kitchen", "Privy"], workstations: ["Hearth", "Desk"], terrain: [], prereq: [], kinds: ["village", "town", "city", "capital"], repeatable: 3 },
  { type: "Manor", category: "Residential", comfort: "Comfortable", districts: ["Noble", "Garden"], floors: [2, 4], rooms: ["Great Hall", "Bedroom", "Kitchen", "Library", "Study", "Bath", "Servant's Room"], workstations: ["Desk", "Hearth", "Wine Cellar"], terrain: [], prereq: ["Townhouse"], kinds: ["city", "capital"] },
  // Industry and services
  { type: "Blacksmith", category: "Industrial", comfort: "Poor", districts: ["Craft", "Gate"], floors: [1, 2], rooms: ["Smithy", "Workshop", "Storage", "Office"], workstations: ["Forge", "Anvil", "Quench", "Grindstone"], terrain: [], prereq: [], kinds: ["village", "town", "city", "capital"], repeatable: 2 },
  { type: "Alchemist", category: "Industrial", comfort: "Poor", districts: ["Craft", "Market"], floors: [1, 2], rooms: ["Laboratory", "Storage", "Shop", "Office"], workstations: ["Alembic", "Workbench", "Shelves"], terrain: [], prereq: ["Apothecary"], kinds: ["town", "city", "capital"] },
  { type: "Stable", category: "Service", comfort: "Squalid", districts: ["Gate", "Farm"], floors: [1, 1], rooms: ["Stalls", "Tack Room", "Hayloft", "Yard"], workstations: ["Stalls", "Feed", "Farrier"], terrain: [], prereq: ["Farm"], kinds: ["village", "town", "city", "capital"], repeatable: 2 },
  { type: "Mill", category: "Industrial", comfort: "Poor", districts: ["Farm", "River"], floors: [1, 3], rooms: ["Mill Floor", "Grain Store", "Office"], workstations: ["Millstone", "Hopper", "Sacks"], terrain: [], prereq: ["Farm"], kinds: ["village", "town", "city"], repeatable: 2 },
  { type: "Dock", category: "Service", comfort: "Modest", districts: ["Docks"], floors: [1, 2], rooms: ["Warehouse", "Office", "Bunk Room", "Pier"], workstations: ["Crane", "Scales", "Ledger"], terrain: ["coast", "ocean", "river"], prereq: [], kinds: ["village", "town", "city", "capital", "station"] },
  { type: "Mine", category: "Industrial", comfort: "Modest", districts: ["Craft", "Outskirts"], floors: [1, 3], rooms: ["Shaft Head", "Ore Store", "Office", "Bunk Room"], workstations: ["Winch", "Crusher", "Cart"], terrain: ["mountain", "hills", "underground"], prereq: [], kinds: ["village", "town", "city", "capital"] },
  { type: "Apothecary", category: "Service", comfort: "Poor", districts: ["Market", "Residential"], floors: [1, 2], rooms: ["Shop", "Laboratory", "Storage", "Treatment Room"], workstations: ["Herb Rack", "Mortar", "Alembic"], terrain: [], prereq: [], kinds: ["village", "town", "city", "capital"] },
  { type: "Bakery", category: "Food", comfort: "Poor", districts: ["Market", "Residential"], floors: [1, 2], rooms: ["Bakery", "Kitchen", "Storage", "Shop"], workstations: ["Oven", "Kneading Table", "Sacks"], terrain: [], prereqAny: [["Farm"], ["Mill"]], kinds: ["village", "town", "city", "capital"], repeatable: 2 },
  { type: "Warehouse", category: "Industrial", comfort: "Modest", districts: ["Docks", "Market"], floors: [1, 3], rooms: ["Storage", "Office", "Loading Bay"], workstations: ["Crane", "Scales", "Shelves"], terrain: [], prereqAny: [["Market Hall"], ["Dock"]], kinds: ["town", "city", "capital"] },
  { type: "Bathhouse", category: "Service", comfort: "Modest", districts: ["Residential", "Noble"], floors: [1, 2], rooms: ["Bath", "Steam Room", "Changing Room", "Office"], workstations: ["Furnace", "Tubs", "Laundry"], terrain: [], prereq: ["Town Hall"], tech: 3, kinds: ["town", "city", "capital"] },
  // Food and military
  { type: "Farm", category: "Food", comfort: "Squalid", districts: ["Farm", "Outskirts"], floors: [1, 2], rooms: ["Farmhouse", "Barn", "Granary", "Yard"], workstations: ["Plow", "Churn", "Looms"], terrain: [], prereq: [], kinds: ["village", "town", "city", "capital", "camp"], repeatable: 4 },
  { type: "Garden", category: "Food", comfort: "Squalid", districts: ["Garden", "Farm"], floors: [1, 1], rooms: ["Garden", "Shed"], workstations: ["Herb Rack", "Well"], terrain: [], prereq: [], kinds: ["village", "town", "city", "capital"], repeatable: 2 },
  { type: "Barracks", category: "Military", comfort: "Modest", districts: ["Barracks", "Gate"], floors: [1, 3], rooms: ["Bunk Room", "Armory", "Mess Hall", "Office", "Drill Hall"], workstations: ["Weapon Rack", "Training Dummy", "Map Table"], terrain: [], prereqAny: [["Watchtower"], ["Castle"]], kinds: ["town", "city", "capital", "station"] },
  { type: "Watchtower", category: "Military", comfort: "Modest", districts: ["Gate", "Outskirts"], floors: [2, 4], rooms: ["Watch Room", "Bunk Room", "Signal Room", "Armory"], workstations: ["Signal Fire", "Map Table"], terrain: [], prereq: [], kinds: ["village", "town", "city", "capital", "station"] },
  { type: "Castle", category: "Military", comfort: "Wealthy", districts: ["Noble", "Gate"], floors: [3, 6], rooms: ["Great Hall", "Throne Room", "Barracks", "Armory", "Kitchen", "Dungeon", "Tower"], workstations: ["Throne", "War Room", "Forge", "Gate"], terrain: [], prereq: ["Town Hall"], kinds: ["city", "capital"] },
  // Extra civic pieces used by development settlements.
  { type: "Well", category: "Civic", comfort: "Wretched", districts: ["Market", "Residential"], floors: [1, 1], rooms: ["Well"], workstations: ["Well"], terrain: [], prereq: [], kinds: ["village", "town", "city", "capital"], repeatable: 2 },
];

function pickRealmCount(scale, rng) {
  const [min, max] = scale.realms;
  return rng.int(min, max);
}

function realmKind(scale) {
  if (scale.id === "multiverse") return "plane";
  if (scale.id === "solar" || scale.id === "galactic") return "planet";
  if (scale.id === "world" || scale.id === "continent") return "realm";
  return "region";
}

export function buildMapCells({ realm, nations, settlements, rng, width, height, biomes }) {
  const cells = [];
  const centers = nations.map((nation) => {
    const capital = settlements.find((s) => s.id === nation.capitalId);
    return { nation, x: (capital?.x || 500) / 1000, y: (capital?.y || 500) / 1000 };
  });
  const seed = rng.int(1, 999999);
  const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 0.017) * 43758.5453;
    return n - Math.floor(n);
  };
  const smooth = (x, y, scale) => {
    const fx = x * scale;
    const fy = y * scale;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const a = hash(x0, y0);
    const b = hash(x0 + 1, y0);
    const c = hash(x0, y0 + 1);
    const d = hash(x0 + 1, y0 + 1);
    const u = tx * tx * (3 - 2 * tx);
    const v = ty * ty * (3 - 2 * ty);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / Math.max(1, width - 1);
      const ny = y / Math.max(1, height - 1);
      const noise = smooth(nx, ny, 3.2) * 0.65 + smooth(nx, ny, 7.4) * 0.35;
      const edge = Math.min(nx, ny, 1 - nx, 1 - ny);
      let biome = biomes[Math.floor(noise * biomes.length)] || biomes[0];
      if (edge < 0.06 && biomes.some((b) => b.id === "ocean")) biome = biomes.find((b) => b.id === "ocean");
      let nationId = "";
      let best = Infinity;
      centers.forEach((center) => {
        const d = (nx - center.x) ** 2 + (ny - center.y) ** 2;
        if (d < best) {
          best = d;
          nationId = center.nation.id;
        }
      });
      // Leave some unclaimed wilderness between powers.
      if (best > 0.17 + noise * 0.05) nationId = "";
      cells.push({ x, y, biome: biome.id, nationId });
    }
  }
  return { width, height, cells };
}

export function routeBetween(from, to, era, widthKm, rng) {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  const distanceKm = Math.max(0.5, (Math.sqrt(dx * dx + dy * dy) / 1000) * widthKm);
  const kind = rng.pick(["Road", "Road", "Highway", "River", "Sea route", "Mountain pass", "Trail"]);
  const baseSpeed = era.travel.walk || 4;
  const hours = distanceKm / baseSpeed;
  return {
    id: `route_${from.id}_${to.id}`,
    from: from.id,
    to: to.id,
    type: kind,
    distanceKm: Math.round(distanceKm * 10) / 10,
    hours: Math.round(hours * 10) / 10,
    days: Math.max(0.5, Math.round((hours / 8) * 10) / 10),
    modes: Object.fromEntries(
      Object.entries(era.travel)
        .filter(([, speed]) => speed > 0)
        .map(([mode, speed]) => [
          mode,
          {
            hours: Math.round((distanceKm / speed) * 10) / 10,
            days: Math.max(0.1, Math.round((distanceKm / speed / 8) * 10) / 10),
          },
        ])
    ),
  };
}

const CORE_BY_KIND = {
  village: ["Tavern", "Cottage", "Farm", "Garden", "Guide Services", "Shanty", "Well"],
  camp: ["Tavern", "Cottage", "Farm", "Garden", "Guide Services", "Shanty", "Well"],
  town: ["Town Hall", "Tavern", "Inn", "Townhouse", "Cottage", "Market Hall", "Farm"],
  city: [
    "Town Hall", "Tavern", "Inn", "Townhouse", "Market Hall", "Temple",
    "Guildhall", "Library", "Courthouse", "Barracks", "Farm",
  ],
  capital: [
    "Town Hall", "Tavern", "Inn", "Townhouse", "Market Hall", "Temple",
    "Guildhall", "Library", "Courthouse", "Barracks", "Farm",
  ],
  station: ["Town Hall", "Tavern", "Inn", "Market Hall", "Temple", "Guide Services", "Dock", "Farm"],
  plane: ["Town Hall", "Tavern", "Inn", "Market Hall", "Temple", "Guide Services", "Dock", "Farm"],
};

function templateEligible(template, settlement, era) {
  if (template.kinds && !template.kinds.includes(settlement.kind)) return false;
  if (template.tech != null && Number(era?.tech || 0) < Number(template.tech)) return false;
  if (template.terrain?.length) {
    const tags = new Set([
      settlement.biome,
      ...(settlement.tags || []),
      settlement.biome === "mountains" ? "mountain" : "",
    ]);
    const ok = template.terrain.some(
      (terrain) => terrain === "road" || tags.has(terrain)
    );
    if (!ok) return false;
  }
  return true;
}

function chooseBuildingTemplates(settlement, era, rng) {
  const kind = settlement.kind;
  const count =
    kind === "capital"
      ? rng.int(38, 56)
      : kind === "city"
        ? rng.int(28, 44)
        : kind === "town"
          ? rng.int(16, 28)
          : rng.int(8, 15);
  const eligible = BUILDING_TEMPLATES.filter((template) =>
    templateEligible(template, settlement, era)
  );
  const byType = new Map(eligible.map((template) => [template.type, template]));
  const chosen = [];
  const counts = {};
  const canAdd = (template) => {
    if (!template) return false;
    const max = Math.max(1, Number(template.repeatable) || 1);
    if ((counts[template.type] || 0) >= max) return false;
    if (template.prereq?.length) {
      if (!template.prereq.every((type) => (counts[type] || 0) > 0)) return false;
    }
    if (template.prereqAny?.length) {
      const anyOk = template.prereqAny.some((group) =>
        group.every((type) => (counts[type] || 0) > 0)
      );
      if (!anyOk) return false;
    }
    return true;
  };
  const add = (template) => {
    if (!canAdd(template)) return false;
    chosen.push(template);
    counts[template.type] = (counts[template.type] || 0) + 1;
    return true;
  };

  // Civic anchors first so their dependants can find their prerequisites.
  (CORE_BY_KIND[kind] || CORE_BY_KIND.town).forEach((type) => add(byType.get(type)));

  let guard = 0;
  while (chosen.length < count && guard < 250) {
    guard += 1;
    const pool = eligible.filter((template) => canAdd(template));
    if (!pool.length) break;
    add(rng.pick(pool));
  }
  return chosen.slice(0, count);
}

// One building in a capital is the seat of government: its palace/castle (or
// the first suitable civic building) carries the ruler's Bastion facilities.
function pickCapitalSeatIndex(templates) {
  const order = ["Castle", "Palace", "Manor", "Town Hall"];
  for (const type of order) {
    const index = templates.findIndex((template) => template.type === type);
    if (index >= 0) return index;
  }
  return templates.length ? 0 : -1;
}

function makeBuilding(template, settlement, era, rng, index, capitalSeat = false) {
  const comfort = adjustComfort(
    template.comfort || BUILDING_COMFORT[template.type] || "Poor",
    settlement.kind
  );
  const footprintSize = footprintFor(comfort);
  const footprint = { w: footprintSize, h: footprintSize };
  const floors = rng.int(template.floors[0], template.floors[1]);
  const id = `bld_${settlement.id}_${index}_${Math.floor(rng.rand() * 1e6).toString(36)}`;
  const interior = generateInterior({
    building: { id, type: template.type, floors, comfort },
    footprint,
    floors,
    roomTypes: template.rooms,
    facilityClass: facilityClassForComfort(comfort),
    settlementKind: settlement.kind,
    buildingType: template.type,
    buildingCategory: template.category,
    rulerLevel: settlement.rulerLevel || 0,
    capitalSeat,
    rng,
  });
  const base =
    settlement.kind === "capital"
      ? 1800
      : settlement.kind === "city"
        ? 900
        : settlement.kind === "town"
          ? 350
          : 120;
  return {
    id,
    name:
      template.type === "Tavern"
        ? generateTavernName(rng)
        : template.type === "Inn"
          ? `The ${rng.pick(["Wayfarer", "Lantern", "Hearth", "Crown", "Pilgrim"])}`
          : `${template.type} of ${settlement.name}`,
    type: template.type,
    category: template.category,
    district: rng.pick(template.districts?.length ? template.districts : ["Market"]),
    floors,
    comfort,
    footprint,
    facilityClass: facilityClassForComfort(comfort),
    facilitySpaces: facilitySpacesForComfort(comfort),
    buildMonths: buildMonthsForComfort(comfort),
    capitalSeat,
    size: footprint,
    interior,
    interiorSize: { w: interior.width, h: interior.height },
    workstations: [...(template.workstations || [])],
    rooms: interior.rooms,
    floorTexture: interior.rooms[0]?.floorTexture || "stone",
    propertyValue: Math.round((footprint.w * footprint.h * floors * base) / 10) * 10,
    ownerId: "",
    tenure: "owned",
    residentIds: [],
    staffIds: [],
    notes: "",
    terrain: template.terrain || [],
    era: era.id,
    // House artwork shown on the settlement map; rotates in 45° steps.
    icon: "",
    rotation: rng.pick([0, 45, 90, 135, 180, 225, 270, 315]),
  };
}

// Create a single settlement at a map position. Used by the World Map editor
// and the procedural settlement tool; the normal world generator uses its own
// batched path so it can distribute settlements evenly.
export function createSettlementAt(
  worldInput,
  {
    realmId = "",
    nationId = "",
    kind = "village",
    x = 500,
    y = 500,
    name = "",
    withNpcs = true,
    withBuildings = true,
    seed = "",
  } = {}
) {
  const world = JSON.parse(JSON.stringify(worldInput));
  const nation =
    (world.nations || []).find((item) => item.id === nationId) || (world.nations || [])[0];
  if (!nation) return { world, settlement: null, error: "No nation available." };
  const realm =
    (world.realms || []).find((item) => item.id === realmId) ||
    (world.realms || []).find((item) => item.id === nation.realmId) ||
    (world.realms || [])[0];
  if (!realm) return { world, settlement: null, error: "No realm available." };
  const era = ERAS.find((item) => item.id === world.eraId) || ERAS[4];
  const rng = makeRng(
    `${world.id || "world"}:${nation.id}:${Math.round(x)}:${Math.round(y)}:${seed || Date.now()}`
  );
  const realmBiomes = BIOMES.filter((biome) => realm.biomeIds?.includes(biome.id));
  let biome = rng.pick(realmBiomes.length ? realmBiomes : BIOMES);
  if (realm.map?.cells?.length) {
    const cx = Math.max(0, Math.min(realm.map.width - 1, Math.floor((x / 1000) * realm.map.width)));
    const cy = Math.max(0, Math.min(realm.map.height - 1, Math.floor((y / 1000) * realm.map.height)));
    const cell = realm.map.cells.find((item) => item.x === cx && item.y === cy);
    if (cell) biome = BIOMES.find((item) => item.id === cell.biome) || biome;
  }
  const safeKind = ["village", "town", "city", "camp", "station"].includes(kind)
    ? kind
    : "village";
  const id = `set_edit_${Date.now().toString(36)}_${Math.floor(rng.rand() * 1e6).toString(36)}`;
  const settlement = {
    id,
    realmId: realm.id,
    nationId: nation.id,
    name: name || generateSettlementName(nation.culture, rng, safeKind),
    kind: safeKind,
    typeLabel: SETTLEMENT_KINDS[safeKind] || "Settlement",
    x: Math.max(0, Math.min(1000, x)),
    y: Math.max(0, Math.min(1000, y)),
    biome: biome.id,
    biomeLabel: biome.label,
    population:
      safeKind === "city"
        ? withBuildings
          ? rng.int(3500, 14000)
          : 0
        : safeKind === "town"
          ? withBuildings
            ? rng.int(600, 3200)
            : 0
          : withBuildings
            ? rng.int(60, 550)
            : 0,
    prosperity: withBuildings ? rng.int(2, 8) : 0,
    defense: withBuildings ? rng.int(1, 7) : 0,
    tags: [biome.id, safeKind, withBuildings ? "generated" : "player"],
    districts: [],
    buildings: [],
    npcIds: [],
    notes: withBuildings
      ? "Founded with the World Map editor."
      : "Player-founded settlement. Build it up with the Architect.",
    mapSeed: rng.int(1, 999999),
    rulerLevel: safeKind === "capital" ? 5 : 0,
  };
  const templates = withBuildings ? chooseBuildingTemplates(settlement, era, rng) : [];
  const districtNames = [...new Set(templates.map((template) => template.districts?.[0]).filter(Boolean))];
  settlement.districts = districtNames;
  const capitalSeatIndex =
    safeKind === "capital" ? pickCapitalSeatIndex(templates) : -1;
  settlement.buildings = templates.map((template, index) =>
    makeBuilding(
      template,
      settlement,
      era,
      rng,
      index,
      index === capitalSeatIndex
    )
  );
  applyCityLayout(settlement);

  if (withNpcs && withBuildings) {
    world.npcs = world.npcs || [];
    const localCount =
      safeKind === "city" ? rng.int(7, 12) : safeKind === "town" ? rng.int(4, 8) : rng.int(2, 5);
    for (let index = 0; index < localCount; index += 1) {
      const role = rng.chance(0.25) ? "court" : rng.chance(0.4) ? "wilderness" : "settlement";
      const npc = generateNpc({
        culture: nation.culture,
        role,
        settlementKind: safeKind,
        rng,
        settlementId: settlement.id,
        nationId: nation.id,
      });
      const home =
        rng.pick(settlement.buildings.filter((building) => building.category === "Residential")) ||
        settlement.buildings[0];
      const work = rng.pick(settlement.buildings);
      npc.homeBuildingId = home?.id || "";
      npc.workBuildingId = work?.id || "";
      attachSchedule(npc, settlement);
      home?.residentIds.push(npc.id);
      work?.staffIds.push(npc.id);
      settlement.npcIds.push(npc.id);
      world.npcs.push(npc);
    }
  }

  world.settlements = [...(world.settlements || []), settlement];
  realm.settlementIds = [...new Set([...(realm.settlementIds || []), settlement.id])];
  const kingdom = (world.kingdoms || []).find((item) => item.nationId === nation.id);
  if (kingdom) {
    const province = createProvince(settlement);
    province.loyalty = rng.int(6, 12);
    kingdom.provinces = [...(kingdom.provinces || []), province];
    kingdom.provinceIds = [...new Set([...(kingdom.provinceIds || []), settlement.id])];
    kingdom.loyalty = { ...(kingdom.loyalty || {}), [settlement.id]: province.loyalty };
    kingdom.buildings = [
      ...(kingdom.buildings || []),
      ...settlement.buildings.map((building) => ({
        id: building.id,
        name: building.name,
        tier: building.comfort || "",
        category: building.category,
        benefit: "",
        settlementId: settlement.id,
        cityBuilding: true,
      })),
    ];
  }
  world.logs = [
    ...(world.logs || []),
    {
      at: new Date().toISOString(),
      text: `${settlement.name} founded in ${nation.name} (${settlement.typeLabel}).`,
    },
  ];
  return { world, settlement };
}

function settlementKind(scale, index, total, rng) {
  if (index === 0) return "capital";
  if (scale.id === "town") return rng.chance(0.5) ? "village" : "town";
  if (scale.id === "city-state") return rng.chance(0.35) ? "city" : rng.chance(0.6) ? "town" : "village";
  if (scale.id === "kingdom" || scale.id === "nation") return rng.chance(0.18) ? "city" : rng.chance(0.6) ? "town" : "village";
  if (scale.id === "solar" || scale.id === "galactic" || scale.id === "multiverse") return rng.chance(0.2) ? "station" : rng.chance(0.5) ? "city" : "town";
  return rng.chance(0.12) ? "city" : rng.chance(0.55) ? "town" : "village";
}

function generateNationSettlements({ nation, scale, era, biomePool, rng, realmId, sharedNpcs }) {
  const [minS, maxS] = scale.settlements;
  const count = Math.max(2, Math.round(rng.int(minS, maxS) / Math.max(1, scale.nations[1])));
  const settlements = [];
  const baseX = nation.centerX;
  const baseY = nation.centerY;
  for (let i = 0; i < count; i += 1) {
    const kind = settlementKind(scale, i, count, rng);
    const angle = rng.rand() * Math.PI * 2;
    const radius = i === 0 ? 0 : rng.int(70, 260);
    const x = Math.max(25, Math.min(975, baseX + Math.cos(angle) * radius));
    const y = Math.max(25, Math.min(975, baseY + Math.sin(angle) * radius));
    const biome = rng.pick(biomePool);
    const name = generateSettlementName(nation.culture, rng, kind);
    const settlement = {
      id: `set_${realmId}_${nation.id}_${i}_${Math.floor(rng.rand() * 1e6).toString(36)}`,
      realmId,
      nationId: nation.id,
      name,
      kind,
      typeLabel: SETTLEMENT_KINDS[kind] || "Settlement",
      x,
      y,
      biome: biome.id,
      biomeLabel: biome.label,
      population:
        kind === "capital" ? rng.int(9000, 42000) : kind === "city" ? rng.int(3500, 14000) : kind === "town" ? rng.int(600, 3200) : rng.int(60, 550),
      prosperity: rng.int(2, 8),
      defense: rng.int(1, 7),
      tags: [biome.id, kind],
      districts: [],
      buildings: [],
      npcIds: [],
      notes: "",
      mapSeed: rng.int(1, 999999),
      rulerLevel: kind === "capital" ? rng.pick([5, 5, 9, 9, 13, 17]) : 0,
    };
    const templates = chooseBuildingTemplates(settlement, era, rng);
    const districtNames = [...new Set(templates.map((t) => t.districts?.[0]).filter(Boolean))];
    settlement.districts = districtNames.length ? districtNames : ["Market", "Residential"];
    const capitalSeatIndex =
      settlement.kind === "capital" ? pickCapitalSeatIndex(templates) : -1;
    settlement.buildings = templates.map((template, index) =>
      makeBuilding(
        template,
        settlement,
        era,
        rng,
        index,
        index === capitalSeatIndex
      )
    );
    // Grid streets and road-adjacent lots, using the Building Footprint table.
    applyCityLayout(settlement);
    settlements.push(settlement);
  }
  return settlements;
}

function createProvince(settlement) {
  return {
    id: `prov_${settlement.id}`,
    settlementId: settlement.id,
    name: settlement.name,
    comfort: settlement.kind === "capital" ? "Comfortable" : settlement.kind === "city" ? "Modest" : settlement.kind === "town" ? "Poor" : "Squalid",
    loyalty: 10,
    size: settlement.kind === "capital" ? 625 : settlement.kind === "city" ? 400 : settlement.kind === "town" ? 225 : 100,
    population: settlement.population,
    buildings: settlement.buildings.map((b) => b.id),
    notes: "",
  };
}

function attachSchedule(npc, settlement) {
  const tavern = settlement.buildings.find((b) => b.type === "Tavern" || b.type === "Inn") || settlement.buildings[0];
  npc.schedule = [
    { start: 0, end: 6, place: "home", buildingId: npc.homeBuildingId || "", label: "Sleeping" },
    { start: 6, end: 8, place: "home", buildingId: npc.homeBuildingId || "", label: "Morning routine" },
    { start: 8, end: 18, place: "work", buildingId: npc.workBuildingId || "", label: "Working" },
    { start: 18, end: 21, place: "tavern", buildingId: tavern?.id || "", label: "Evening at the tavern" },
    { start: 21, end: 24, place: "home", buildingId: npc.homeBuildingId || "", label: "Sleeping" },
  ];
  // A new setting starts at 08:00, so place people where that hour finds them.
  const startBlock =
    npc.schedule.find((entry) => 8 >= entry.start && 8 < entry.end) || npc.schedule[2];
  npc.currentLocation = {
    place: startBlock.place,
    buildingId: startBlock.buildingId || "",
    label: startBlock.label,
  };
  return npc;
}

function createKingdom(nation, settlements, era, rng) {
  const capital = settlements.find((s) => s.kind === "capital") || settlements[0];
  const capitalNpc = generateNpc({
    culture: nation.culture,
    role: "ruler",
    settlementKind: capital.kind,
    rng,
    settlementId: capital.id,
    nationId: nation.id,
  });
  capitalNpc.role = "ruler";
  capitalNpc.occupation = "Ruler";
  capitalNpc.level = capital.rulerLevel || 5;
  const council = ["Steward", "Chancellor", "Architect", "General", "Warden", "Counter-Intel"].map((role) => {
    const npc = generateNpc({
      culture: nation.culture,
      role: "court",
      settlementKind: capital.kind,
      rng,
      settlementId: capital.id,
      nationId: nation.id,
    });
    npc.role = role;
    npc.occupation = role;
    return npc;
  });
  const provinces = settlements.map(createProvince);
  const stats = {
    economy: 3 + rng.int(0, 2),
    military: 3 + rng.int(0, 2),
    influence: 3 + rng.int(0, 2),
    prosperity: 3 + rng.int(0, 2),
  };
  const counts = { ec: 3, mc: 3, ic: 3, pc: 3 };
  return {
    id: `kingdom_${nation.id}`,
    name: generateKingdomName(nation.culture, rng, "kingdom"),
    nationId: nation.id,
    realmId: nation.realmId,
    era: era.id,
    ruler: capitalNpc,
    council,
    government: nation.government,
    culture: nation.culture,
    capitalId: capital.id,
    provinceIds: settlements.map((s) => s.id),
    provinces,
    stats,
    counts,
    treasury: 250,
    resources: { food: 5, wood: 5, stone: 5, metal: 3, cloth: 3, herbs: 3 },
    loyalty: Object.fromEntries(settlements.map((s) => [s.id, rng.int(8, 14)])),
    turn: 1,
    month: 1,
    year: 1,
    season: "Spring",
    townCap: 1 + Math.floor(rng.rand() * 3),
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
    buildings: settlements.flatMap((s) =>
      s.buildings.map((b) => ({
        id: b.id,
        name: b.name,
        tier: b.comfort || "",
        category: b.category,
        benefit: "",
        settlementId: s.id,
        cityBuilding: true,
      }))
    ),
    log: [],
    eventHistory: [],
    activeEvents: [],
    ai: {
      expansion: rng.int(1, 3),
      aggression: rng.int(1, 5),
      trade: rng.int(1, 5),
      culture: rng.int(1, 5),
    },
    relations: {},
  };
}

export function generateWorld({
  seed = "new-setting",
  eraId = "medieval",
  theme = "High Fantasy",
  scaleId = "kingdom",
  selectedBiomes = [],
  name = "",
  realmName = "",
} = {}) {
  const rng = makeRng(seed);
  const era = ERAS.find((e) => e.id === eraId) || ERAS[4];
  const scale = SCALES.find((s) => s.id === scaleId) || SCALES[2];
  const biomePool = selectedBiomes.length
    ? BIOMES.filter((b) => selectedBiomes.includes(b.id))
    : BIOMES.filter((b) => !["ocean", "void"].includes(b.id));
  const realmCount = pickRealmCount(scale, rng);
  const cultures = CULTURE_BY_THEME[theme]?.length ? CULTURE_BY_THEME[theme] : CULTURES;
  const realms = [];
  const nations = [];
  const settlements = [];
  const npcs = [];
  const routes = [];
  const kingdoms = [];

  for (let r = 0; r < realmCount; r += 1) {
    const realmBiomes = rng.shuffle(biomePool).slice(0, Math.min(biomePool.length, Math.max(2, Math.ceil(biomePool.length / 2))));
    const realm = {
      id: `realm_${r}_${Math.floor(rng.rand() * 1e6).toString(36)}`,
      name: r === 0 && realmName ? realmName : generateRealmName(rng.pick(cultures), rng, realmKind(scale)),
      kind: realmKind(scale),
      biomeIds: realmBiomes.map((b) => b.id),
      biomeLabels: realmBiomes.map((b) => b.label),
      description: "",
      map: null,
      nationIds: [],
      settlementIds: [],
    };
    realms.push(realm);
  }

  const [minNations, maxNations] = scale.nations;
  const nationCount = rng.int(minNations, maxNations);
  for (let i = 0; i < nationCount; i += 1) {
    const realm = realms[i % realms.length];
    const culture = rng.pick(cultures);
    const centerX = 120 + rng.rand() * 760;
    const centerY = 120 + rng.rand() * 760;
    const government = rng.pick(GOVERNMENTS);
    const nation = {
      id: `nation_${i}_${Math.floor(rng.rand() * 1e6).toString(36)}`,
      name: generateKingdomName(culture, rng, "nation"),
      culture,
      government,
      realmId: realm.id,
      theme,
      color: NATION_COLORS[i % NATION_COLORS.length],
      centerX,
      centerY,
      capitalId: "",
      rulerId: "",
      description: "",
      tags: [culture.toLowerCase(), government.toLowerCase()],
    };
    const nationSettlements = generateNationSettlements({
      nation,
      scale,
      era,
      biomePool: BIOMES.filter((b) => realm.biomeIds.includes(b.id)),
      rng,
      realmId: realm.id,
      sharedNpcs: npcs,
    });
    const capital = nationSettlements.find((s) => s.kind === "capital") || nationSettlements[0];
    nation.capitalId = capital.id;
    nationSettlements.forEach((settlement) => {
      settlements.push(settlement);
      realm.settlementIds.push(settlement.id);
    });
    const kingdom = createKingdom(nation, nationSettlements, era, rng);
    nation.rulerId = kingdom.ruler.id;
    nation.kingdomId = kingdom.id;
    nations.push(nation);
    realm.nationIds.push(nation.id);
    kingdoms.push(kingdom);

    // Ruler and council live in the capital.
    npcs.push(kingdom.ruler, ...kingdom.council);
    kingdom.ruler.homeBuildingId = capital.buildings.find((b) => b.type === "Manor" || b.type === "Castle")?.id || capital.buildings[0]?.id || "";
    kingdom.ruler.workBuildingId = capital.buildings.find((b) => b.type === "Castle" || b.type === "Courthouse")?.id || capital.buildings[0]?.id || "";
    attachSchedule(kingdom.ruler, capital);
    capital.npcIds.push(kingdom.ruler.id);
    kingdom.council.forEach((npc) => {
      npc.homeBuildingId = capital.buildings.find((b) => b.type === "Townhouse" || b.type === "Manor")?.id || capital.buildings[0]?.id || "";
      npc.workBuildingId = capital.buildings.find((b) => b.type === "Guildhall" || b.type === "Courthouse" || b.type === "Castle")?.id || capital.buildings[0]?.id || "";
      attachSchedule(npc, capital);
      capital.npcIds.push(npc.id);
    });

    // Local personalities and workers.
    nationSettlements.forEach((settlement) => {
      const localCount = settlement.kind === "capital" ? rng.int(8, 14) : settlement.kind === "city" ? rng.int(6, 10) : rng.int(3, 7);
      for (let n = 0; n < localCount; n += 1) {
        const role = rng.chance(0.25) ? "court" : rng.chance(0.4) ? "wilderness" : "settlement";
        const npc = generateNpc({
          culture: nation.culture,
          role,
          settlementKind: settlement.kind,
          rng,
          settlementId: settlement.id,
          nationId: nation.id,
        });
        if (role === "court") npc.occupation = rng.pick(["Tax collector", "Magistrate", "Courtier", "Diplomat", "Guildmaster"]);
        const home = rng.pick(settlement.buildings.filter((b) => b.category === "Residential")) || settlement.buildings[0];
        const work =
          settlement.buildings.find((b) => b.type.toLowerCase().includes(npc.occupation.split(" ")[0].toLowerCase())) ||
          rng.pick(settlement.buildings);
        npc.homeBuildingId = home?.id || "";
        npc.workBuildingId = work?.id || "";
        attachSchedule(npc, settlement);
        home?.residentIds.push(npc.id);
        work?.staffIds.push(npc.id);
        settlement.npcIds.push(npc.id);
        npcs.push(npc);
      }
    });
  }

  // Roads: connect every settlement to its capital, then capitals to each other.
  nations.forEach((nation) => {
    const capital = settlements.find((s) => s.id === nation.capitalId);
    settlements
      .filter((s) => s.nationId === nation.id && s.id !== nation.capitalId)
      .forEach((settlement) => {
        if (capital) routes.push(routeBetween(capital, settlement, era, scale.widthKm, rng));
      });
  });
  for (let i = 0; i < nations.length - 1; i += 1) {
    const a = settlements.find((s) => s.id === nations[i].capitalId);
    const b = settlements.find((s) => s.id === nations[i + 1].capitalId);
    if (a && b) routes.push(routeBetween(a, b, era, scale.widthKm, rng));
  }

  // Map cells per realm after settlement positions are known. Use a square
  // grid so one cell is always one square on screen instead of stretching the
  // terrain into rectangles on the 1000×1000 world map.
  const mapSide = Math.max(scale.cells[0], scale.cells[1]);
  realms.forEach((realm) => {
    realm.map = buildMapCells({
      realm,
      nations: nations.filter((n) => n.realmId === realm.id),
      settlements: settlements.filter((s) => s.realmId === realm.id),
      rng,
      width: mapSide,
      height: mapSide,
      biomes: BIOMES.filter((b) => realm.biomeIds.includes(b.id)),
    });
  });

  // Initial diplomatic relations: neighbours are neutral, some are tense.
  nations.forEach((nation) => {
    const kingdom = kingdoms.find((k) => k.id === nation.kingdomId);
    if (!kingdom) return;
    nations.forEach((other) => {
      if (other.id === nation.id) return;
      kingdom.relations[other.id] = rng.chance(0.16) ? rng.int(-4, -1) : rng.int(0, 3);
    });
  });

  const world = {
    id: `world_${Date.now().toString(36)}`,
    name: name || generateRealmName(rng.pick(cultures), rng, "world"),
    seed,
    eraId: era.id,
    eraLabel: era.label,
    eraTech: era.tech,
    theme,
    scaleId: scale.id,
    scaleLabel: scale.label,
    widthKm: scale.widthKm,
    createdAt: new Date().toISOString(),
    calendar: { year: 1, month: 1, day: 1, hour: 8, season: "Spring" },
    realms,
    nations,
    settlements,
    npcs,
    routes,
    kingdoms,
    quests: [],
    combat: null,
    events: [],
    mapTextures: {},
    roomAssetTemplates: {},
    encounterTables: [],
    developments: [],
    layoutVersion: 2,
    logs: [
      {
        at: new Date().toISOString(),
        text: `Created ${scale.label} “${name || "new setting"}” in the ${era.label} era.`,
      },
    ],
  };
  world.developments = generateWorldDevelopments(world);
  return world;
}

export function travelEstimate(route, mode = "walk") {
  if (!route) return { hours: 0, days: 0 };
  if (route.modes?.[mode]) return route.modes[mode];
  return { hours: route.hours || 0, days: route.days || 0 };
}

export function routeFor(world, fromId, toId) {
  return (world?.routes || []).find(
    (route) =>
      (route.from === fromId && route.to === toId) ||
      (route.from === toId && route.to === fromId)
  );
}

export function settlementById(world, id) {
  return (world?.settlements || []).find((s) => s.id === id) || null;
}

export function nationById(world, id) {
  return (world?.nations || []).find((n) => n.id === id) || null;
}

export function kingdomForNation(world, nationId) {
  return (world?.kingdoms || []).find((k) => k.nationId === nationId) || null;
}

export function npcsAt(world, settlementId) {
  return (world?.npcs || []).filter((npc) => npc.settlementId === settlementId);
}

export function buildingsAt(world, settlementId) {
  const settlement = settlementById(world, settlementId);
  return settlement?.buildings || [];
}
