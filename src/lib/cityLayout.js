// Grid-based city layout for generated settlements.
//
// The homebrew rule: a facility's "Building Footprint" is how many spaces it
// occupies on the province map. Roads expand outward on the same grid, and
// every structure must line a road. This module lays out a SimCity-style
// orthogonal street grid, then places each building on a free lot that touches
// a road tile. No diagonals, no decorative starbursts.

import { makeRng } from "@/lib/worldNames";

export const COMFORT_ORDER = [
  "Wretched",
  "Squalid",
  "Poor",
  "Modest",
  "Comfortable",
  "Wealthy",
  "Aristocratic",
];

// Construction Timelines table: facility size -> building footprint.
export const FOOTPRINT_BY_COMFORT = {
  Wretched: 1,
  Squalid: 1,
  Poor: 2,
  Modest: 3,
  Comfortable: 4,
  Wealthy: 5,
  Aristocratic: 6,
};

// Architect facility classes and the Construction Timelines build time. These
// are kept with the city data so generated houses carry the same rules
// metadata as hand-built facilities.
export const FACILITY_CLASS_BY_COMFORT = {
  Wretched: "Cramped",
  Squalid: "Cramped",
  Poor: "Cramped",
  Modest: "Roomy",
  Comfortable: "Roomy",
  Wealthy: "Vast",
  Aristocratic: "Vast",
};

export const FACILITY_SPACES_BY_CLASS = {
  Cramped: 4,
  Roomy: 16,
  Vast: 36,
};

export const BUILD_MONTHS_BY_COMFORT = {
  Wretched: 1,
  Squalid: 1,
  Poor: 1,
  Modest: 2,
  Comfortable: 3,
  Wealthy: 4,
  Aristocratic: 5,
};

// Default comfort of each settlement building type. The settlement kind nudges
// these up or down, producing capitals with grander buildings and villages with
// small ones while keeping footprints in the rulebook range.
export const BUILDING_COMFORT = {
  "Town Hall": "Modest",
  Tavern: "Poor",
  Inn: "Poor",
  Blacksmith: "Poor",
  "Market Hall": "Modest",
  Temple: "Comfortable",
  Manor: "Comfortable",
  Townhouse: "Poor",
  Cottage: "Squalid",
  Barracks: "Modest",
  Guildhall: "Modest",
  Library: "Modest",
  Alchemist: "Poor",
  Stable: "Squalid",
  Mill: "Poor",
  Dock: "Modest",
  Mine: "Modest",
  Farm: "Squalid",
  Castle: "Wealthy",
  Watchtower: "Modest",
  Apothecary: "Poor",
  Bakery: "Poor",
  Warehouse: "Modest",
  Bathhouse: "Modest",
  Courthouse: "Modest",
  Garden: "Squalid",
  Shanty: "Wretched",
  "Guide Services": "Wretched",
};

export const comfortRank = (value) => {
  const index = COMFORT_ORDER.indexOf(String(value || "").trim());
  return index < 0 ? 2 : index;
};

export const footprintFor = (comfort) =>
  FOOTPRINT_BY_COMFORT[String(comfort || "").trim()] || FOOTPRINT_BY_COMFORT.Poor;

export const facilityClassForComfort = (comfort) =>
  FACILITY_CLASS_BY_COMFORT[String(comfort || "").trim()] || "Cramped";

export const facilitySpacesForComfort = (comfort) =>
  FACILITY_SPACES_BY_CLASS[facilityClassForComfort(comfort)] || 4;

export const buildMonthsForComfort = (comfort) =>
  BUILD_MONTHS_BY_COMFORT[String(comfort || "").trim()] || 1;

export function adjustComfort(base, settlementKind) {
  let rank = comfortRank(base);
  if (settlementKind === "capital") rank += 1;
  else if (settlementKind === "city") rank += 0;
  else if (settlementKind === "town") rank -= 1;
  else if (settlementKind === "village") rank -= 1;
  else if (settlementKind === "camp") rank -= 1;
  return COMFORT_ORDER[Math.max(0, Math.min(COMFORT_ORDER.length - 1, rank))];
}

export function buildingComfort(building, settlement) {
  if (building?.comfort && FOOTPRINT_BY_COMFORT[building.comfort]) return building.comfort;
  const base = BUILDING_COMFORT[building?.type] || "Poor";
  return adjustComfort(base, settlement?.kind);
}

