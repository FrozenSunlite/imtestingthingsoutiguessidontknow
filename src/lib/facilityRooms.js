// Room catalog shared by generated interiors and the Bastion/Architect layers.
//
// Architect V/R/C sizes are the spatial budget: Cramped buildings hold four
// rooms, Roomy six, Vast eight or more. Every generated room also carries a
// category (Living, Social, Storage, Business, Bastion, Attachment,
// Connection...) and a focus (living / storage / socialisation), so a
// generated house can favour what its building actually needs.

import { BASTION_FACILITIES, knownBastionFacilities } from "@/lib/homestead";

export const ROOM_FOCUS = {
  living: { label: "Living", color: "#7c9a4a" },
  storage: { label: "Storage", color: "#c08a3e" },
  social: { label: "Socialization", color: "#6a8fb0" },
};

export const ROOM_CATEGORIES = {
  Living: { label: "Living", color: "#7c9a4a" },
  Social: { label: "Social", color: "#6a8fb0" },
  Storage: { label: "Storage", color: "#c08a3e" },
  Business: { label: "Business", color: "#b45f8c" },
  Outdoor: { label: "Outdoor", color: "#4a9a6a" },
  Civic: { label: "Civic", color: "#4f7cac" },
  Military: { label: "Military", color: "#a44a4a" },
  Bastion: { label: "Bastion", color: "#e5c15a" },
  Attachment: { label: "Attachment", color: "#8a6fbf" },
  Connection: { label: "Connection", color: "#7c7c8a" },
  Misc: { label: "Misc", color: "#8a8a8a" },
};

const profile = (category, focus) => ({ category, focus });

export const SEAT_OF_POWER = {
  name: "Throne Room",
  category: "Living",
  focus: "social",
  w: 4,
  h: 4,
  level: 0,
  bastionOnly: true,
  seatOfPower: true,
  countsAgainstKnown: false,
  hirelings: 2,
  desc:
    "4×4 Seat of Power. Bastion only, free, and it does not count against your known Bastion facilities.",
};

