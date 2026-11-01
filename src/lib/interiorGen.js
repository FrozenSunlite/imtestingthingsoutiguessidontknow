// Grid-based building interiors.
//
// Every room is a whole number of 5-ft. spaces. A central cross-corridor is cut
// through the building, the four quadrants become rooms (each can split into two
// stacked rooms), and every room gets a door onto the corridor. This mirrors the
// Architect's grid: no floating rooms, no arbitrary gutters.

import { makeRng } from "@/lib/worldNames";
import {
  buildingFootprint,
  buildingComfort,
  facilityClassForComfort,
  facilitySpacesForComfort,
  buildMonthsForComfort,
} from "@/lib/cityLayout";
import {
  ROOM_CATEGORIES,
  SEAT_OF_POWER,
  bastionFacilityLevel,
  bastionFocusFor,
  roomProfileFor,
  roomTypePool,
} from "@/lib/facilityRooms";

export const ROOM_TEXTURES = {
  Bedroom: "wood", Kitchen: "stone", "Common Room": "wood", Cellar: "stone",
  Smithy: "stone", Workshop: "wood", Storage: "stone", Office: "wood",
  Hall: "marble", Sanctuary: "marble", Shrine: "stone", Vestry: "wood",
  Garden: "grass", "Great Hall": "marble", Library: "wood", Study: "wood",
  Bath: "tile", "Servant's Room": "wood", "Living Room": "wood", Privy: "stone",
  "Bunk Room": "wood", Armory: "stone", "Mess Hall": "wood", "Drill Hall": "stone",
  "Meeting Hall": "wood", Archive: "stone", Treasury: "stone", "Reading Room": "wood",
  Laboratory: "stone", Shop: "wood", Stalls: "dirt", "Tack Room": "wood",
  Hayloft: "wood", Yard: "dirt", "Mill Floor": "wood", "Grain Store": "stone",
  Pier: "wood", "Shaft Head": "stone", "Ore Store": "stone", Barn: "wood",
  Granary: "wood", "Throne Room": "marble", Dungeon: "stone", Tower: "stone",
  "Watch Room": "stone", "Signal Room": "stone", "Treatment Room": "wood",
  Bakery: "stone", "Loading Bay": "stone", "Steam Room": "tile", Courtroom: "wood",
  Cells: "stone", Brewing: "stone", "Wine Cellar": "stone", Well: "dirt",
  "Village Green": "grass", "Guest Room": "wood", Parlor: "wood",
  "Till Counter": "wood", "Ledger Room": "wood", Showroom: "wood",
  "Counting House": "stone", Chancery: "wood", Workstation: "stone",
  "Safe Room": "stone", "Shipping & Receiving": "stone", Gallery: "wood",
  Attic: "wood", Porch: "wood", Balcony: "wood",
  "Arcane Study": "wood", "Gaming Hall": "wood", Storehouse: "stone",
  Sacristy: "stone", Scriptorium: "wood", "Training Area": "dirt",
  "Meditation Chamber": "wood", "War Room": "stone", Sanctum: "marble",
  Guildhall: "wood", Demiplane: "stone",
};

export const INTERIOR_CELL = 128;

const FALLBACK_TYPES = [
  "Hall",
  "Storage",
  "Office",
  "Bedroom",
  "Kitchen",
  "Common Room",
  "Workshop",
];

// Facility scale controls how many rooms a generated building can support:
// a Cramped facility is small, a Roomy one supports more rooms, and a Vast one
// can use the full four-quadrant split.
const ROOM_BUDGET_BY_FACILITY = {
  Cramped: 4,
  Roomy: 6,
  Vast: 9,
};