export function buildingFootprint(building, settlement) {
  if (building?.footprint?.w && building?.footprint?.h) {
    return {
      w: Math.max(1, Math.min(6, Number(building.footprint.w) || 1)),
      h: Math.max(1, Math.min(6, Number(building.footprint.h) || 1)),
    };
  }
  const size = footprintFor(buildingComfort(building, settlement));
  return { w: size, h: size };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const keyOf = (x, y) => `${x},${y}`;

function makeWater(settlement, width, height, rng) {
  const hasWater =
    ["coast", "ocean", "swamp", "river"].includes(settlement?.biome) ||
    (settlement?.tags || []).includes("river") ||
    (settlement?.buildings || []).some((building) => building.type === "Dock");
  if (!hasWater) return new Set();
  const depth = clamp(4 + rng.int(0, 2), 3, 7);
  const vertical = rng.chance(0.45);
  const tiles = new Set();
  if (vertical) {
    const start = width - depth;
    for (let x = start; x < width; x += 1) {
      for (let y = 0; y < height; y += 1) tiles.add(keyOf(x, y));
    }
  } else {
    const start = height - depth;
    for (let y = start; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) tiles.add(keyOf(x, y));
    }
  }
  return tiles;
}

function makeRoads({ width, height, margin, block, water, rng }) {
  const roads = new Set();
  const verticals = [];
  const horizontals = [];
  for (let x = margin + block; x < width - margin - 1; x += block) verticals.push(x);
  for (let y = margin + block; y < height - margin - 1; y += block) horizontals.push(y);
  if (!verticals.length) verticals.push(Math.floor(width / 2));
  if (!horizontals.length) horizontals.push(Math.floor(height / 2));
  const add = (x, y) => {
    if (x < margin || y < margin || x >= width - margin || y >= height - margin) return;
    if (water.has(keyOf(x, y))) return;
    roads.add(keyOf(x, y));
  };
  verticals.forEach((x) => {
    for (let y = margin; y < height - margin; y += 1) add(x, y);
  });
  horizontals.forEach((y) => {
    for (let x = margin; x < width - margin; x += 1) add(x, y);
  });

  // Short side streets branch off the avenues in any of the four directions.
  // They stay orthogonal and never leave the grid.
  const branches = Math.max(3, Math.round((width + height) / 22));
  for (let i = 0; i < branches; i += 1) {
    const onVertical = rng.chance(0.5);
    if (onVertical) {
      const x = rng.pick(verticals);
      if (x == null) continue;
      const y = margin + 1 + rng.int(0, Math.max(0, height - margin * 2 - 2));
      const length = rng.int(3, Math.max(4, block - 1));
      const direction = rng.chance(0.5) ? 1 : -1;
      for (let step = 1; step <= length; step += 1) add(x + direction * step, y);
    } else {
      const y = rng.pick(horizontals);
      if (y == null) continue;
      const x = margin + 1 + rng.int(0, Math.max(0, width - margin * 2 - 2));
      const length = rng.int(3, Math.max(4, block - 1));
      const direction = rng.chance(0.5) ? 1 : -1;
      for (let step = 1; step <= length; step += 1) add(x, y + direction * step);
    }
  }
  return { roads, verticals, horizontals };
}

function makeWalls({ width, height, margin, walled, roads }) {
  const walls = new Set();
  const gates = new Set();
  if (!walled) return { walls, gates };
  const left = margin;
  const top = margin;
  const right = width - margin - 1;
  const bottom = height - margin - 1;
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);
  const gateSpan = 2;
  const addWall = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const nearGate =
      (y === top || y === bottom) && Math.abs(x - midX) <= gateSpan
        ? true
        : (x === left || x === right) && Math.abs(y - midY) <= gateSpan;
    if (nearGate) {
      gates.add(keyOf(x, y));
      roads.add(keyOf(x, y));
    } else {
      walls.add(keyOf(x, y));
    }
  };
  for (let x = left; x <= right; x += 1) {
    addWall(x, top);
    addWall(x, bottom);
  }
  for (let y = top; y <= bottom; y += 1) {
    addWall(left, y);
    addWall(right, y);
  }
  return { walls, gates };
}