// Explicit profiles for the room names used by generated settlements. Unknown
// names fall through to keyword inference below, so new templates still work.
export const ROOM_PROFILES = {
  // Living
  Bedroom: profile("Living", "living"),
  "Bunk Room": profile("Living", "living"),
  "Servant's Room": profile("Living", "living"),
  "Guest Room": profile("Living", "living"),
  "Living Room": profile("Living", "social"),
  Kitchen: profile("Living", "living"),
  Bath: profile("Living", "living"),
  Privy: profile("Living", "living"),
  Nursery: profile("Living", "living"),
  Washateria: profile("Living", "living"),
  "Sun/Wet Room": profile("Living", "living"),
  Farmhouse: profile("Living", "living"),
  "Throne Room": profile("Living", "social"),
  // Social
  "Common Room": profile("Social", "social"),
  "Great Hall": profile("Social", "social"),
  Hall: profile("Social", "social"),
  "Meeting Hall": profile("Social", "social"),
  Courtroom: profile("Civic", "social"),
  Sanctuary: profile("Social", "social"),
  Shrine: profile("Social", "social"),
  Parlor: profile("Social", "social"),
  "Dining Room": profile("Social", "social"),
  Conservatory: profile("Social", "social"),
  Theater: profile("Social", "social"),
  "Gaming Hall": profile("Social", "social"),
  Pub: profile("Social", "social"),
  "Trophy Room": profile("Social", "social"),
  Observatory: profile("Social", "social"),
  Menagerie: profile("Living", "living"),
  "Teleportation Circle": profile("Connection", "social"),
  Gallery: profile("Connection", "social"),
  "Watch Room": profile("Military", "social"),
  "Mess Hall": profile("Military", "social"),
  "Drill Hall": profile("Military", "social"),
  // Storage
  Storage: profile("Storage", "storage"),
  Cellar: profile("Attachment", "storage"),
  Attic: profile("Attachment", "storage"),
  Vault: profile("Storage", "storage"),
  Archive: profile("Storage", "storage"),
  Library: profile("Storage", "storage"),
  Treasury: profile("Storage", "storage"),
  Armory: profile("Storage", "storage"),
  Granary: profile("Storage", "storage"),
  Pantry: profile("Storage", "storage"),
  Closet: profile("Storage", "storage"),
  Warehouse: profile("Storage", "storage"),
  "Grain Store": profile("Storage", "storage"),
  "Ore Store": profile("Storage", "storage"),
  Hayloft: profile("Storage", "storage"),
  Storehouse: profile("Storage", "storage"),
  Scriptorium: profile("Storage", "storage"),
  Reliquary: profile("Storage", "storage"),
  "Reading Room": profile("Storage", "storage"),
  Study: profile("Storage", "storage"),
  "Safe Room": profile("Business", "storage"),
  // Business
  Shop: profile("Business", "social"),
  Stalls: profile("Business", "social"),
  Office: profile("Business", "social"),
  Workshop: profile("Business", "storage"),
  Smithy: profile("Business", "storage"),
  Laboratory: profile("Business", "storage"),
  Workstation: profile("Business", "storage"),
  "Till Counter": profile("Business", "social"),
  "Ledger Room": profile("Business", "storage"),
  Showroom: profile("Business", "social"),
  "Counting House": profile("Business", "storage"),
  Chancery: profile("Business", "social"),
  "Shipping & Receiving": profile("Business", "storage"),
  Taverny: profile("Business", "social"),
  Brewery: profile("Business", "storage"),
  "Loading Bay": profile("Business", "storage"),
  Mill: profile("Business", "storage"),
  "Mill Floor": profile("Business", "storage"),
  Bakery: profile("Business", "living"),
  "Treatment Room": profile("Business", "living"),
  // Outdoor
  Garden: profile("Outdoor", "living"),
  Farmland: profile("Outdoor", "living"),
  Greenhouse: profile("Outdoor", "living"),
  Apiary: profile("Outdoor", "living"),
  "Animal Pen": profile("Outdoor", "living"),
  Stable: profile("Outdoor", "living"),
  Barn: profile("Outdoor", "storage"),
  Yard: profile("Outdoor", "social"),
  Pier: profile("Outdoor", "social"),
  Well: profile("Outdoor", "social"),
  "Village Green": profile("Outdoor", "social"),
  // Military / Civic
  Cells: profile("Military", "storage"),
  Dungeon: profile("Military", "storage"),
  Tower: profile("Military", "storage"),
  "Signal Room": profile("Military", "social"),
  Barrack: profile("Living", "living"),
  // Attachments and special spaces
  Porch: profile("Attachment", "social"),
  Balcony: profile("Attachment", "social"),
  "Stair Hall": profile("Connection", "social"),
  Landing: profile("Connection", "social"),
  // Bastion special facilities
  "Arcane Study": profile("Bastion", "social"),
  Sacristy: profile("Bastion", "storage"),
  "Training Area": profile("Bastion", "social"),
  "Meditation Chamber": profile("Bastion", "living"),
  "War Room": profile("Bastion", "social"),
  Sanctum: profile("Bastion", "social"),
  Guildhall: profile("Bastion", "social"),
  Demiplane: profile("Bastion", "storage"),
  "Dragonmark Outpost": profile("Bastion", "social"),
  "Kundarak Vault": profile("Bastion", "storage"),
  "Navigator's Helm": profile("Bastion", "storage"),
  "Orien Helm": profile("Bastion", "storage"),
  "Artificer's Forge": profile("Bastion", "storage"),
  "Inquisitive Agency": profile("Bastion", "social"),
  "Lyrandar Helm": profile("Bastion", "storage"),
  "Manifest Zone": profile("Bastion", "social"),
  Museum: profile("Bastion", "social"),
  "Construct Forge": profile("Bastion", "storage"),
  Rookery: profile("Bastion", "living"),
  "Séance Parlor": profile("Bastion", "social"),
  "Ancient Altar": profile("Bastion", "social"),
  "Cabinet of Curiosities": profile("Bastion", "storage"),
  Infirmary: profile("Bastion", "living"),
  "Lightning Generator": profile("Bastion", "storage"),
  "Spirit Vault": profile("Bastion", "storage"),
  "Liminal Space": profile("Bastion", "social"),
  "Entertainment Salon": profile("Bastion", "social"),
  "Geothermal Vent": profile("Bastion", "storage"),
  Morgue: profile("Bastion", "storage"),
  "Soup Kitchen": profile("Bastion", "living"),
  "Transmutation Vat": profile("Bastion", "storage"),
  "Circus Tent": profile("Bastion", "social"),
  "Heist Planning Chamber": profile("Bastion", "social"),
  Lighthouse: profile("Bastion", "social"),
  "Planar Gateway": profile("Bastion", "social"),
  "Amethyst Dragon Den": profile("Bastion", "social"),
  "Harper Hideout": profile("Bastion", "social"),
  "Red Wizard Necropolis": profile("Bastion", "storage"),
  "Zhentarim Travel Station": profile("Bastion", "social"),
  "Emerald Enclave Grove": profile("Bastion", "living"),
  "Lords' Alliance Noble Residence": profile("Bastion", "living"),
  "Order of the Gauntlet Tournament Field": profile("Bastion", "social"),
  "Cult of the Dragon Archive": profile("Bastion", "storage"),
};

