// 100 starter room templates for the Dungeon Builder. Each room encodes a
// tactical footprint, cover, elevation and tags; monsters are deliberately left
// out so the generator can populate encounters from the party/rank rules.
const LAYOUTS = [
  { shape: "Rectangle", cover: "Open", elevation: "Flat", tags: ["open ground", "sightlines"] },
  { shape: "L-Shape", cover: "Pillars (half cover)", elevation: "Raised dais (+1)", tags: ["chokepoint", "half cover"] },
  { shape: "Cross", cover: "Crates (half cover)", elevation: "Sunken floor (−1)", tags: ["flanking", "cover"] },
  { shape: "Circle", cover: "Low wall (three-quarters)", elevation: "Flat", tags: ["ring", "three-quarters cover"] },
  { shape: "T-Shape", cover: "Fog (lightly obscured)", elevation: "Raised dais (+1)", tags: ["lanes", "obscured"] },
  { shape: "Octagon", cover: "Pillars (half cover)", elevation: "Tiered steps (+2)", tags: ["multi-level", "pillars"] },
  { shape: "U-Shape", cover: "Crates (half cover)", elevation: "Flat", tags: ["alcoves", "ambush"] },
  { shape: "Diamond", cover: "Open", elevation: "Chasm edge (−2)", tags: ["exposed", "hazard"] },
  { shape: "Irregular", cover: "Low wall (three-quarters)", elevation: "Flat", tags: ["cave", "broken ground"] },
  { shape: "Rectangle", cover: "Pillars (half cover)", elevation: "Raised dais (+1)", tags: ["siege", "defensible"] },
];

const CATEGORY_ROOMS = {
  Chamber: [
    "Pillared Hall", "Sunken Atrium", "Collapsed Gallery", "Crystal Grotto", "Flooded Cistern",
    "Fungal Conservatory", "Bone Orchard", "Arcane Workshop", "Shattered Rotunda", "Forgotten Barracks",
  ],
  Corridor: [
    "Narrow Passage", "Weeping Hall", "Collapsed Tunnel", "Pillar Run", "Bridge Galleria",
    "Spiral Descent", "Choked Causeway", "Lantern Walk", "Iron Aqueduct", "Whispering Crawl",
  ],
  Trap: [
    "Spike Pit", "Pressure Plate Gallery", "Falling Ceiling", "Flame Jet Hall", "Acid Channel",
    "Rune-Sealed Vault", "Pendulum Gauntlet", "Poison Mister", "Rolling Boulder Run", "Abyssal Gate",
  ],
  Puzzle: [
    "Sealed Vault", "Clockwork Sanctum", "Riddle Chamber", "Mirrored Hall", "Elemental Locks",
    "Star Chart Room", "Weighing Room", "Chime Gallery", "Pressure Sigil", "Orbital Orrery",
  ],
  Loot: [
    "Treasure Vault", "Abandoned Strongroom", "Gilded Ossuary", "Merchant Cache", "Reliquary of Coins",
    "Forgotten Armory", "Gemstone Alcove", "Sealed Treasury", "Smuggler's Hold", "Offering Chamber",
  ],
  Elite: [
    "Ritual Chamber", "War Council", "Beast Pen", "Duelist's Ring", "Shadow Gallery",
    "Iron Colosseum", "Chained Sanctum", "Butcher's Floor", "Arcane Laboratory", "Captain's Quarters",
  ],
  Boss: [
    "Boss Sanctum", "Throne of Ash", "Drowned Court", "Iron Colosseum", "Frozen Crown",
    "Obsidian Choir", "Sunken Idol", "Crimson Reliquary", "Storm Nexus", "Hollow Crown",
  ],
  Rest: [
    "Bonfire Camp", "Safe Alcove", "Quiet Shrine", "Hidden Spring", "Lantern Refuge",
    "Warded Nook", "Mushroom Rest", "Sealed Camp", "Watchfire Post", "Pilgrim's Rest",
  ],
  Shop: [
    "Hidden Cache", "Wandering Merchant", "Relic Peddler", "Smuggler's Stall", "Alchemist's Nook",
    "Salvage Depot", "Black Market", "Curio Cart", "Armorer's Bolthole", "Fence's Den",
  ],
  Harvest: [
    "Crystal Vein", "Herb Grove", "Ore Seam", "Fungal Bloom", "Mana Spring",
    "Ancient Root", "Salt Ledge", "Bone Field", "Silk Hollow", "Ember Nest",
  ],
};

