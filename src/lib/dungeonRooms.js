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

const OBJECTS_BY_CATEGORY = {
  Chamber: ["Table", "Chairs", "Braziers", "Tapestries"],
  Corridor: ["Wall sconces", "Archway", "Debris"],
  Trap: ["Pressure plate", "Tripwire", "Warning rune"],
  Puzzle: ["Pedestal", "Sigil", "Lever", "Chime"],
  Loot: ["Chest", "Urn", "Coin pile", "Strongbox"],
  Elite: ["War table", "Weapon rack", "Cage", "Braziers"],
  Boss: ["Throne", "Altar", "Braziers", "Trophies"],
  Rest: ["Campfire", "Bedrolls", "Supplies", "Water skin"],
  Shop: ["Counter", "Shelves", "Strongbox", "Crates"],
  Harvest: ["Gathering tools", "Baskets", "Vein", "Bloom"],
};

const NAME_OBJECTS = {
  "Flooded Cistern": ["Cistern", "Valve wheel", "Rusted chains"],
  "Forgotten Barracks": ["Bunk beds", "Weapon rack", "Footlockers"],
  "Fungal Conservatory": ["Fungal beds", "Spore jars", "Garden tools"],
  "Arcane Workshop": ["Workbenches", "Arcane circle", "Shelves"],
  "Crystal Grotto": ["Crystal clusters", "Mining picks", "Offering bowl"],
  "Bone Orchard": ["Bone trees", "Offering bowls", "Grave markers"],
  "Captain's Quarters": ["Bed", "Writing desk", "Sea chest"],
  "Hidden Spring": ["Spring pool", "Reeds", "Offering stones"],
  "Treasure Vault": ["Coin piles", "Chests", "Strongbox"],
  "Abandoned Strongroom": ["Empty chests", "Shelves", "Rubble"],
  "Armorer's Bolthole": ["Armor stands", "Workbench", "Tool rack"],
  "Alchemist's Nook": ["Shelves", "Cauldron", "Ingredient jars"],
  "Ancient Root": ["Root tangle", "Moss", "Carved stones"],
  "Sealed Treasury": ["Sealed chests", "Ledger", "Coin scales"],
  "Merchant Cache": ["Packed crates", "Ledger", "Scales"],
  "Gilded Ossuary": ["Sarcophagi", "Urns", "Candles"],
  "Reliquary of Coins": ["Reliquary", "Offering trays", "Coin piles"],
  "Gemstone Alcove": ["Gem clusters", "Cutting tools", "Padded cases"],
  "Smuggler's Hold": ["Contraband crates", "Rope", "Lantern"],
  "Offering Chamber": ["Offering altar", "Incense", "Bowls"],
  "Butcher's Floor": ["Hooks", "Tables", "Bone saw"],
  "Beast Pen": ["Straw", "Feeding trough", "Chains"],
  "Duelist's Ring": ["Dueling circle", "Weapon rack", "Sand buckets"],
  "Shadow Gallery": ["Dark drapes", "Pedestals", "Mirrors"],
  "Iron Colosseum": ["Spectator benches", "Weapon rack", "Sand"],
  "Chained Sanctum": ["Chains", "Altar", "Braziers"],
  "Ritual Chamber": ["Ritual circle", "Candles", "Offering table"],
  "War Council": ["War table", "Maps", "Chairs"],
  "Arcane Laboratory": ["Workbenches", "Specimen jars", "Arcane circle"],
  "Throne of Ash": ["Throne", "Ash braziers", "Banners"],
  "Drowned Court": ["Throne", "Pool", "Seaweed"],
  "Frozen Crown": ["Throne", "Ice pillars", "Frozen banners"],
  "Obsidian Choir": ["Choir stalls", "Obsidian altar", "Candles"],
  "Sunken Idol": ["Idol", "Pool", "Offerings"],
  "Crimson Reliquary": ["Reliquary", "Candles", "Blood basin"],
  "Storm Nexus": ["Conduits", "Braziers", "Conductive rods"],
  "Hollow Crown": ["Throne", "Broken crown", "Banners"],
  "Bonfire Camp": ["Bonfire", "Bedrolls", "Cooking pot"],
  "Safe Alcove": ["Bedroll", "Backpack", "Lantern"],
  "Quiet Shrine": ["Shrine", "Candles", "Offering bowl"],
  "Lantern Refuge": ["Lanterns", "Bedrolls", "Supplies"],
  "Warded Nook": ["Ward stones", "Bedroll", "Candles"],
  "Mushroom Rest": ["Glowcap beds", "Bedrolls", "Baskets"],
  "Sealed Camp": ["Sealed tent", "Supplies", "Brazier"],
  "Watchfire Post": ["Watchfire", "Weapon rack", "Stools"],
  "Pilgrim's Rest": ["Shrine", "Bedrolls", "Travel packs"],
};