const BASTION_FOCUS = {
  "Arcane Study": "social",
  Armory: "storage",
  Barrack: "living",
  Garden: "living",
  Library: "storage",
  Sanctuary: "social",
  Smithy: "storage",
  Storehouse: "storage",
  Workshop: "storage",
  "Gaming Hall": "social",
  Greenhouse: "living",
  Laboratory: "storage",
  Sacristy: "storage",
  Scriptorium: "storage",
  Stable: "living",
  "Teleportation Circle": "social",
  Theater: "social",
  "Training Area": "social",
  "Trophy Room": "social",
  Archive: "storage",
  "Meditation Chamber": "living",
  Menagerie: "living",
  Observatory: "social",
  Pub: "social",
  Reliquary: "storage",
  Demiplane: "storage",
  Guildhall: "social",
  Sanctum: "social",
  "War Room": "social",
};

export function roomProfileFor(type) {
  const key = String(type || "");
  if (ROOM_PROFILES[key]) return ROOM_PROFILES[key];
  if (key === SEAT_OF_POWER.name) return SEAT_OF_POWER;

  const text = key.toLowerCase();
  if (/throne|seat of power/.test(text)) return SEAT_OF_POWER;
  if (/bed|bunk|living|parlor|dining|kitchen|bath|privy|nursery|wash|servant|guest|barrack|meditation|menagerie|stable|infirmary|soup|farmhouse/.test(text)) {
    return profile("Living", "living");
  }
  if (/storage|cellar|attic|vault|archive|library|treasury|armory|granary|pantry|closet|warehouse|store|scriptorium|reliquary|museum|vault|safe room/.test(text)) {
    return profile("Storage", "storage");
  }
  if (/shop|stall|market|office|workshop|smithy|laboratory|ledger|till|showroom|counting|chancery|business|brewery|taverny|loading|mill|forge|workstation/.test(text)) {
    return profile("Business", "storage");
  }
  if (/garden|yard|farm|greenhouse|apiary|stable|barn|pen|dock|pier|outdoor/.test(text)) {
    return profile("Outdoor", "living");
  }
  if (/barrack|watch|signal|drill|mess|dungeon|tower|cell|military|gate/.test(text)) {
    return profile("Military", "social");
  }
  if (/hall|court|sanctuary|shrine|theater|pub|gaming|meeting|common|tavern|social|gallery|porch|balcony|landing/.test(text)) {
    return profile("Social", "social");
  }
  return profile("Misc", "social");
}

export const roomCategoryColor = (category) =>
  ROOM_CATEGORIES[category]?.color || ROOM_CATEGORIES.Misc.color;

export const roomFocusLabel = (focus) =>
  ROOM_FOCUS[focus]?.label || ROOM_FOCUS.social.label;

export const bastionFacilityNamesForLevel = (level) =>
  BASTION_FACILITIES
    .filter((facility) => facility.level > 0 && facility.level <= level && !facility.source)
    .map((facility) => facility.name);

export const bastionFacilityLevel = (name) =>
  BASTION_FACILITIES.find((facility) => facility.name === name)?.level || 0;

export function bastionFocusFor(name) {
  return BASTION_FOCUS[name] || "social";
}