function candidateSlots({ roads, water, blocked, occupied, width, height, innerMargin, w, h }) {
  const slots = [];
  const roadTiles = [...roads]
    .map((key) => key.split(",").map(Number))
    .filter(([x, y]) => !water.has(keyOf(x, y)));
  const fits = (x, y) => {
    if (x < innerMargin || y < innerMargin) return false;
    if (x + w > width - innerMargin || y + h > height - innerMargin) return false;
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) {
        const key = keyOf(xx, yy);
        if (water.has(key) || blocked.has(key) || occupied.has(key)) return false;
      }
    }
    return true;
  };
  const touchesRoad = (x, y) => {
    for (let xx = x; xx < x + w; xx += 1) {
      if (roads.has(keyOf(xx, y - 1)) || roads.has(keyOf(xx, y + h))) return true;
    }
    for (let yy = y; yy < y + h; yy += 1) {
      if (roads.has(keyOf(x - 1, yy)) || roads.has(keyOf(x + w, yy))) return true;
    }
    return false;
  };
  roadTiles.forEach(([rx, ry]) => {
    // North of the road.
    for (let offset = 0; offset < Math.min(5, w); offset += 1) {
      const x = clamp(rx - offset, innerMargin, width - innerMargin - w);
      const y = ry - h;
      if (fits(x, y) && touchesRoad(x, y)) {
        slots.push({ x, y, side: "south", rx, ry });
      }
    }
    // South of the road.
    for (let offset = 0; offset < Math.min(5, w); offset += 1) {
      const x = clamp(rx - offset, innerMargin, width - innerMargin - w);
      const y = ry + 1;
      if (fits(x, y) && touchesRoad(x, y)) {
        slots.push({ x, y, side: "north", rx, ry });
      }
    }
    // West of the road.
    for (let offset = 0; offset < Math.min(5, h); offset += 1) {
      const y = clamp(ry - offset, innerMargin, height - innerMargin - h);
      const x = rx - w;
      if (fits(x, y) && touchesRoad(x, y)) {
        slots.push({ x, y, side: "east", rx, ry });
      }
    }
    // East of the road.
    for (let offset = 0; offset < Math.min(5, h); offset += 1) {
      const y = clamp(ry - offset, innerMargin, height - innerMargin - h);
      const x = rx + 1;
      if (fits(x, y) && touchesRoad(x, y)) {
        slots.push({ x, y, side: "west", rx, ry });
      }
    }
  });
  return slots;
}