const PUBLIC_ROOMS = new Set([
  "Common Room",
  "Shop",
  "Hall",
  "Great Hall",
  "Sanctuary",
  "Market",
  "Stalls",
  "Courtroom",
  "Meeting Hall",
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const rect = (x, y, w, h) => ({ x, y, w, h });

export function interiorSizeFor(footprint) {
  const fw = Math.max(1, Number(footprint?.w) || 2);
  const fh = Math.max(1, Number(footprint?.h) || 2);
  return {
    width: clamp(6 + fw * 2, 8, 18),
    height: clamp(6 + fh * 2, 8, 18),
  };
}

function corridorTiles(width, height) {
  const corridorX = Math.floor(width / 2);
  const corridorY = Math.floor(height / 2);
  const tiles = [];
  for (let y = 1; y <= height - 2; y += 1) tiles.push({ x: corridorX, y });
  for (let x = 1; x <= width - 2; x += 1) {
    if (x !== corridorX) tiles.push({ x, y: corridorY });
  }
  return { tiles, corridorX, corridorY };
}

function quadrantRects(width, height, corridorX, corridorY) {
  return [
    rect(1, 1, corridorX - 1, corridorY - 1),
    rect(corridorX + 1, 1, width - corridorX - 2, corridorY - 1),
    rect(1, corridorY + 1, corridorX - 1, height - corridorY - 2),
    rect(corridorX + 1, corridorY + 1, width - corridorX - 2, height - corridorY - 2),
  ].filter((quadrant) => quadrant.w >= 2 && quadrant.h >= 2);
}

// Greedy guillotine partition: split the largest room along its long axis with
// a randomised ratio. This is what turns a uniform quadrant into a mix of wide
// halls, tall narrow rooms, and small closets while keeping every room whole.
function splitRect(bounds, count, rng) {
  let rooms = [bounds];
  while (rooms.length < count) {
    const splittable = rooms.filter((room) => room.w >= 4 || room.h >= 4);
    if (!splittable.length) break;
    splittable.sort((a, b) => b.w * b.h - a.w * a.h);
    const pickIndex = Math.min(
      splittable.length - 1,
      Math.floor(rng.rand() * Math.min(2, splittable.length))
    );
    const target = splittable[pickIndex];
    const canVertical = target.w >= 4;
    const canHorizontal = target.h >= 4;
    if (!canVertical && !canHorizontal) break;
    let vertical;
    if (canVertical && canHorizontal) {
      const preferVertical = target.w > target.h;
      vertical = rng.chance(0.72) ? preferVertical : !preferVertical;
    } else {
      vertical = canVertical;
    }
    const ratio = 0.32 + rng.rand() * 0.36;
    if (vertical) {
      const split = clamp(Math.round(target.w * ratio), 2, target.w - 2);
      rooms = rooms.filter((room) => room !== target);
      rooms.push(
        rect(target.x, target.y, split, target.h),
        rect(target.x + split, target.y, target.w - split, target.h)
      );
    } else {
      const split = clamp(Math.round(target.h * ratio), 2, target.h - 2);
      rooms = rooms.filter((room) => room !== target);
      rooms.push(
        rect(target.x, target.y, target.w, split),
        rect(target.x, target.y + split, target.w, target.h - split)
      );
    }
  }
  return rooms;
}

// Carve an exact feature room (the 4×4 Seat of Power) out of a quadrant. The
// remainder stays rectangular and is partitioned normally.
function carveFeature(quadrant, feature, corridorX, corridorY) {
  const fw = Math.min(feature.w, quadrant.w);
  const fh = Math.min(feature.h, quadrant.h);
  if (fw < 2 || fh < 2) return null;
  const rightAdjacent = quadrant.x + quadrant.w === corridorX;
  const leftAdjacent = quadrant.x === corridorX + 1;
  const bottomAdjacent = quadrant.y + quadrant.h === corridorY;
  const topAdjacent = quadrant.y === corridorY + 1;
  const x = rightAdjacent
    ? quadrant.x + quadrant.w - fw
    : leftAdjacent
      ? quadrant.x
      : quadrant.x + Math.floor((quadrant.w - fw) / 2);
  const y = bottomAdjacent
    ? quadrant.y + quadrant.h - fh
    : topAdjacent
      ? quadrant.y
      : quadrant.y + Math.floor((quadrant.h - fh) / 2);
  const featureRect = rect(x, y, fw, fh);
  const remainders = [];
  if (x > quadrant.x) remainders.push(rect(quadrant.x, quadrant.y, x - quadrant.x, quadrant.h));
  if (x + fw < quadrant.x + quadrant.w) {
    remainders.push(rect(x + fw, quadrant.y, quadrant.x + quadrant.w - (x + fw), quadrant.h));
  }
  if (y > quadrant.y) remainders.push(rect(x, quadrant.y, fw, y - quadrant.y));
  if (y + fh < quadrant.y + quadrant.h) {
    remainders.push(rect(x, y + fh, fw, quadrant.y + quadrant.h - (y + fh)));
  }
  return {
    feature: featureRect,
    remainders: remainders.filter((entry) => entry.w >= 2 && entry.h >= 2),
  };
}

function layoutRooms(width, height, corridorX, corridorY, roomBudget, rng, feature = null) {
  const quadrants = quadrantRects(width, height, corridorX, corridorY);
  if (!quadrants.length) return { rooms: [rect(1, 1, width - 2, height - 2)], featureRoom: null };
  const targets = quadrants.map(() => 1);
  let remaining = Math.max(0, roomBudget - targets.length);
  while (remaining > 0) {
    const candidates = quadrants
      .map((quadrant, index) => ({ quadrant, index }))
      .filter(({ quadrant }) => quadrant.w >= 4 || quadrant.h >= 4);
    if (!candidates.length) break;
    const choice = candidates[Math.floor(rng.rand() * candidates.length)];
    targets[choice.index] += 1;
    remaining -= 1;
  }

  let featureRoom = null;
  const rooms = [];
  let featureQuadrant = -1;
  if (feature) {
    const candidates = quadrants
      .map((quadrant, index) => ({ quadrant, index }))
      .filter(({ quadrant }) => quadrant.w >= feature.w && quadrant.h >= feature.h)
      .sort((a, b) => b.quadrant.w * b.quadrant.h - a.quadrant.w * a.quadrant.h);
    if (candidates.length) featureQuadrant = candidates[0].index;
  }

  quadrants.forEach((quadrant, index) => {
    if (index === featureQuadrant) {
      const carved = carveFeature(quadrant, feature, corridorX, corridorY);
      if (carved) {
        featureRoom = carved.feature;
        rooms.push(featureRoom);
        const remainderTarget = Math.max(1, targets[index] - 1);
        let produced = 0;
        carved.remainders.forEach((remainder, remainderIndex) => {
          const share = Math.max(
            1,
            Math.round(remainderTarget / Math.max(1, carved.remainders.length)) -
              (remainderIndex === 0 ? 0 : 1)
          );
          const pieces = splitRect(remainder, share, rng);
          produced += pieces.length;
          rooms.push(...pieces);
        });
        if (!produced) {
          // The feature filled the quadrant; that is valid on its own.
        }
        return;
      }
    }
    rooms.push(...splitRect(quadrant, targets[index], rng));
  });

  return { rooms, featureRoom };
}

function doorFor(room, corridorX, corridorY) {
  // Rooms on the left or right of the vertical corridor.
  if (room.x + room.w === corridorX) {
    return {
      x: corridorX - 1,
      y: room.y + Math.floor(room.h / 2),
      side: "east",
      corridor: { x: corridorX, y: room.y + Math.floor(room.h / 2) },
    };
  }
  if (room.x === corridorX + 1) {
    return {
      x: room.x,
      y: room.y + Math.floor(room.h / 2),
      side: "west",
      corridor: { x: corridorX, y: room.y + Math.floor(room.h / 2) },
    };
  }
  // Rooms above or below the horizontal corridor.
  if (room.y + room.h === corridorY) {
    return {
      x: room.x + Math.floor(room.w / 2),
      y: corridorY - 1,
      side: "south",
      corridor: { x: room.x + Math.floor(room.w / 2), y: corridorY },
    };
  }
  if (room.y === corridorY + 1) {
    return {
      x: room.x + Math.floor(room.w / 2),
      y: room.y,
      side: "north",
      corridor: { x: room.x + Math.floor(room.w / 2), y: corridorY },
    };
  }
  return null;
}

function internalDoor(room, other) {
  if (room.x + room.w === other.x) {
    const top = Math.max(room.y, other.y);
    const bottom = Math.min(room.y + room.h, other.y + other.h);
    if (bottom - top < 1) return null;
    return {
      x: room.x + room.w,
      y: top + Math.floor((bottom - top) / 2),
      side: "east",
      internal: true,
      toRoomId: other.id,
    };
  }
  if (other.x + other.w === room.x) {
    const top = Math.max(room.y, other.y);
    const bottom = Math.min(room.y + room.h, other.y + other.h);
    if (bottom - top < 1) return null;
    return {
      x: room.x,
      y: top + Math.floor((bottom - top) / 2),
      side: "west",
      internal: true,
      toRoomId: other.id,
    };
  }
  if (room.y + room.h === other.y) {
    const left = Math.max(room.x, other.x);
    const right = Math.min(room.x + room.w, other.x + other.w);
    if (right - left < 1) return null;
    return {
      x: left + Math.floor((right - left) / 2),
      y: room.y + room.h,
      side: "south",
      internal: true,
      toRoomId: other.id,
    };
  }
  if (other.y + other.h === room.y) {
    const left = Math.max(room.x, other.x);
    const right = Math.min(room.x + room.w, other.x + other.w);
    if (right - left < 1) return null;
    return {
      x: left + Math.floor((right - left) / 2),
      y: room.y,
      side: "north",
      internal: true,
      toRoomId: other.id,
    };
  }
  return null;
}

// Pick a ground-floor room that can carry an exterior door. Bottom and right
// rooms touch the building's outside wall directly, so prefer them; fall back
// to the left/top rooms if a tiny layout has no other option.
function exteriorEntryFor(rooms, width, height) {
  if (!rooms.length) return null;
  const candidates = [];
  rooms.forEach((room) => {
    if (room.y + room.h === height - 1) candidates.push({ room, side: "south" });
    if (room.x + room.w === width - 1) candidates.push({ room, side: "east" });
  });
  rooms.forEach((room) => {
    if (!candidates.some((entry) => entry.room.id === room.id)) {
      if (room.y === 1) candidates.push({ room, side: "north" });
      if (room.x === 1) candidates.push({ room, side: "west" });
    }
  });
  if (!candidates.length) return null;
  const publicCandidate = candidates.find(
    (entry) =>
      PUBLIC_ROOMS.has(entry.room.type) ||
      roomProfileFor(entry.room.type).category === "Social" ||
      roomProfileFor(entry.room.type).focus === "social"
  );
  const choice = publicCandidate || candidates[0];
  const room = choice.room;
  if (choice.side === "south") {
    const x = room.x + Math.floor(room.w / 2);
    return {
      side: "south",
      x,
      y: height - 1,
      roomId: room.id,
      outside: { x: x + 0.5, y: height + 0.7 },
      vector: { x1: x + 0.5, y1: height + 0.7, x2: x + 0.5, y2: height - 1 },
    };
  }
  if (choice.side === "east") {
    const y = room.y + Math.floor(room.h / 2);
    return {
      side: "east",
      x: width - 1,
      y,
      roomId: room.id,
      outside: { x: width + 0.7, y: y + 0.5 },
      vector: { x1: width + 0.7, y1: y + 0.5, x2: width - 1, y2: y + 0.5 },
    };
  }
  if (choice.side === "north") {
    const x = room.x + Math.floor(room.w / 2);
    return {
      side: "north",
      x,
      y: room.y,
      roomId: room.id,
      outside: { x: x + 0.5, y: -0.7 },
      vector: { x1: x + 0.5, y1: -0.7, x2: x + 0.5, y2: room.y },
    };
  }
  const y = room.y + Math.floor(room.h / 2);
  return {
    side: "west",
    x: room.x,
    y,
    roomId: room.id,
    outside: { x: -0.7, y: y + 0.5 },
    vector: { x1: -0.7, y1: y + 0.5, x2: room.x, y2: y + 0.5 },
  };
}

export function generateInterior({
  building = {},
  footprint = null,
  floors = null,
  roomTypes = null,
  facilityClass = "",
  settlementKind = "",
  buildingType = "",
  buildingCategory = "",
  rulerLevel = 0,
  capitalSeat = false,
  seed = "",
  rng = makeRng(`${building.id || "building"}:interior`),
} = {}) {
  const size = interiorSizeFor(footprint || buildingFootprint(building));
  const width = size.width;
  const height = size.height;
  const floorCount = clamp(Number(floors) || Number(building.floors) || 1, 1, 8);
  const facility =
    facilityClass ||
    building.facilityClass ||
    facilityClassForComfort(building.comfort || "Poor");
  const roomBudget = ROOM_BUDGET_BY_FACILITY[facility] || 6;
  const { tiles: corridor, corridorX, corridorY } = corridorTiles(width, height);
  const existingRooms = Array.isArray(building.rooms) ? building.rooms : [];
  const types = roomTypes?.length
    ? roomTypes
    : existingRooms.map((room) => room.type).filter(Boolean);
  const sourceTypes = types.length ? types : FALLBACK_TYPES;
  const floorData = [];
  const flatRooms = [];
  const buildingTypeLabel = buildingType || building.type || "";
  const buildingCategoryLabel = buildingCategory || building.category || "";
  const seatOfGovernment =
    settlementKind === "capital" &&
    !!capitalSeat &&
    rulerLevel >= 5;

  for (let floor = 0; floor < floorCount; floor += 1) {
    const feature = floor === 0 && seatOfGovernment ? SEAT_OF_POWER : null;
    const { rooms: rects, featureRoom } = layoutRooms(
      width,
      height,
      corridorX,
      corridorY,
      roomBudget,
      rng,
      feature
    );
    const pool = roomTypePool({
      templateRooms: sourceTypes,
      buildingType: buildingTypeLabel,
      buildingCategory: buildingCategoryLabel,
      settlementKind,
      rulerLevel,
      capitalSeat: seatOfGovernment,
      floor,
      floorCount,
      count: rects.length + (featureRoom ? 1 : 0),
      rng,
    }).filter((type) => !(featureRoom && type === SEAT_OF_POWER.name));
    const typeQueue = [...pool];
    const oldRooms = existingRooms.filter(
      (room) => Number(room.floor || 1) === floor + 1
    );
    const usedOld = new Set();
    const takeOld = (type) => {
      const match =
        oldRooms.find((room) => !usedOld.has(room.id) && room.type === type) ||
        oldRooms.find((room) => !usedOld.has(room.id));
      if (match) usedOld.add(match.id);
      return match || null;
    };
    const orderedRects = [...rects].sort((a, b) => b.w * b.h - a.w * a.h);
    const rooms = orderedRects.map((bounds, index) => {
      const isFeature = bounds === featureRoom;
      const type = isFeature
        ? SEAT_OF_POWER.name
        : typeQueue.shift() || FALLBACK_TYPES[index % FALLBACK_TYPES.length];
      const old = takeOld(type);
      const profile = roomProfileFor(type);
      const seatOfPower = type === SEAT_OF_POWER.name;
      const capitalBastion =
        seatOfGovernment && floor === 0 && bastionFacilityLevel(type) > 0;
      const category =
        capitalBastion && !seatOfPower
          ? "Bastion"
          : ROOM_CATEGORIES[profile.category]
            ? profile.category
            : "Misc";
      const focus =
        capitalBastion && !seatOfPower
          ? bastionFocusFor(type)
          : profile.focus || "social";
      const room = {
        id: old?.id || `room_${building.id || "b"}_${floor + 1}_${index + 1}`,
        type,
        category,
        focus,
        bastion: seatOfPower || capitalBastion ? type : "",
        bastionLevel:
          seatOfPower || capitalBastion ? bastionFacilityLevel(type) : 0,
        seatOfPower,
        x: bounds.x,
        y: bounds.y,
        w: bounds.w,
        h: bounds.h,
        floor: floor + 1,
        floorTexture:
          old?.floorTexture || ROOM_TEXTURES[type] || rng.pick(["wood", "stone", "dirt", "tile"]),
        floorTextureUrl: old?.floorTextureUrl || "",
        assets: Array.isArray(old?.assets) ? [...old.assets] : [],
        stickers: Array.isArray(old?.stickers) ? [...old.stickers] : [],
        stickersCustom: !!old?.stickersCustom,
        notes: old?.notes || "",
        door: doorFor(bounds, corridorX, corridorY),
      };
      return room;
    });

    // Stranded rooms (usually a small closet behind a larger room) connect to
    // an adjacent room with an internal door instead of being left sealed.
    rooms.forEach((room) => {
      if (room.door) return;
      const neighbour = rooms.find(
        (other) => other.id !== room.id && other.door && internalDoor(room, other)
      );
      if (neighbour) room.door = internalDoor(room, neighbour);
    });
    rooms.forEach((room) => {
      if (room.door) return;
      const neighbour = rooms.find(
        (other) => other.id !== room.id && internalDoor(room, other)
      );
      if (neighbour) room.door = internalDoor(room, neighbour);
    });

    const exteriorDoor = floor === 0 ? exteriorEntryFor(rooms, width, height) : null;
    if (exteriorDoor) {
      const entryRoom = rooms.find((room) => room.id === exteriorDoor.roomId);
      if (entryRoom) entryRoom.exteriorDoor = exteriorDoor;
    }
    const stairs =
      floorCount > 1
        ? [
            {
              x: corridorX,
              y: height - 2,
              up: floor < floorCount - 1,
              down: floor > 0,
            },
          ]
        : [];
    floorData.push({
      floor: floor + 1,
      rooms,
      corridor: corridor.map((tile) => ({ ...tile })),
      stairs,
      exteriorDoor,
      featureRoomId: featureRoom
        ? rooms.find((room) => room.type === SEAT_OF_POWER.name)?.id || ""
        : "",
    });
    flatRooms.push(...rooms);
  }

  return {
    version: 6,
    seed: seed || `${building.id || "building"}:${floorCount}:interior`,
    width,
    height,
    corridorX,
    corridorY,
    facilityClass: facility,
    facilitySpaces: facilitySpacesForComfort(building.comfort || "Poor"),
    buildMonths: buildMonthsForComfort(building.comfort || "Poor"),
    floors: floorData,
    rooms: flatRooms,
    generatedAt: new Date().toISOString(),
  };
}

// A generated building's population is two people per Bedroom. Businesses are
// not given Bedrooms unless they are an Inn, so they normally have no residents
// living on site.
export const isBedroomRoom = (room) =>
  /(^|\s)bedrooms?(\s|$)/i.test(String(room?.type ?? room ?? "").trim());

export function bedroomCount(rooms) {
  return (rooms || []).filter((room) => isBedroomRoom(room)).length;
}

export function buildingPopulation(rooms) {
  return bedroomCount(rooms) * 2;
}

export function roomsForBuilding(category, type, rooms) {
  const list = Array.isArray(rooms) ? rooms : [];
  const cat = String(category || "").toLowerCase();
  const isBusiness = ["commercial", "industrial", "service", "food"].includes(cat);
  const isInn = /(^|\s)inn(\s|$)/i.test(String(type || ""));
  if (!isBusiness || isInn) return list;
  return list.filter((room) => !isBedroomRoom(room));
}

// Returns a building with a usable grid interior. Old saves have rooms without
// x/y; they are laid out deterministically and keep their ids, textures and
// imported assets.
export function ensureInterior(building, settlement = null, { seed = "", force = false } = {}) {
  if (!building) return null;
  const hasGrid = (building.rooms || []).every(
    (room) => Number.isFinite(room.x) && Number.isFinite(room.y) && room.w && room.h
  );
  if (building.interior?.version === 6 && hasGrid && !force) {
    if (!building.interior.seed) {
      return {
        ...building,
        interior: {
          ...building.interior,
          seed: `${building.id || "building"}:${building.floors || 1}:interior`,
        },
        bedrooms: bedroomCount(building.rooms),
        population: buildingPopulation(building.rooms),
      };
    }
    return {
      ...building,
      bedrooms: bedroomCount(building.rooms),
      population: buildingPopulation(building.rooms),
    };
  }
  const footprint = building.footprint || buildingFootprint(building, settlement);
  const comfort = buildingComfort(building, settlement);
  const facilityClass = building.facilityClass || facilityClassForComfort(comfort);
  const rulerLevel =
    settlement?.rulerLevel ||
    building.rulerLevel ||
    (settlement?.kind === "capital" ? 5 : 0);
  const interior = generateInterior({
    building,
    footprint,
    floors: building.floors,
    roomTypes: roomsForBuilding(
      building.category,
      building.type,
      (building.rooms || []).map((room) => room.type).filter(Boolean)
    ),
    facilityClass,
    settlementKind: settlement?.kind || building.settlementKind || "",
    buildingType: building.type || "",
    buildingCategory: building.category || "",
    rulerLevel,
    capitalSeat: !!building.capitalSeat,
    seed,
    rng: makeRng(seed || `${building.id || "building"}:${building.floors || 1}:grid`),
  });
  return {
    ...building,
    footprint,
    comfort,
    facilityClass,
    facilitySpaces: facilitySpacesForComfort(comfort),
    buildMonths: buildMonthsForComfort(comfort),
    interior,
    interiorSize: { w: interior.width, h: interior.height },
    rooms: interior.rooms,
    bedrooms: bedroomCount(interior.rooms),
    population: buildingPopulation(interior.rooms),
  };
}