const unique = (list) => [...new Set((list || []).filter(Boolean))];

function makeRoom(category, name, index) {
  const layout = LAYOUTS[index % LAYOUTS.length];
  const [min, max] = SIZE_BY_CATEGORY[category] || [9, 20];
  const span = Math.max(0, max - min);
  let w = min + ((index * 3) % (span + 1));
  let h = min + ((index * 5 + 2) % (span + 1));
  if (category === "Corridor") {
    w = Math.max(5, Math.min(7, min));
    h = min + ((index * 3) % (span + 1));
  } else if (category === "Boss" || category === "Elite") {
    w = Math.max(w, Math.round(max * 0.8));
    h = Math.max(h, Math.round(max * 0.8));
  }
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  const traps = category === "Trap" ? [TRAPS[index % TRAPS.length]] : [];
  if (category === "Trap" && index % 3 === 0) {
    traps.push(TRAPS[(index + 2) % TRAPS.length]);
  }
  const harvest = category === "Harvest" ? HARVEST[name] || ["Rare reagent"] : [];
  const objects = unique([
    ...(NAME_OBJECTS[name] || []),
    ...(OBJECTS_BY_CATEGORY[category] || []),
  ]).slice(0, 4);

  const coverPoints = [];
  const addCover = (x, y, cover) => {
    if (x >= 0 && y >= 0 && x < w && y < h) coverPoints.push({ x, y, cover });
  };
  if (/pillars/i.test(layout.cover)) {
    addCover(1, 1, "half");
    addCover(w - 2, 1, "half");
    addCover(1, h - 2, "half");
    addCover(w - 2, h - 2, "half");
  } else if (/crates/i.test(layout.cover)) {
    addCover(cx - 2, cy - 1, "half");
    addCover(cx + 2, cy + 1, "half");
    addCover(cx - 1, cy + 2, "half");
  } else if (/low wall/i.test(layout.cover)) {
    for (let x = Math.max(1, cx - 3); x <= Math.min(w - 2, cx + 3); x += 1) {
      addCover(x, cy, "threeQuarter");
    }
  } else if (/fog/i.test(layout.cover)) {
    addCover(cx, cy, "half");
  }

  const heights = [];
  if (/raised|tiered/i.test(layout.elevation)) {
    const height = /\+2/.test(layout.elevation) ? 2 : 1;
    heights.push({ x: cx, y: cy, height });
  }

  const water = [];
  const lava = [];
  const difficult = [];
  if (/Flooded|Cistern|Spring|Aqueduct|Weeping|Drowned|Sunken/.test(name)) {
    water.push([cx - 1, cy], [cx, cy], [cx - 1, cy + 1], [cx, cy + 1]);
  }
  if (/Volcanic|Ember|Flame|Forge|Lava/.test(name)) {
    lava.push([cx, cy], [cx + 1, cy]);
  }
  if (/Collapsed|Rubble|Fungal|Orchard|Grove|Broken|Root|Cavern|Irregular/.test(name)) {
    difficult.push([cx + 1, cy], [cx + 1, cy + 1]);
  }

  const trapPoints =
    category === "Trap"
      ? [
          { x: cx, y: cy, type: traps[0] || "Trap" },
          { x: Math.min(w - 2, cx + 2), y: Math.min(h - 2, cy + 2), type: traps[1] || traps[0] || "Trap" },
        ]
      : [];
  const hazardPoints =
    /Fog|Gloom|Unstable|Ash|Frozen|Storm|Crimson|Drowned/.test(name) ||
    category === "Trap"
      ? [{ x: cx, y: Math.max(1, cy - 2), type: /Fog/.test(name) ? "Fog (lightly obscured)" : ENV_BY_CATEGORY[category] || "Hazard" }]
      : [];
  const stairs = heights.length ? [{ x: Math.min(w - 2, cx + 1), y: cy }] : [];
  const ingressPoints =
    category === "Corridor" || category === "Rest" || category === "Shop"
      ? [{ x: 1, y: cy, label: "Entrance" }]
      : [{ x: 1, y: cy, label: "Entrance" }];
  const spawnPoints =
    category === "Elite" || category === "Boss" || category === "Trap"
      ? [{ x: cx, y: Math.max(1, cy - 2), label: category }]
      : [];

  const loot =
    category === "Loot"
      ? ["Rank-appropriate treasure cache"]
      : category === "Boss"
        ? ["Boss hoard"]
        : category === "Elite"
          ? ["Elite equipment"]
          : category === "Shop"
            ? ["Shop stock"]
            : [];

  const environmentEffect =
    water.length
      ? "Water is difficult terrain; deeper channels require swimming."
      : difficult.length
        ? "Broken ground: the marked cells are difficult terrain."
        : /Fog/.test(layout.cover)
          ? "Fog: lightly obscured beyond the room's centre."
          : index === 8
            ? "Unstable ground: difficult terrain in the marked half of the room."
            : index === 9
              ? "Unnatural gloom: lightly obscured beyond the room's center."
              : "";

  const floorType = /Fungal|Grove|Orchard|Spring|Harvest/.test(name)
    ? "grass"
    : /Drowned|Cistern|Flooded|Aqueduct/.test(name)
      ? "stone"
      : category === "Rest"
        ? "dirt"
        : category === "Shop"
          ? "wood"
          : category === "Boss"
            ? "marble"
            : category === "Corridor"
              ? "stone"
              : "stone";

  return {
    id: `starter-${slug(category)}-${slug(name)}`,
    name,
    category,
    w,
    h,
    minW: min,
    maxW: max,
    minH: min,
    maxH: max,
    shape: layout.shape,
    environment: ENV_BY_CATEGORY[category] || "Damp stone",
    elevation: layout.elevation,
    cover: layout.cover,
    connector: category === "Corridor" ? "Archway" : "Doorway",
    tags: [category, ...layout.tags, ...(harvest.length ? ["harvest"] : []), ...(objects.length ? ["furnished"] : [])],
    description: `${name} — a ${layout.shape.toLowerCase()} ${category.toLowerCase()} furnished with ${objects.slice(0, 3).join(", ")}.`,
    traps,
    spawns: [],
    loot,
    harvest,
    objects,
    coverPoints,
    heights,
    water,
    lava,
    difficult,
    trapPoints,
    hazardPoints,
    stairs,
    spawnPoints,
    ingressPoints,
    floorType,
    environmentEffect,
    notes: `${layout.tags.join(" · ")}. Furnishings: ${objects.join(", ")}.`,
    enabled: true,
    bonfire: category === "Rest" && index === 0,
    cr0Only: false,
    starterVersion: 2,
  };
}

export const STARTER_DUNGEON_ROOMS = Object.entries(CATEGORY_ROOMS).flatMap(
  ([category, names]) => names.map((name, index) => makeRoom(category, name, index))
);

export const STARTER_ROOM_IDS = new Set(STARTER_DUNGEON_ROOMS.map((r) => r.id));