// Candidate room types for a generated building. The list is ordered for the
// floor: public/social rooms first on the ground floor, private living and
// storage rooms first above it. Duplicates are allowed for filler rooms.
export function roomTypePool({
  templateRooms = [],
  buildingType = "",
  buildingCategory = "",
  settlementKind = "",
  rulerLevel = 0,
  capitalSeat = false,
  floor = 0,
  floorCount = 1,
  count = 6,
  rng = null,
} = {}) {
  const rand = () => (rng?.rand ? rng.rand() : 0.5);
  const chance = (p) => (rng?.chance ? rng.chance(p) : rand() < p);
  const types = [];
  const seen = new Set();
  const add = (type, force = false) => {
    if (!type) return;
    if (!force && seen.has(type)) return;
    seen.add(type);
    types.push(type);
  };
  const addAll = (list) => (list || []).forEach((type) => add(type));

  addAll(
    (templateRooms || []).filter((type) => type !== SEAT_OF_POWER.name)
  );

  const business = ["Commercial", "Industrial", "Service", "Food"].includes(buildingCategory);
  const residential = buildingCategory === "Residential";
  const civic = buildingCategory === "Civic";
  const military = buildingCategory === "Military";
  // Only the capital's single seat of government contains the ruler's Bastion
  // facilities, up to their known-facility limit. The Seat of Power is extra.
  if (
    settlementKind === "capital" &&
    capitalSeat &&
    rulerLevel >= 5 &&
    floor === 0
  ) {
    const available = bastionFacilityNamesForLevel(rulerLevel);
    const known = knownBastionFacilities(rulerLevel);
    const limit = Math.min(available.length, known, Math.max(2, count - 2));
    const shuffled = [...available].sort(() => rand() - 0.5).slice(0, limit);
    addAll(shuffled);
    if (floor === 0) add(SEAT_OF_POWER.name);
  }

  if (business) {
    addAll(["Till Counter", "Ledger Room", "Showroom", "Counting House", "Workstation", "Storage", "Office"]);
  }
  if (residential) {
    addAll(["Bedroom", "Kitchen", "Living Room", "Storage", "Privy", "Parlor", "Dining Room"]);
  }
  if (civic) addAll(["Office", "Archive", "Meeting Hall", "Hall"]);
  if (military) addAll(["Bunk Room", "Armory", "Mess Hall", "Watch Room", "Drill Hall"]);
  if (buildingCategory === "Food") addAll(["Garden", "Storage", "Kitchen", "Yard"]);
  if (/Tavern|Inn/.test(buildingType)) addAll(["Common Room", "Kitchen", "Bedroom", "Storage"]);
  if (/Castle|Manor|Palace/.test(buildingType)) addAll(["Great Hall", "Bedroom", "Kitchen", "Armory", "Dungeon"]);
  if (/Temple|Sanctuary/.test(buildingType)) addAll(["Sanctuary", "Shrine", "Vestry", "Garden"]);
  if (/Library/.test(buildingType)) addAll(["Reading Room", "Archive", "Study", "Office"]);
  if (/Dock|Warehouse/.test(buildingType)) addAll(["Warehouse", "Loading Bay", "Office", "Bunk Room"]);
  if (/Town Hall|Courthouse|Guildhall/.test(buildingType)) addAll(["Hall", "Office", "Archive", "Meeting Hall"]);

  // Attachments and connections show up occasionally, like the Architect's
  // optional attic/cellar/porch/corridor pieces.
  if (chance(0.35)) add("Cellar");
  if (chance(0.25)) add("Attic");
  if (chance(0.2)) add("Gallery");

  const fillers =
    floor === 0
      ? ["Common Room", "Storage", "Office", "Kitchen", "Bedroom", "Hall", "Shop", "Meeting Hall"]
      : ["Bedroom", "Storage", "Living Room", "Study", "Bath", "Guest Room", "Privy"];
  let index = 0;
  while (types.length < count && index < 60) {
    add(fillers[index % fillers.length], true);
    index += 1;
  }

  const priority = (type) => {
    const room = roomProfileFor(type);
    const social =
      room.focus === "social" ||
      room.category === "Social" ||
      (room.category === "Bastion" && /Hall|Pub|Theater|Gaming|Throne|Sanctum|Guildhall|Salon|Tent/.test(type));
    if (floor === 0) {
      if (social) return 0;
      if (room.category === "Business") return 1;
      if (room.category === "Storage") return 2;
      return 3;
    }
    if (room.category === "Living") return 0;
    if (room.category === "Storage") return 1;
    if (social) return 2;
    return 3;
  };

  return types
    .map((type, position) => ({ type, position, rank: priority(type) }))
    .sort((a, b) => a.rank - b.rank || a.position - b.position)
    .map((item) => item.type);
}