// Build the full city plan. Returns a deterministic layout object; it does not
// mutate the settlement so it is safe to call during render.
export function generateCityLayout(settlement, buildings = settlement?.buildings || [], attempt = 0) {
  const rng = makeRng(`${settlement?.id || "settlement"}:${settlement?.mapSeed || 0}:city:${attempt}`);
  const specs = buildings.map((building) => {
    const footprint = buildingFootprint(building, settlement);
    return { building, footprint };
  });
  const totalArea = specs.reduce(
    (sum, spec) => sum + spec.footprint.w * spec.footprint.h,
    0
  );
  const base = clamp(
    Math.ceil(Math.sqrt(Math.max(50, totalArea * 3.6))) + 9 + attempt * 14,
    24,
    140
  );
  const width = base + (base % 2);
  const height = clamp(
    Math.round(base * (0.82 + rng.rand() * 0.28)) + (base % 2),
    24,
    140
  );
  const margin = 3;
  const innerMargin = margin + (["capital", "city"].includes(settlement?.kind) ? 2 : 1);
  const water = makeWater(settlement, width, height, rng);
  const block = settlement?.kind === "capital" ? 9 : settlement?.kind === "city" ? 8 : settlement?.kind === "town" ? 7 : 6;
  const { roads } = makeRoads({ width, height, margin, block, water, rng });
  const walled = ["capital", "city"].includes(settlement?.kind) || (settlement?.defense || 0) >= 5;
  const { walls, gates } = makeWalls({ width, height, margin, walled, roads });

  // A small central plaza gives the grid a civic heart without cutting the
  // road network apart.
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const plaza = new Set();
  for (let y = centerY - 1; y <= centerY + 1; y += 1) {
    for (let x = centerX - 1; x <= centerX + 1; x += 1) {
      const key = keyOf(x, y);
      if (roads.has(key) || walls.has(key)) continue;
      plaza.add(key);
    }
  }

  const blocked = new Set([...roads, ...walls, ...gates, ...water, ...plaza]);
  const occupied = new Set();
  const placed = [];
  const missing = [];

  // Civic anchors and the largest footprints get the best central lots.
  const priority = (building) => {
    const type = building?.type || "";
    if (/Castle|Town Hall|Market Hall|Temple|Courthouse/.test(type)) return 4;
    if (/Barracks|Guildhall|Library|Dock|Mine|Warehouse/.test(type)) return 3;
    if (/Tavern|Inn|Manor/.test(type)) return 2;
    return 1;
  };
  const sorted = [...specs].sort((a, b) => {
    const sizeA = a.footprint.w * a.footprint.h;
    const sizeB = b.footprint.w * b.footprint.h;
    if (sizeA !== sizeB) return sizeB - sizeA;
    return priority(b.building) - priority(a.building);
  });

  sorted.forEach(({ building, footprint }) => {
    const slots = candidateSlots({
      roads,
      water,
      blocked,
      occupied,
      width,
      height,
      innerMargin,
      w: footprint.w,
      h: footprint.h,
    });
    if (!slots.length) {
      missing.push(building.id);
      return;
    }
    // Prefer lots near the centre and spread the rest with a small random
    // tie-breaker so a street does not become a single endless terrace.
    const scored = slots.map((slot) => {
      const cx = slot.x + footprint.w / 2;
      const cy = slot.y + footprint.h / 2;
      const distance = Math.hypot(cx - centerX, cy - centerY);
      const categoryBias = /Military|Civic/.test(building.category) ? 0 : rng.rand() * 8;
      return { ...slot, score: distance * 0.22 + rng.rand() * 26 + categoryBias };
    });
    scored.sort((a, b) => a.score - b.score);
    const slot = scored[0];
    for (let y = slot.y; y < slot.y + footprint.h; y += 1) {
      for (let x = slot.x; x < slot.x + footprint.w; x += 1) {
        occupied.add(keyOf(x, y));
      }
    }
    const door =
      slot.side === "south"
        ? { x: slot.x + rng.int(0, footprint.w - 1), y: slot.y + footprint.h - 1 }
        : slot.side === "north"
          ? { x: slot.x + rng.int(0, footprint.w - 1), y: slot.y }
          : slot.side === "east"
            ? { x: slot.x + footprint.w - 1, y: slot.y + rng.int(0, footprint.h - 1) }
            : { x: slot.x, y: slot.y + rng.int(0, footprint.h - 1) };
    placed.push({
      id: building.id,
      x: slot.x,
      y: slot.y,
      w: footprint.w,
      h: footprint.h,
      doorSide: slot.side,
      doorX: door.x,
      doorY: door.y,
      roadX: slot.rx,
      roadY: slot.ry,
    });
  });

  // District labels from the actual clusters instead of arbitrary overlays.
  const districtBoxes = new Map();
  placed.forEach((entry) => {
    const building = buildings.find((item) => item.id === entry.id);
    if (!building?.district) return;
    const box = districtBoxes.get(building.district) || {
      name: building.district,
      minX: entry.x,
      minY: entry.y,
      maxX: entry.x + entry.w,
      maxY: entry.y + entry.h,
    };
    box.minX = Math.min(box.minX, entry.x);
    box.minY = Math.min(box.minY, entry.y);
    box.maxX = Math.max(box.maxX, entry.x + entry.w);
    box.maxY = Math.max(box.maxY, entry.y + entry.h);
    districtBoxes.set(building.district, box);
  });
  const districts = [...districtBoxes.values()].map((box) => ({
    name: box.name,
    x: box.minX,
    y: box.minY,
    w: box.maxX - box.minX,
    h: box.maxY - box.minY,
  }));

  if (missing.length > 0 && attempt < 4) {
    return generateCityLayout(settlement, buildings, attempt + 1);
  }

  return {
    version: 2,
    width,
    height,
    block,
    margin,
    walled,
    roads: [...roads].map((key) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    }),
    plaza: [...plaza].map((key) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    }),
    water: [...water].map((key) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    }),
    walls: [...walls].map((key) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    }),
    gates: [...gates].map((key) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    }),
    buildings: placed,
    districts,
    missing,
    generatedAt: new Date().toISOString(),
  };
}

// Reuse a stored plan when it still covers every building; otherwise rebuild.
export function ensureCityLayout(settlement) {
  if (!settlement) return null;
  const buildings = settlement.buildings || [];
  const existing = settlement.mapLayout;
  if (existing?.version === 2 && Array.isArray(existing.buildings)) {
    const ids = new Set(existing.buildings.map((entry) => entry.id));
    if (buildings.every((building) => ids.has(building.id))) return existing;
  }
  return generateCityLayout(settlement, buildings);
}

// Persist the generated plan onto the settlement and its buildings.
export function applyCityLayout(settlement) {
  if (!settlement) return null;
  const layout = ensureCityLayout(settlement);
  settlement.mapLayout = layout;
  const byId = new Map(layout.buildings.map((entry) => [entry.id, entry]));
  (settlement.buildings || []).forEach((building) => {
    const entry = byId.get(building.id);
    if (!entry) return;
    building.mapX = entry.x;
    building.mapY = entry.y;
    building.mapW = entry.w;
    building.mapH = entry.h;
    building.doorSide = entry.doorSide;
    building.doorX = entry.doorX;
    building.doorY = entry.doorY;
    building.roadX = entry.roadX;
    building.roadY = entry.roadY;
    const comfort = building.comfort || buildingComfort(building, settlement);
    building.facilityClass = facilityClassForComfort(comfort);
    building.facilitySpaces = facilitySpacesForComfort(comfort);
    building.buildMonths = buildMonthsForComfort(comfort);
  });
  return layout;
}