const SIZE_BY_CATEGORY = {
  Chamber: [12, 26],
  Corridor: [9, 16],
  Trap: [9, 20],
  Puzzle: [12, 24],
  Loot: [9, 18],
  Elite: [18, 30],
  Boss: [24, 33],
  Rest: [9, 14],
  Shop: [9, 16],
  Harvest: [9, 18],
};

const ENV_BY_CATEGORY = {
  Chamber: "Damp stone",
  Corridor: "Mine shafts",
  Trap: "Ancient ruins",
  Puzzle: "Arcane laboratory",
  Loot: "Shadowed crypt",
  Elite: "Volcanic vents",
  Boss: "Volcanic vents",
  Rest: "Sheltered alcove",
  Shop: "Ancient ruins",
  Harvest: "Fungal cavern",
};

const TRAPS = [
  "Pressure plate: DC 8 + 2×rank Dexterity save or 1d6×rank piercing",
  "Falling ceiling: DC 8 + 2×rank Dexterity/Strength save or 1d6×rank bludgeoning",
  "Spike pit: DC 8 + 2×rank Dexterity save or 2d6×rank piercing",
  "Alarm rune: alerts the nearest room",
  "Collapsing bridge: DC 10 + rank Dexterity save or fall 2 spaces",
  "Flame jet: DC 10 + rank Dexterity save or 2d6×rank fire",
  "Poison mist: DC 10 + rank Constitution save or poisoned",
];

const HARVEST = {
  "Crystal Vein": ["Glow crystal", "Mana crystal", "Resonance shard"],
  "Herb Grove": ["Silverleaf", "Bloodroot", "Sunpetal"],
  "Ore Seam": ["Iron ore", "Silver ore", "Mithral fragment"],
  "Fungal Bloom": ["Glowcap", "Spore silk", "Remedy mold"],
  "Mana Spring": ["Mana dew", "Ether bloom", "Arcane residue"],
  "Ancient Root": ["Petrified root", "Worldbark", "Sap of ages"],
  "Salt Ledge": ["Salt crystal", "Brine pearl", "Preserved reagents"],
  "Bone Field": ["Fossil shard", "Ivory splinter", "Ancient marrow"],
  "Silk Hollow": ["Spider silk", "Phase thread", "Weaver gland"],
  "Ember Nest": ["Ember scale", "Cinder gland", "Fire crystal"],
};

const slug = (text) =>
  String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function makeRoom(category, name, index) {
  const layout = LAYOUTS[index % LAYOUTS.length];
  const [min, max] = SIZE_BY_CATEGORY[category] || [9, 20];
  const traps = category === "Trap" ? [TRAPS[index % TRAPS.length]] : [];
  if (category === "Trap" && index % 3 === 0) {
    traps.push(TRAPS[(index + 2) % TRAPS.length]);
  }
  const harvest = category === "Harvest" ? HARVEST[name] || ["Rare reagent"] : [];
  const loot = category === "Loot" ? ["Rank-appropriate treasure cache"] : [];
  const environmentEffect =
    index === 8
      ? "Unstable ground: difficult terrain in the marked half of the room."
      : index === 9
        ? "Unnatural gloom: lightly obscured beyond the room's center."
        : "";
  return {
    id: `starter-${slug(category)}-${slug(name)}`,
    name,
    category,
    minW: min,
    maxW: max,
    minH: min,
    maxH: max,
    shape: layout.shape,
    environment: ENV_BY_CATEGORY[category] || "Damp stone",
    elevation: layout.elevation,
    cover: layout.cover,
    connector: category === "Corridor" ? "Archway" : "Doorway",
    tags: [category, ...layout.tags, ...(harvest.length ? ["harvest"] : [])],
    description: `${name} — a ${layout.tags.join(", ")} ${category.toLowerCase()} shaped for tactical play.`,
    traps,
    spawns: [],
    loot,
    harvest,
    environmentEffect,
    notes: `${layout.tags.join(" · ")}. Designed for ${category.toLowerCase()} encounters; monsters are placed by the generator.`,
    enabled: true,
    bonfire: category === "Rest" && index === 0,
    cr0Only: false,
  };
}

export const STARTER_DUNGEON_ROOMS = Object.entries(CATEGORY_ROOMS).flatMap(
  ([category, names]) => names.map((name, index) => makeRoom(category, name, index))
);

export const STARTER_ROOM_IDS = new Set(STARTER_DUNGEON_ROOMS.map((r) => r.id));
