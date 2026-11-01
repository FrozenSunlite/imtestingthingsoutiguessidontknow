// Procedural dungeon generation: room templates, rank tables, seeded layouts
// for a single dungeon or a branching "spire" run.
import { STARTER_DUNGEON_ROOMS } from "@/lib/dungeonRooms";
import { rollEncounter } from "@/lib/dmLoot";

// crMin/crMax is the challenge band for bosses (and elite mini-bosses).
// Ordinary non-boss NPCs sit one or two CR below crMin.
export const DUNGEON_RANKS = {
  E: { label: "E", nickname: "Expie", rooms: 3, downtime: "2 weeks", level: "0–2", prof: 0, crMin: 0, crMax: 1, gold: [25, 100], loot: "Coins, mundane gear", color: "#94a3b8" },
  D: { label: "D", nickname: "Newk", rooms: 6, downtime: "3 weeks", level: "3–5", prof: 1, crMin: 2, crMax: 3, gold: [100, 500], loot: "Coins, gems, uncommon items", color: "#86efac" },
  C: { label: "C", nickname: "Rookie", rooms: 9, downtime: "4 weeks", level: "6–8", prof: 2, crMin: 4, crMax: 6, gold: [500, 2000], loot: "Gems, potions and scrolls, rare items", color: "#5eead4" },
  B: { label: "B", nickname: "Reg", rooms: 12, downtime: "5 weeks", level: "9–11", prof: 3, crMin: 7, crMax: 9, gold: [2000, 8000], loot: "Rare items, trade bars, gems", color: "#60a5fa" },
  A: { label: "A", nickname: "Prestige", rooms: 15, downtime: "6 weeks", level: "12–14", prof: 4, crMin: 10, crMax: 12, gold: [8000, 25000], loot: "Very rare items, art objects", color: "#a78bfa" },
  S: { label: "S", nickname: "Cavalry", rooms: 18, downtime: "7 weeks", level: "15–17", prof: 5, crMin: 13, crMax: 15, gold: [25000, 75000], loot: "Legendary items, treasures", color: "#f472b6" },
  SS: { label: "SS", nickname: "Hero", rooms: 21, downtime: "8 weeks", level: "18–20", prof: 6, crMin: 16, crMax: 18, gold: [75000, 200000], loot: "Legendary items, artifacts", color: "#fb923c" },
  SSS: { label: "SSS", nickname: "Mythos", rooms: 24, downtime: "9 weeks", level: "21+", prof: 7, crMin: 19, crMax: 30, gold: [200000, 500000], loot: "Artifacts and mythic relics", color: "#ef4444" },
};

// Boss CR range plus the lower band used by ordinary non-boss NPCs. Elite
// rooms are mini-boss fights and use the boss range.
export function rankChallenge(rank) {
  const info = DUNGEON_RANKS[rank] || DUNGEON_RANKS.E;
  const minCR = Math.max(0, Number(info.crMin) || 0);
  const maxCR = Math.max(minCR, Number(info.crMax) || minCR);
  return {
    rankCR: maxCR,
    minCR,
    maxCR,
    minionMin: Math.max(0, minCR - 2),
    minionMax: Math.max(0, minCR - 1),
  };
}

export const DUNGEON_CATEGORIES = [
  ["Start", "#22c55e"],
  ["Entrance", "#64748b"],
  ["Chamber", "#38bdf8"],
  ["Corridor", "#94a3b8"],
  ["Trap", "#f97316"],
  ["Puzzle", "#a78bfa"],
  ["Loot", "#facc15"],
  ["Elite", "#fb7185"],
  ["Boss", "#ef4444"],
  ["Rest", "#4ade80"],
  ["Shop", "#2dd4bf"],
  ["Harvest", "#22d3ee"],
];

export const DUNGEON_ENVIRONMENTS = [
  "Damp stone", "Ancient ruins", "Flooded cistern", "Fungal cavern", "Volcanic vents",
  "Frozen halls", "Shadowed crypt", "Overgrown temple", "Mine shafts", "Arcane laboratory",
];

// Encounters that earn a bonfire rest stop after every second one.
const ENCOUNTER_CATEGORIES = new Set(["Chamber", "Trap", "Puzzle", "Elite", "Boss"]);
const BOSS_THEMES = [
  "Ashen Throne", "Drowned Choir", "Iron Colossus", "Frostbound Crown",
  "Obsidian Gate", "Sunken Idol", "Crimson Reliquary",
];

const themedBoss = (room, index) =>
  index === 0
    ? room
    : { ...room, name: `${room.name} — ${BOSS_THEMES[(index - 1) % BOSS_THEMES.length]}` };

const NAME_ADJECTIVES = [
  "Sunken", "Ashen", "Whispering", "Broken", "Gilded", "Frozen", "Hollow",
  "Crimson", "Forgotten", "Umbral", "Shifting", "Iron", "Verdant", "Drowned",
  "Cinder", "Moonlit", "Shattered", "Silent", "Thorned", "Wandering",
];
const NAME_PLACES = [
  "Crypt", "Vault", "Warren", "Sanctum", "Labyrinth", "Catacomb", "Keep",
  "Reliquary", "Gallery", "Bastion", "Undercroft", "Mausoleum", "Foundry",
];
const NAME_SPIRE_PLACES = [
  "Spire", "Tower", "Ascent", "Pinnacle", "Citadel", "Ziggurat", "Needle",
];
const NAME_NOUNS = [
  "Echo", "Crown", "Serpent", "Lantern", "Tide", "Ember", "Oracle", "Warden",
  "Choir", "Colossus", "Requiem", "Root", "Mask", "Throne", "Idol", "Cinder",
];

// Seeded, readable procedural names. The name rng is separate from the layout
// rng so changing the naming tables never reshuffles an existing seed's rooms.
export function generateDungeonName(seed, mode = "single", rank = "E") {
  const rng = makeRng(`${mode}:${rank}:${seed}:name`);
  const place = rng.pick(mode === "spire" ? NAME_SPIRE_PLACES : NAME_PLACES);
  const adj = rng.pick(NAME_ADJECTIVES);
  const adj2 = rng.pick(NAME_ADJECTIVES.filter((word) => word !== adj));
  const noun = rng.pick(NAME_NOUNS);
  const theme = rng.pick(BOSS_THEMES);
  const patterns = [
    () => `The ${adj} ${place}`,
    () => `${adj} ${place} of the ${adj2} ${noun}`,
    () => `The ${place} of ${theme}`,
    () => `${place} of the ${noun}`,
    () => `The ${noun}'s ${place}`,
    () => `${adj} ${place} of the ${noun}`,
  ];
  return rng.pick(patterns)();
}

export const DUNGEON_TRAP_TYPES = [
  "Pressure plate",
  "Falling ceiling",
  "Spike pit",
  "Alarm rune",
  "Collapsing bridge",
  "Flame jet",
  "Poison mist",
];

const TRAP_POOL = [
  "Pressure plate: DC 8 + 2×rank Dexterity save or 1d6×rank piercing",
  "Falling ceiling: DC 8 + 2×rank Dexterity/Strength save or 1d6×rank bludgeoning",
  "Spike pit: DC 8 + 2×rank Dexterity save or 2d6×rank piercing",
  "Alarm rune: alerts the nearest room",
  "Collapsing bridge: DC 10 + rank Dexterity save or fall 2 spaces",
];

const ELEVATIONS = ["Flat", "Raised dais (+1)", "Sunken floor (−1)", "Tiered steps (+2)", "Chasm edge (−2)"];
const COVERS = ["Open", "Pillars (half cover)", "Crates (half cover)", "Low wall (three-quarters)", "Fog (lightly obscured)"];

export const DEFAULT_DUNGEON_ROOMS = [
  {
    id: "room-entrance",
    name: "Entrance Hall",
    category: "Entrance",
    minW: 4, maxW: 6, minH: 4, maxH: 6,
    environment: "Damp stone", elevation: "Flat", cover: "Pillars (half cover)",
    connector: "Doorway", traps: [], spawns: ["2 rank minions"], loot: [],
    notes: "A threshold room with a clear exit behind the party.",
  },
  {
    id: "room-guard",
    name: "Guard Post",
    category: "Chamber",
    minW: 3, maxW: 5, minH: 3, maxH: 5,
    environment: "Ancient ruins", elevation: "Flat", cover: "Crates (half cover)",
    connector: "Doorway", traps: [], spawns: ["2–3 rank minions"], loot: ["1d4 mundane items"],
    notes: "A small forward post with a warning bell.",
  },
  {
    id: "room-pillared",
    name: "Pillared Hall",
    category: "Chamber",
    minW: 6, maxW: 9, minH: 4, maxH: 6,
    environment: "Damp stone", elevation: "Raised dais (+1)", cover: "Pillars (half cover)",
    connector: "Archway", traps: [], spawns: ["1–2 rank minions"], loot: [],
    notes: "Columns break line of sight and provide cover.",
  },
  {
    id: "room-collapsed",
    name: "Collapsed Gallery",
    category: "Chamber",
    minW: 5, maxW: 8, minH: 4, maxH: 6,
    environment: "Ancient ruins", elevation: "Sunken floor (−1)", cover: "Low wall (three-quarters)",
    connector: "Rubble passage", traps: ["Unstable ceiling: DC 10 + rank Dexterity save or 1d6×rank bludgeoning"],
    spawns: ["1 rank minion"], loot: ["Buried cache: 1 rank loot roll"],
    notes: "Rubble creates difficult terrain and hidden gaps.",
  },
  {
    id: "room-corridor",
    name: "Narrow Passage",
    category: "Corridor",
    minW: 3, maxW: 5, minH: 2, maxH: 2,
    environment: "Mine shafts", elevation: "Flat", cover: "Open",
    connector: "Doorway", traps: [], spawns: [], loot: [],
    notes: "A tight connector; one defender can hold the line.",
  },
  {
    id: "room-trap-corridor",
    name: "Trapped Corridor",
    category: "Trap",
    minW: 3, maxW: 5, minH: 2, maxH: 2,
    environment: "Ancient ruins", elevation: "Flat", cover: "Open",
    connector: "Doorway", traps: ["Pressure plate: DC 8 + 2×rank Dexterity save or 1d6×rank piercing"],
    spawns: [], loot: ["Concealed maintenance cache"],
    notes: "A visible mechanism gives an observant party a chance to disarm it.",
  },
  {
    id: "room-puzzle",
    name: "Sealed Vault",
    category: "Puzzle",
    minW: 4, maxW: 6, minH: 4, maxH: 6,
    environment: "Arcane laboratory", elevation: "Flat", cover: "Pillars (half cover)",
    connector: "Rune-sealed door", traps: ["Arcane backlash: DC 10 + 2×rank Arcana or 2d6×rank force"],
    spawns: [], loot: ["Puzzle reward: 1 rank loot roll"],
    notes: "A riddle, sequence or offering opens the way forward.",
  },
  {
    id: "room-loot",
    name: "Treasure Vault",
    category: "Loot",
    minW: 3, maxW: 5, minH: 3, maxH: 4,
    environment: "Shadowed crypt", elevation: "Raised dais (+1)", cover: "Crates (half cover)",
    connector: "Doorway", traps: ["Glyph of warding: DC 10 + 2×rank Dexterity save or 2d6×rank fire"],
    spawns: [], loot: ["1d4 rank loot rolls"],
    notes: "The reward for a side branch or a locked door.",
  },
  {
    id: "room-rest",
    name: "Safe Alcove",
    category: "Rest",
    minW: 2, maxW: 3, minH: 2, maxH: 3,
    environment: "Damp stone", elevation: "Flat", cover: "Low wall (three-quarters)",
    connector: "Doorway", traps: [], spawns: [], loot: ["1 short-rest supply cache"],
    notes: "A defensible nook; the party can take a short rest here.",
  },
  {
    id: "room-shop",
    name: "Hidden Cache",
    category: "Shop",
    minW: 3, maxW: 4, minH: 2, maxH: 3,
    environment: "Ancient ruins", elevation: "Flat", cover: "Crates (half cover)",
    connector: "Doorway", traps: [], spawns: ["1 neutral merchant"], loot: ["Shop stock: 1d4 rank items at 2× cost"],
    notes: "A wandering merchant or a automated vendor with limited stock.",
  },
  {
    id: "room-elite",
    name: "Ritual Chamber",
    category: "Elite",
    minW: 5, maxW: 8, minH: 5, maxH: 7,
    environment: "Arcane laboratory", elevation: "Raised dais (+1)", cover: "Pillars (half cover)",
    connector: "Archway", traps: ["Summoning circle: DC 12 + rank Arcana or 1 elite reinforcement"],
    spawns: ["1 elite + 2 rank minions"], loot: ["1d4 rank loot rolls"],
    notes: "A lieutenant or mini-boss holds this room.",
  },
  {
    id: "room-boss",
    name: "Boss Sanctum",
    category: "Boss",
    minW: 8, maxW: 10, minH: 7, maxH: 9,
    environment: "Volcanic vents", elevation: "Tiered steps (+2)", cover: "Low wall (three-quarters)",
    connector: "Gate", traps: ["Arena hazard: 1d6×rank damage at the end of each round in the marked zone"],
    spawns: ["1 boss + 2–4 rank minions"], loot: ["Boss cache: 2 rank loot rolls"],
    notes: "A large chamber with room to move, cover and a lair action.",
  },
  {
    id: "room-flooded",
    name: "Flooded Cistern",
    category: "Chamber",
    minW: 5, maxW: 8, minH: 4, maxH: 6,
    environment: "Flooded cistern", elevation: "Sunken floor (−1)", cover: "Fog (lightly obscured)",
    connector: "Bridge", traps: ["Slippery ledge: DC 10 + rank Acrobatics or fall 1 space"],
    spawns: ["1–2 rank minions"], loot: ["1 rank loot roll"],
    notes: "Shallow water is difficult terrain; deeper channels are hazards.",
  },
  {
    id: "room-fungal",
    name: "Fungal Grotto",
    category: "Chamber",
    minW: 5, maxW: 7, minH: 4, maxH: 6,
    environment: "Fungal cavern", elevation: "Flat", cover: "Fog (lightly obscured)",
    connector: "Rubble passage", traps: ["Spore burst: DC 10 + rank Constitution or poisoned"],
    spawns: ["1–3 rank minions"], loot: ["1 rank loot roll"],
    notes: "Spore clouds and soft ground make this room unpredictable.",
  },
  {
    id: "room-frozen",
    name: "Frozen Hall",
    category: "Chamber",
    minW: 5, maxW: 8, minH: 3, maxH: 5,
    environment: "Frozen halls", elevation: "Flat", cover: "Pillars (half cover)",
    connector: "Doorway", traps: ["Ice patch: DC 10 + rank Acrobatics or prone"],
    spawns: ["1–2 rank minions"], loot: [],
    notes: "Slick floors and brittle pillars reward careful movement.",
  },
  {
    id: "room-shadow",
    name: "Shadow Gallery",
    category: "Elite",
    minW: 4, maxW: 7, minH: 4, maxH: 6,
    environment: "Shadowed crypt", elevation: "Flat", cover: "Fog (lightly obscured)",
    connector: "Archway", traps: [], spawns: ["1 elite + 1 rank minion"], loot: ["1 rank loot roll"],
    notes: "Dim light and hiding spots favour stealthy enemies.",
  },
  {
    id: "room-spike",
    name: "Spike Pit",
    category: "Trap",
    minW: 3, maxW: 4, minH: 3, maxH: 4,
    environment: "Mine shafts", elevation: "Sunken floor (−1)", cover: "Open",
    connector: "Doorway", traps: ["Spike pit: DC 8 + 2×rank Dexterity save or 2d6×rank piercing"],
    spawns: [], loot: ["1 rank loot roll at the bottom"],
    notes: "A visible pit with a narrow rim and a reward below.",
  },
  {
    id: "room-animal-den",
    name: "Animal Den",
    category: "Chamber",
    minW: 5, maxW: 8, minH: 4, maxH: 6,
    environment: "Fungal cavern", elevation: "Flat", cover: "Fog (lightly obscured)",
    connector: "Rubble passage", traps: [], spawns: ["CR 0 animals"], loot: ["1 natural treasure roll"],
    notes: "A CR 0-only den: beasts and swarms, not soldiers.",
    cr0Only: true,
  },
  {
    id: "room-bridge",
    name: "Broken Bridge",
    category: "Corridor",
    minW: 4, maxW: 6, minH: 2, maxH: 3,
    environment: "Volcanic vents", elevation: "Chasm edge (−2)", cover: "Open",
    connector: "Bridge", traps: ["Collapsing section: DC 10 + rank Dexterity or fall 2 spaces"],
    spawns: [], loot: [],
    notes: "A gap to cross under pressure; flight, ropes and jumps shine.",
  },
  {
    id: "room-mine",
    name: "Abandoned Shaft",
    category: "Corridor",
    minW: 3, maxW: 5, minH: 2, maxH: 3,
    environment: "Mine shafts", elevation: "Tiered steps (+2)", cover: "Low wall (three-quarters)",
    connector: "Stairs", traps: ["Loose support: DC 10 + rank Dexterity or 1d6×rank bludgeoning"],
    spawns: [], loot: ["Raw ore: 1 rank loot roll"],
    notes: "Old supports and a vertical shortcut between levels.",
  },
  {
    id: "room-crystal-vein",
    name: "Crystal Vein",
    category: "Harvest",
    minW: 3, maxW: 5, minH: 3, maxH: 5,
    environment: "Fungal cavern", elevation: "Flat", cover: "Pillars (half cover)",
    connector: "Side passage", traps: [], spawns: [], loot: [],
    harvest: ["Glow crystal", "Mana crystal", "Resonance shard"],
    notes:
      "Non-combat side chamber. Harvest crystals with an Arcana or Mining check; the vein can be tapped once per delve.",
  },
  {
    id: "room-herb-grove",
    name: "Herb Grove",
    category: "Harvest",
    minW: 3, maxW: 5, minH: 3, maxH: 5,
    environment: "Overgrown temple", elevation: "Flat", cover: "Fog (lightly obscured)",
    connector: "Side passage", traps: [], spawns: [], loot: [],
    harvest: ["Silverleaf", "Bloodroot", "Sunpetal"],
    notes:
      "Non-combat side chamber. A Nature or Herbalism check yields rare reagents for potions and salves.",
  },
  {
    id: "room-ore-seam",
    name: "Ore Seam",
    category: "Harvest",
    minW: 3, maxW: 5, minH: 2, maxH: 4,
    environment: "Mine shafts", elevation: "Sunken floor (−1)", cover: "Low wall (three-quarters)",
    connector: "Side passage", traps: [], spawns: [], loot: [],
    harvest: ["Iron ore", "Silver ore", "Mithral fragment"],
    notes:
      "Non-combat side chamber. Mining checks produce crafting materials; a rich seam may need several trips.",
  },
  {
    id: "room-bonfire",
    name: "Bonfire Camp",
    category: "Rest",
    minW: 4, maxW: 5, minH: 4, maxH: 5,
    environment: "Sheltered alcove", elevation: "Flat", cover: "Low wall (three-quarters)",
    connector: "Doorway", traps: [], spawns: [], loot: [],
    shape: "Rectangle",
    bonfire: true,
    notes:
      "A safe campfire with a clear exit. The party can take a short rest here before pushing deeper.",
  },
];

function hashSeed(seed) {
  let h = 2166136261;
  const s = String(seed || "dungeon");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randomSeed() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function makeRng(seed) {
  let a = hashSeed(seed);
  const rand = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    rand,
    int: (min, max) => min + Math.floor(rand() * (max - min + 1)),
    pick: (arr) => (arr?.length ? arr[Math.floor(rand() * arr.length)] : ""),
    chance: (p) => rand() < p,
    shuffle: (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}

const uid = (prefix = "d") =>
  `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

function templateFor(category, templates, rng) {
  const pool = templates.filter((r) => r.category === category);
  if (pool.length) return rng.pick(pool);
  return templates.length ? rng.pick(templates) : STARTER_DUNGEON_ROOMS[0];
}

function instantiate(template, category, rng, rank, { monsters: _monsters, lootPools, players = 4 }) {
  const sizeScale = Math.max(0.85, Math.min(1.35, 1 + (Math.max(1, Number(players) || 4) - 4) * 0.06));
  const w = Math.max(
    9,
    Math.min(
      33,
      Math.round(
        rng.int(template.minW || 9, Math.max(template.minW || 9, template.maxW || template.minW || 9)) *
          sizeScale
      )
    )
  );
  const h = Math.max(
    9,
    Math.min(
      33,
      Math.round(
        rng.int(template.minH || 9, Math.max(template.minH || 9, template.maxH || template.minH || 9)) *
          sizeScale
      )
    )
  );
  const traps = [...(template.traps || [])];
  if (!traps.length && (category === "Trap" || rng.chance(0.18)))
    traps.push(rng.pick(TRAP_POOL));
  const spawns = [...(template.spawns || [])];
  const loot = [...(template.loot || [])];
  if (!loot.length && (category === "Loot" || rng.chance(0.22))) {
    const pools = (lootPools || []).map((p) => p.name).filter(Boolean);
    loot.push(pools.length ? `${rng.pick(pools)} (1 roll)` : `1 rank ${rank} loot roll`);
  }
  const shape = template.cells?.length
    ? template.shape || "Custom"
    : template.shape && template.shape !== "Rectangle"
      ? template.shape
      : pickRoomShape(category, rng);
  const cells = template.cells?.length
    ? template.cells.map(([cx, cy]) => [cx, cy])
    : shapeCells(w, h, shape);
  const environment = template.environment || rng.pick(DUNGEON_ENVIRONMENTS);
  const elevation = template.elevation || rng.pick(ELEVATIONS);
  const cover = template.cover || rng.pick(COVERS);
  const surface = roomSurfaceFeatures(
    { ...template, environment, elevation, cover, traps },
    cells,
    rng
  );
  return {
    id: uid("room"),
    templateId: template.id,
    name: template.name || `${category} ${rng.int(1, 9)}`,
    floor: 0,
    category,
    x: 0,
    y: 0,
    w,
    h,
    environment,
    elevation,
    cover,
    connector: template.connector || "Doorway",
    externalDoor:
      category === "Entrance" || category === "Start" || !!template.externalDoor,
    shape,
    cells,
    heights: surface.heights,
    stairs: surface.stairs,
    coverPoints: surface.coverPoints,
    trapPoints: surface.trapPoints,
    water: surface.water,
    lava: surface.lava || [],
    bridges: surface.bridges || [],
    hazardPoints: surface.hazardPoints || [],
    liquidStart: surface.liquidStart || null,
    liquidEnds: surface.liquidEnds || [],
    difficult: surface.difficult,
    environmentEffect: template.environmentEffect || "",
    floorType: template.floorType || "stone",
    floorTextureUrl: template.floorTextureUrl || "",
    tags: [...(template.tags || [])],
    description: template.description || "",
    ingressPoints: template.ingressPoints?.length
      ? template.ingressPoints.map((p) => ({ ...p }))
      : defaultIngress(cells),
    spawnPoints: template.spawnPoints?.length
      ? template.spawnPoints.map((p) => ({ ...p }))
      : defaultSpawns(cells, spawns.length),
    traps,
    spawns,
    loot,
    harvest: [...(template.harvest || [])],
    objects: [...(template.objects || [])],
    side: !!template.side,
    notes: template.notes || "",
    cr0Only: !!template.cr0Only,
    bonfire: !!template.bonfire,
  };
}

const link = (from, to, type = "Doorway", floor = 0) => ({
  id: `${from}->${to}`,
  from,
  to,
  type,
  floor: Number(floor) || 0,
  door: true,
});

// Give each connection concrete door points taken from the ingress zones of
// the two rooms, so a map can draw its doorways rather than only a centre line.
const attachDoorPoints = (rooms, connections) => {
  const byId = new Map((rooms || []).map((room) => [room.id, room]));
  return (connections || []).map((connection) => {
    const from = byId.get(connection.from);
    const to = byId.get(connection.to);
    if (!from || !to) return connection;
    const fromPoint = from.ingressPoints?.[0] || { x: 0, y: 0 };
    const toPoint = to.ingressPoints?.[0] || { x: 0, y: 0 };
    return {
      ...connection,
      doorFrom: { x: Number(fromPoint.x) || 0, y: Number(fromPoint.y) || 0 },
      doorTo: { x: Number(toPoint.x) || 0, y: Number(toPoint.y) || 0 },
    };
  });
};

function makeMissionStart() {
  const w = 4;
  const h = 4;
  const cells = rectCells(w, h);
  return {
    id: uid("room"),
    templateId: "room-mission-start",
    name: "Mission Start",
    floor: 0,
    category: "Start",
    x: 0,
    y: 0,
    w,
    h,
    shape: "Rectangle",
    cells,
    ingressPoints: [{ x: 0, y: 1, label: "Player ingress" }],
    spawnPoints: [],
    environment: "Staging point",
    elevation: "Flat",
    cover: "Open",
    connector: "Trail",
    externalDoor: true,
    traps: [],
    spawns: [],
    loot: [],
    notes:
      "The party begins here. Choose a route from this staging point; arrows mark the way deeper into the run.",
  };
}

function makeBonfire(rng) {
  const w = rng?.int(4, 5) || 4;
  const h = rng?.int(4, 5) || 4;
  const cells = rectCells(w, h);
  return {
    id: uid("room"),
    templateId: "room-bonfire",
    name: "Bonfire Safe Zone",
    floor: 0,
    category: "Rest",
    x: 0,
    y: 0,
    w,
    h,
    shape: "Rectangle",
    cells,
    ingressPoints: defaultIngress(cells),
    spawnPoints: [],
    environment: "Sheltered alcove",
    elevation: "Flat",
    cover: "Low wall (three-quarters)",
    connector: "Doorway",
    traps: [],
    spawns: [],
    loot: [],
    bonfire: true,
    notes:
      "A safe campfire with a clear exit. The party can take a short rest here before pushing deeper.",
  };
}

function insertBonfires(spine, rng) {
  const out = [];
  let encounters = 0;
  spine.forEach((room, i) => {
    out.push(room);
    if (ENCOUNTER_CATEGORIES.has(room.category)) encounters += 1;
    const last = i === spine.length - 1;
    // Never place a camp after the final room, after a boss, or at the end of
    // the run. The boss sanctum must always be the last thing on the path.
    if (encounters >= 2 && !last && room.category !== "Boss") {
      out.push(makeBonfire(rng));
      encounters = 0;
    }
  });
  while (out.length && out[out.length - 1]?.bonfire) out.pop();
  // A guaranteed short rest immediately before the final boss. Alternate
  // bosses branch from this same camp, so every route gets the rest.
  const last = out[out.length - 1];
  const previous = out[out.length - 2];
  if (
    last?.category === "Boss" &&
    previous &&
    previous.category !== "Rest" &&
    !previous.bonfire
  ) {
    out.splice(out.length - 1, 0, makeBonfire(rng));
  }
  return out;
}

function positionSingle(rooms, rng) {
  const spine = rooms.filter((r) => !r.branch);
  let cursor = 0;
  spine.forEach((room) => {
    room.x = cursor;
    room.y = rng.int(-1, 1);
    cursor += Math.max(12, room.w) + 34;
  });
  rooms.filter((r) => r.branch).forEach((room, index) => {
    const parent = rooms.find((r) => r.id === room.parentId) || spine[0];
    room.x =
      (parent?.x || 0) +
      Math.max(0, ((parent?.w || room.w || 9) - (room.w || 9)) / 2);
    room.y =
      (parent?.y || 0) +
      Math.max(12, parent?.h || 12) +
      26 +
      index * (Math.max(12, room.h || 12) + 22);
  });
  // Final no-overlap pass: nudge rooms downward until every footprint is free.
  // Halls are generated after this, so connectors follow the resolved layout.
  const placed = [];
  const clashes = (a, b) =>
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y;
  rooms.forEach((room) => {
    let guard = 0;
    while (placed.some((other) => clashes(room, other)) && guard < 200) {
      room.y += 14;
      guard += 1;
    }
    placed.push({ x: room.x, y: room.y, w: room.w, h: room.h });
  });
}

export const HALL_TYPES = [
  { name: "Hallway", elevation: "Flat", environment: "Damp stone" },
  { name: "Stairwell", elevation: "Tiered steps (+2)", environment: "Ancient ruins" },
  { name: "Elevator Shaft", elevation: "Raised dais (+1)", environment: "Mine shafts" },
  { name: "Bridge", elevation: "Chasm edge (−2)", environment: "Collapsed bridge" },
  { name: "Collapsed Passage", elevation: "Sunken floor (−1)", environment: "Collapsed gallery" },
];

function makeHall(rng, dx, dy) {
  const kind = rng.pick(HALL_TYPES);
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const w = horizontal
    ? Math.max(9, Math.min(16, Math.round(Math.abs(dx) / 2)))
    : Math.max(3, Math.min(9, Math.round(Math.abs(dx) / 2) + 1));
  const h = horizontal
    ? 3
    : Math.max(9, Math.min(16, Math.round(Math.abs(dy) / 2)));
  let cells = rectCells(w, h);
  if (!horizontal && w > 3) {
    // Add a short horizontal arm at one end so the hall bends toward the room.
    for (let x = 3; x < w; x += 1) {
      for (let y = h - 3; y < h; y += 1) cells.push([x, y]);
    }
  }
  const traps = rng.chance(0.25) ? [rng.pick(TRAP_POOL)] : [];
  const stairs =
    kind.name === "Stairwell" || kind.name === "Elevator Shaft"
      ? [
          { x: 0, y: Math.max(0, Math.floor(h / 2)) },
          { x: Math.max(0, w - 1), y: Math.max(0, Math.floor(h / 2)) },
        ]
      : [];
  return {
    id: uid("hall"),
    templateId: `hall-${kind.name.toLowerCase().replace(/\s+/g, "-")}`,
    name: kind.name,
    floor: 0,
    category: "Corridor",
    hall: true,
    combat: false,
    side: false,
    branch: false,
    x: 0,
    y: 0,
    w,
    h,
    shape: horizontal ? "Rectangle" : "L-Shape",
    cells,
    environment: kind.environment,
    elevation: kind.elevation,
    cover: "Open",
    connector: kind.name,
    tags: ["hall", kind.name.toLowerCase()],
    description: `${kind.name} connecting two chambers. Monsters do not lair here, but the passage can be trapped or blocked.`,
    traps,
    spawns: [],
    spawnPoints: [],
    loot: [],
    harvest: [],
    stairs,
    ingressPoints: defaultIngress(cells),
    environmentEffect: "",
    notes: `${kind.name}: free of monster encounters; traps and hazards are possible.`,
  };
}

// Insert corridor / stair / elevator rooms between chambers. Spire runs keep
// their existing floor layout; this is the single-dungeon connective tissue.
function insertHalls(rooms, connections, rng) {
  const halls = [];
  const next = [];
  (connections || []).forEach((connection) => {
    const from = rooms.find((r) => r.id === connection.from);
    const to = rooms.find((r) => r.id === connection.to);
    if (!from || !to) {
      next.push(connection);
      return;
    }
    if (
      from.side ||
      to.side ||
      from.hall ||
      to.hall ||
      from.bonfire ||
      to.bonfire ||
      from.category === "Boss" ||
      to.category === "Boss" ||
      from.category === "Start" ||
      to.category === "Start"
    ) {
      next.push(connection);
      return;
    }
    const dx = to.x + to.w / 2 - (from.x + from.w / 2);
    const dy = to.y + to.h / 2 - (from.y + from.h / 2);
    if (Math.abs(dx) + Math.abs(dy) < 18) {
      next.push(connection);
      return;
    }
    // Diagonal gaps need a bent connector; leave those as direct links so a
    // rectangular hall is never dropped across a room.
    if (Math.abs(dx) > 14 && Math.abs(dy) > 14) {
      next.push(connection);
      return;
    }
    const hall = makeHall(rng, dx, dy);
    hall.x = from.x + from.w / 2 + dx / 2 - hall.w / 2;
    hall.y = from.y + from.h / 2 + dy / 2 - hall.h / 2;
    // Snap the hall to the shared axis so the connection line runs through it.
    if (Math.abs(dx) >= Math.abs(dy)) hall.y = (from.y + from.h / 2 + to.y + to.h / 2) / 2 - hall.h / 2;
    else hall.x = (from.x + from.w / 2 + to.x + to.w / 2) / 2 - hall.w / 2;
    halls.push(hall);
    next.push(link(from.id, hall.id, hall.connector, from.floor || 0));
    next.push(link(hall.id, to.id, connection.type || "Doorway", from.floor || 0));
  });
  return { halls, connections: next };
}

export function buildRoutes(rooms, connections) {
  const start = rooms.find((r) => r.category === "Start") || rooms[0];
  const bosses = rooms.filter((r) => r.category === "Boss");
  if (!start || !bosses.length) return [];
  const outgoing = new Map();
  (connections || []).forEach((c) => {
    if (!outgoing.has(c.from)) outgoing.set(c.from, []);
    outgoing.get(c.from).push(c);
  });
  const routes = [];
  bosses.forEach((boss, index) => {
    const queue = [start.id];
    const prev = new Map([[start.id, null]]);
    while (queue.length) {
      const id = queue.shift();
      if (id === boss.id) break;
      (outgoing.get(id) || []).forEach((c) => {
        if (prev.has(c.to)) return;
        prev.set(c.to, { from: id, connection: c.id });
        queue.push(c.to);
      });
    }
    if (!prev.has(boss.id)) return;
    const roomIds = [];
    const connectionIds = [];
    let cur = boss.id;
    while (cur != null) {
      roomIds.unshift(cur);
      const step = prev.get(cur);
      if (step?.connection) connectionIds.unshift(step.connection);
      cur = step?.from ?? null;
    }
    routes.push({
      id: `route-${index}`,
      name: boss.name || `Boss route ${index + 1}`,
      bossId: boss.id,
      roomIds,
      connectionIds,
    });
  });
  return routes;
}

// Keep at most two exterior doors. The start/entrance rooms get priority; any
// extra external door is closed so generated dungeons do not leak the surface.
function limitExternalDoors(rooms) {
  const external = (rooms || []).filter((room) => room.externalDoor);
  if (external.length <= 2) return rooms;
  const priority = [...external].sort((a, b) => {
    const score = (room) =>
      room.category === "Start" ? 2 : room.category === "Entrance" ? 1 : 0;
    return score(b) - score(a);
  });
  const keep = new Set(priority.slice(0, 2).map((room) => room.id));
  return rooms.map((room) =>
    room.externalDoor && !keep.has(room.id) ? { ...room, externalDoor: false } : room
  );
}

export function generateDungeon({
  mode = "single",
  rank = "E",
  seed = randomSeed(),
  templates = STARTER_DUNGEON_ROOMS,
  monsters = [],
  lootPools = [],
  name = "",
  players = 4,
  requiredTags = [],
  avoidCategories = [],
} = {}) {
  const rng = makeRng(`${mode}:${rank}:${seed}`);
  const info = DUNGEON_RANKS[rank] || DUNGEON_RANKS.E;
  const rankIndex = Math.max(0, Object.keys(DUNGEON_RANKS).indexOf(rank));
  const baseTemplates = (templates || []).length ? templates : STARTER_DUNGEON_ROOMS;
  const wantedTags = (requiredTags || []).map((t) => String(t).toLowerCase().trim()).filter(Boolean);
  const avoided = new Set((avoidCategories || []).map((c) => String(c).toLowerCase()));
  let source = baseTemplates.filter((template) => {
    if (avoided.has(String(template.category || "").toLowerCase())) return false;
    if (!wantedTags.length) return true;
    const haystack = `${template.name || ""} ${template.category || ""} ${(template.tags || []).join(" ")} ${template.environment || ""}`.toLowerCase();
    return wantedTags.some((tag) => haystack.includes(tag));
  });
  if (!source.length) source = baseTemplates;
  const rooms = [];
  const connections = [];
  const total = Math.max(
    3,
    Math.min(48, info.rooms * (mode === "single" ? 2 : 1))
  );
  const opts = { monsters, lootPools, players };
  let title = name || generateDungeonName(seed, mode, rank);

  if (mode === "spire") {
    const floors = 15;
    const start = makeMissionStart();
    start.x = -40;
    start.y = 0;
    rooms.push(start);
    let previous = [start];
    let encounterFloors = 0;
    for (let f = 1; f < floors; f++) {
      const last = f === floors - 1;
      const bossCount = rankIndex >= 4 ? 3 : rankIndex >= 2 ? 2 : 1;
      const count = last ? bossCount : rng.int(1, 3);
      const current = [];
      for (let lane = 0; lane < count; lane++) {
        let category = "Chamber";
        if (last) category = "Boss";
        else if (f === 4 || f === 9) category = "Elite";
        else if (f === 5 || f === 10) category = "Rest";
        else if (f === 3 || f === 8) category = "Shop";
        else if (rng.chance(0.16)) category = rng.pick(["Trap", "Puzzle", "Loot"]);
        let room = instantiate(templateFor(category, source, rng), category, rng, rank, opts);
        if (last) room = themedBoss(room, lane);
        room.floor = f;
        room.x = f * 52;
        room.y = (lane - (count - 1) / 2) * 42 + (last ? 0 : rng.int(-2, 2));
        current.push(room);
        rooms.push(room);
      }
      // Every previous node connects to one or two nearest nodes on this floor.
      previous.forEach((p) => {
        const nearest = [...current].sort(
          (a, b) => Math.abs(a.y - p.y) - Math.abs(b.y - p.y)
        );
        connections.push(link(p.id, nearest[0].id, p.connector, f));
        if (nearest[1] && rng.chance(0.35))
          connections.push(link(p.id, nearest[1].id, p.connector, f));
      });
      // Make sure every node on this floor has an entrance.
      current.forEach((c) => {
        if (!connections.some((e) => e.to === c.id)) {
          const p = [...previous].sort(
            (a, b) => Math.abs(a.y - c.y) - Math.abs(b.y - c.y)
          )[0];
          if (p) connections.push(link(p.id, c.id, p.connector, f));
        }
      });
      previous = current;
      const restFloor = current.every((r) => ["Rest", "Shop"].includes(r.category));
      if (!restFloor && !last) encounterFloors += 1;
      const beforeFinal = f === floors - 2;
      // A bonfire landing after every two encounter floors, plus one guaranteed
      // immediately before the final boss floor. All paths from the previous
      // floor converge here, then descend to the next floor.
      if (
        !last &&
        (beforeFinal || encounterFloors >= 2) &&
        !current.some((r) => r.category === "Boss")
      ) {
        const camp = makeBonfire(rng);
        camp.floor = f;
        camp.x = f * 52 + 36;
        camp.y = 0;
        rooms.push(camp);
        current.forEach((room) => connections.push(link(room.id, camp.id, room.connector, f)));
        previous = [camp];
        encounterFloors = 0;
      }
    }
  } else {
    const branchCount = total >= 9 ? 2 : total >= 6 ? 1 : 0;
    const spineCount = Math.max(2, total - branchCount);
    const categories = ["Start"];
    for (let i = 0; i < spineCount - 1; i++) {
      let cat = "Chamber";
      if (i === 0 && spineCount >= 6) cat = "Elite";
      else if (i === 1 && spineCount >= 9) cat = "Rest";
      else if (i === 2 && spineCount >= 9) cat = "Shop";
      else if (rng.chance(0.18)) cat = "Trap";
      else if (rng.chance(0.14)) cat = "Puzzle";
      else if (rng.chance(0.2)) cat = "Loot";
      categories.push(cat);
    }
    categories.push("Boss");
    const spine = categories.map((cat) => {
      const room =
        cat === "Start"
          ? makeMissionStart()
          : instantiate(templateFor(cat, source, rng), cat, rng, rank, opts);
      room.branch = false;
      rooms.push(room);
      return room;
    });
    for (let i = 0; i < spine.length - 1; i++)
      connections.push(link(spine[i].id, spine[i + 1].id, spine[i].connector));
    for (let b = 0; b < branchCount; b++) {
      const parent = spine[Math.min(spine.length - 2, 2 + b * 2)];
      const cat = rng.pick(["Loot", "Trap", "Chamber", "Puzzle"]);
      const room = instantiate(templateFor(cat, source, rng), cat, rng, rank, opts);
      room.branch = true;
      room.parentId = parent.id;
      rooms.push(room);
      connections.push(link(parent.id, room.id, parent.connector));
    }
    // Insert a bonfire safe zone after every two encounters along the main
    // spine. Branch connections stay attached to their original parent.
    const expandedSpine = insertBonfires(spine, rng);
    if (expandedSpine.length > spine.length) {
      const spineIds = new Set(spine.map((r) => r.id));
      const branchLinks = connections.filter(
        (c) => !(spineIds.has(c.from) && spineIds.has(c.to))
      );
      connections.length = 0;
      connections.push(...branchLinks);
      for (let i = 0; i < expandedSpine.length - 1; i += 1) {
        connections.push(
          link(expandedSpine[i].id, expandedSpine[i + 1].id, expandedSpine[i].connector)
        );
      }
      // Rebuild the room order so bonfires appear between their neighbouring
      // rooms and the boss remains the final room of the run.
      const branchRooms = rooms.filter((r) => r.branch);
      rooms.length = 0;
      rooms.push(...expandedSpine, ...branchRooms);
    }
    // Higher ranks expose alternate final bosses as route choices. Each
    // alternate branch gets its own pre-boss safe camp so no route shares the
    // main camp; the fork happens one node before the main camp.
    const altCount = rankIndex >= 4 ? 2 : rankIndex >= 2 ? 1 : 0;
    const mainBoss = expandedSpine[expandedSpine.length - 1];
    const mainCamp = expandedSpine[expandedSpine.length - 2];
    const forkPoint = mainCamp?.bonfire
      ? expandedSpine[expandedSpine.length - 3] || mainCamp
      : mainCamp;
    const alternateRoutes = [];
    if (altCount && forkPoint && mainBoss) {
      for (let i = 0; i < altCount; i += 1) {
        const camp = makeBonfire(rng);
        camp.name = `Bonfire Safe Zone ${i + 2}`;
        camp.branch = true;
        camp.parentId = forkPoint.id;
        const alt = themedBoss(
          instantiate(templateFor("Boss", source, rng), "Boss", rng, rank, opts),
          i + 1
        );
        alt.branch = true;
        alt.parentId = camp.id;
        rooms.push(camp, alt);
        connections.push(link(forkPoint.id, camp.id, forkPoint.connector));
        connections.push(link(camp.id, alt.id, camp.connector));
        alternateRoutes.push({ camp, boss: alt });
      }
    }
    positionSingle(rooms, rng);
    // Fan the alternate boss routes out below the fork so they read as
    // separate paths rather than stacked rooms.
    alternateRoutes.forEach(({ camp, boss }, i) => {
      const maxX = Math.max(0, ...rooms.map((room) => room.x + room.w));
      boss.x = maxX + 30 + i * (Math.max(boss.w, 14) + 18);
      boss.y = 0;
      camp.x = boss.x;
      camp.y = boss.y - Math.max(10, camp.h) - 12;
    });
    // A single dungeon is a chain of chambers joined by halls, stairs,
    // elevators and bridges. Spire runs keep their existing floor plan.
    const hallResult = insertHalls(rooms, connections, rng);
    if (hallResult.halls.length) {
      rooms.push(...hallResult.halls);
      connections.length = 0;
      connections.push(...hallResult.connections);
    }
  }

  // Branching non-combat side rooms. These are extra to the rank's encounter
  // count and are reached from a normal room by a side passage. They are for
  // harvesting, lore and exploration rather than fights.
  let harvestPool = source.filter((t) => t.category === "Harvest" && t.enabled !== false);
  if (!harvestPool.length) {
    harvestPool = STARTER_DUNGEON_ROOMS.filter((t) => t.category === "Harvest");
  }
  const sideParents = rooms.filter(
    (r) => !r.branch && !["Start", "Boss"].includes(r.category)
  );
  if (harvestPool.length && sideParents.length) {
    const sideCount = Math.max(1, Math.ceil(info.rooms / 4));
    for (let i = 0; i < sideCount; i += 1) {
      const template = rng.pick(harvestPool);
      const parent = rng.pick(sideParents);
      const room = instantiate(template, "Harvest", rng, rank, {
        monsters: [],
        lootPools,
        players,
      });
      room.name = template.name || "Harvesting Site";
      room.side = true;
      room.branch = true;
      room.combat = false;
      room.parentId = parent.id;
      room.traps = [];
      room.spawns = [];
      room.spawnPoints = [];
      const maxX = Math.max(0, ...rooms.map((r) => r.x + r.w));
      const maxY = Math.max(0, ...rooms.map((r) => r.y + r.h));
      room.x = maxX + 20 + (i % 3) * (room.w + 12);
      room.y = maxY + 20 + Math.floor(i / 3) * (room.h + 12);
      rooms.push(room);
      connections.push(link(parent.id, room.id, "Side passage"));
    }
  }

  const routes = buildRoutes(rooms, connections);
  const finalRooms = limitExternalDoors(rooms);
  const linkedConnections = attachDoorPoints(finalRooms, connections);
  return {
    id: uid("dungeon"),
    name: title,
    mode,
    rank,
    seed,
    rooms: finalRooms,
    connections: linkedConnections,
    routes,
    chosenRouteId: routes[0]?.id || "",
    notes: `${info.nickname} · ${info.downtime} downtime · ${rooms.filter((r) => !r.hall && !r.side).length} rooms`,
    createdAt: new Date().toISOString(),
  };
}

// Room footprints are stored as local grid cells [x, y] (0-based). A room
// without cells is a plain rectangle; complex rooms can be L/T/U/cross shapes
// or any connected set of cells painted in the room builder.
export function rectCells(w, h) {
  const cells = [];
  for (let y = 0; y < Math.max(1, h); y++) {
    for (let x = 0; x < Math.max(1, w); x++) cells.push([x, y]);
  }
  return cells;
}

export function roomShapeCells(room) {
  const w = Math.max(1, Math.round(Number(room?.w) || 1));
  const h = Math.max(1, Math.round(Number(room?.h) || 1));
  if (!Array.isArray(room?.cells) || !room.cells.length) return rectCells(w, h);
  const set = new Set();
  room.cells.forEach((cell) => {
    const x = Number(cell?.[0] ?? cell?.x);
    const y = Number(cell?.[1] ?? cell?.y);
    if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < w && y < h) {
      set.add(`${x},${y}`);
    }
  });
  return set.size ? [...set].map((key) => key.split(",").map(Number)) : rectCells(w, h);
}

export function cellsConnected(cells) {
  if (!cells?.length) return false;
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  const seen = new Set([`${cells[0][0]},${cells[0][1]}`]);
  const queue = [[cells[0][0], cells[0][1]]];
  while (queue.length) {
    const [x, y] = queue.shift();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const key = `${x + dx},${y + dy}`;
      if (set.has(key) && !seen.has(key)) {
        seen.add(key);
        queue.push([x + dx, y + dy]);
      }
    });
  }
  return seen.size === set.size;
}

// Boundary path for a set of grid cells; used for the dungeon schematic and
// the battle map so irregular rooms read as one continuous floor.
export function cellsOutlinePath(cells, cellSize, ox = 0, oy = 0) {
  const set = new Set((cells || []).map(([x, y]) => `${x},${y}`));
  const parts = [];
  const at = (x, y) => set.has(`${x},${y}`);
  (cells || []).forEach(([x, y]) => {
    const x0 = ox + x * cellSize;
    const y0 = oy + y * cellSize;
    const x1 = x0 + cellSize;
    const y1 = y0 + cellSize;
    if (!at(x, y - 1)) parts.push(`M ${x0} ${y0} L ${x1} ${y0}`);
    if (!at(x + 1, y)) parts.push(`M ${x1} ${y0} L ${x1} ${y1}`);
    if (!at(x, y + 1)) parts.push(`M ${x1} ${y1} L ${x0} ${y1}`);
    if (!at(x - 1, y)) parts.push(`M ${x0} ${y1} L ${x0} ${y0}`);
  });
  return parts.join(" ");
}

export function cellsFillPath(cells, cellSize, ox = 0, oy = 0) {
  return (cells || [])
    .map(([x, y]) => {
      const x0 = ox + x * cellSize;
      const y0 = oy + y * cellSize;
      return `M ${x0} ${y0} h ${cellSize} v ${cellSize} h ${-cellSize} Z`;
    })
    .join(" ");
}

export const ROOM_SHAPES = [
  "Rectangle", "Diamond", "Circle", "L-Shape", "T-Shape", "U-Shape",
  "Cross", "Octagon", "Hexagon", "Hourglass", "Rounded", "Cavern", "Irregular",
];

const irregularCells = (w, h) => {
  // Deterministic "unlucky" cave footprint: grow a connected mass from the
  // centre with occasional jogs and narrow necks.
  let seed = (w * 73856093) ^ (h * 19349663) ^ 0x9e3779b9;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const start = [Math.floor(w / 2), Math.floor(h / 2)];
  const cells = [start];
  const set = new Set([`${start[0]},${start[1]}`]);
  const target = Math.max(4, Math.round(w * h * (0.58 + rand() * 0.18)));
  let guard = 0;
  while (cells.length < target && guard < 5000) {
    guard += 1;
    const [px, py] = cells[Math.floor(rand() * cells.length)];
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rand() * 4)];
    const x = px + dx;
    const y = py + dy;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const key = `${x},${y}`;
    if (set.has(key) || rand() < 0.22) continue;
    set.add(key);
    cells.push([x, y]);
  }
  return cells;
};

export function shapeCells(width, height, shape) {
  const w = Math.max(9, Math.min(33, Math.round(Number(width) || 9)));
  const h = Math.max(9, Math.min(33, Math.round(Number(height) || 9)));
  const keep = (predicate) => {
    const out = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) if (predicate(x, y)) out.push([x, y]);
    }
    return out;
  };
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const rx = Math.max(1, (w - 1) / 2);
  const ry = Math.max(1, (h - 1) / 2);
  switch (shape) {
    case "Diamond": {
      const cells = keep((x, y) => Math.abs((x - cx) / rx) + Math.abs((y - cy) / ry) <= 1.06);
      return cells.length ? cells : rectCells(w, h);
    }
    case "Circle": {
      const cells = keep((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.06);
      return cells.length ? cells : rectCells(w, h);
    }
    case "L-Shape":
      return keep((x, y) => x < Math.ceil(w * 0.55) || y >= Math.floor(h * 0.55));
    case "T-Shape":
      return keep((x, y) => y < Math.ceil(h * 0.4) || (x >= Math.floor(w * 0.3) && x < Math.ceil(w * 0.7)));
    case "U-Shape":
      return keep((x, y) => x < Math.ceil(w * 0.28) || x >= Math.floor(w * 0.72) || y >= Math.floor(h * 0.55));
    case "Cross":
      return keep(
        (x, y) =>
          (x >= Math.floor(w * 0.3) && x < Math.ceil(w * 0.7)) ||
          (y >= Math.floor(h * 0.3) && y < Math.ceil(h * 0.7))
      );
    case "Octagon":
      return keep((x, y) => {
        const cutX = Math.floor(w * 0.25);
        const cutY = Math.floor(h * 0.25);
        return !((x < cutX && y < cutY) || (x >= w - cutX && y < cutY) || (x < cutX && y >= h - cutY) || (x >= w - cutX && y >= h - cutY));
      });
    case "Hexagon":
      return keep((x, y) => {
        const cutX = Math.floor(w * 0.2);
        const cutY = Math.floor(h * 0.25);
        return !((x < cutX && (y < cutY || y >= h - cutY)) || (x >= w - cutX && (y < cutY || y >= h - cutY)));
      });
    case "Hourglass":
      return keep((x, y) => {
        const t = Math.abs(y - cy) / Math.max(1, h / 2);
        const limit = 0.18 + 0.82 * t;
        return Math.abs(x - cx) / Math.max(1, w / 2) <= limit;
      });
    case "Rounded":
      return keep((x, y) => {
        const corner = Math.min(w, h) * 0.18;
        const nearX = x < corner || x >= w - corner;
        const nearY = y < corner || y >= h - corner;
        return !(nearX && nearY);
      });
    case "Cavern":
      return irregularCells(w, h);
    case "Irregular":
      return irregularCells(w, h);
    default:
      return rectCells(w, h);
  }
}

// Varied, connected footprints. Most rooms are rectangular; curves, diagonals
// and the occasional chaotic cave keep battlemaps from feeling like a grid of
// boxes. "Irregular" is deliberately rare — the unlucky room.
export function pickRoomShape(category, rng) {
  if (category === "Entrance" || category === "Corridor") {
    return rng.chance(0.08) ? "L-Shape" : "Rectangle";
  }
  const roll = rng.rand();
  if (roll < 0.035) return "Irregular";
  if (roll < 0.06) return "Circle";
  if (roll < 0.085) return "Diamond";
  if (roll < 0.12) return "Hexagon";
  if (roll < 0.15) return "Hourglass";
  if (roll < 0.18) return "Rounded";
  if (roll < 0.2) return "Cavern";
  if (roll < 0.27) return "L-Shape";
  if (roll < 0.33) return "T-Shape";
  if (roll < 0.39) return "Cross";
  if (roll < 0.44) return "Octagon";
  if (roll < 0.5) return "U-Shape";
  return "Rectangle";
}

function edgeCells(cells) {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  return cells.filter(([x, y]) =>
    [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !set.has(`${x + dx},${y + dy}`))
  );
}

function defaultIngress(cells) {
  if (!cells.length) return [];
  const edge = edgeCells(cells);
  const left = edge.reduce((best, c) => (c[0] < best[0] ? c : best), edge[0] || cells[0]);
  return [{ x: left[0], y: left[1], label: "Ingress" }];
}

function defaultSpawns(cells, count) {
  if (!cells.length || !count) return [];
  const edge = edgeCells(cells).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const picked = [];
  const seen = new Set();
  edge.forEach((cell) => {
    if (picked.length >= Math.min(6, count)) return;
    const key = `${cell[0]},${cell[1]}`;
    if (seen.has(key)) return;
    seen.add(key);
    picked.push({ x: cell[0], y: cell[1], label: `Spawn ${picked.length + 1}` });
  });
  return picked;
}

const coverType = (cover) => {
  const text = String(cover || "").toLowerCase();
  if (/full/.test(text)) return "full";
  if (/three|3\/4|three-quarters/.test(text)) return "three-quarters";
  if (/half|pillar|crate|wall|fog/.test(text)) return "half";
  return "";
};

export function elevationHeightCells(cells, elevation) {
  const text = String(elevation || "").toLowerCase();
  if (!cells?.length || !text || text.includes("flat")) return [];
  const xs = cells.map(([x]) => x);
  const ys = cells.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = Math.max(1, (maxX - minX) / 2);
  const ry = Math.max(1, (maxY - minY) / 2);
  const out = [];
  cells.forEach(([x, y]) => {
    const nx = Math.abs((x - cx) / rx);
    const ny = Math.abs((y - cy) / ry);
    let h = 0;
    if (/tiered|steps/.test(text)) h = nx < 0.3 && ny < 0.3 ? 2 : nx < 0.62 && ny < 0.62 ? 1 : 0;
    else if (/raised|dais|above|high/.test(text)) h = nx < 0.38 && ny < 0.38 ? 1 : 0;
    else if (/sunken|pit|below|chasm/.test(text)) h = nx < 0.38 && ny < 0.38 ? -1 : 0;
    if (h) out.push([x, y, h]);
  });
  return out;
}

export function findStairs(cells, heightCells) {
  const map = new Map((heightCells || []).map(([x, y, h]) => [`${x},${y}`, h]));
  const candidates = [];
  (cells || []).forEach(([x, y]) => {
    const h = map.get(`${x},${y}`) || 0;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (!cells.some(([cx, cy]) => cx === nx && cy === ny)) return;
      const nh = map.get(`${nx},${ny}`) || 0;
      if (nh === h) return;
      const low = h < nh ? [x, y] : [nx, ny];
      if (!candidates.some(([cx, cy]) => cx === low[0] && cy === low[1])) {
        candidates.push(low);
      }
    });
  });
  if (!candidates.length) return [];
  if (candidates.length === 1) return candidates.map(([x, y]) => ({ x, y }));
  return [candidates[0], candidates[Math.floor(candidates.length / 2)]].map(([x, y]) => ({ x, y }));
}

const spreadCells = (cells, count) => {
  if (!cells.length || !count) return [];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const cell = cells[Math.floor((i + 0.5) * (cells.length / count)) % cells.length];
    if (cell && !out.some(([x, y]) => x === cell[0] && y === cell[1])) out.push(cell);
  }
  return out;
};

export function coverPointsFor(cells, cover) {
  const type = coverType(cover);
  if (!type || !cells?.length) return [];
  const edge = edgeCells(cells);
  const pool = edge.length ? edge : cells;
  return spreadCells(pool, Math.min(6, Math.max(2, Math.round(pool.length / 8)))).map(
    ([x, y]) => ({ x, y, cover: type })
  );
}

export function trapPointsFor(cells, traps, rng) {
  if (!cells?.length || !traps?.length) return [];
  const list = [...traps].slice(0, 4);
  return list.map((trap, i) => {
    const index = Math.floor((rng ? rng.rand() : (i + 0.5) / list.length) * cells.length);
    const [x, y] = cells[Math.min(cells.length - 1, index)];
    return { x, y, type: String(trap).split(":")[0].trim() };
  });
}

export function waterCellsFor(cells, environment) {
  const text = String(environment || "").toLowerCase();
  if (!/flood|cistern|water|spring|river|lake|sea|marsh/.test(text)) return [];
  return spreadCells(cells, Math.max(2, Math.round(cells.length * 0.28)));
}

// Liquids run across a room from one edge (start) to one or two opposite/side
// edges, always at least two cells thick, with a bridge crossing over them.
export function liquidCellsFor(cells, environment, rng) {
  const text = String(environment || "").toLowerCase();
  const kind = /lava|magma|volcan|molten|fire/.test(text)
    ? "lava"
    : /flood|cistern|water|spring|river|lake|sea|marsh/.test(text)
      ? "water"
      : "";
  const list = (cells || [])
    .map((cell) => [Number(cell?.[0]), Number(cell?.[1])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (!kind || list.length < 4) {
    return { kind: "", cells: [], bridges: [], start: null, ends: [] };
  }
  const valid = new Set(list.map(([x, y]) => `${x},${y}`));
  const xs = list.map(([x]) => x);
  const ys = list.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rand = (min, max) =>
    rng?.int ? rng.int(min, max) : Math.round((min + max) / 2);
  const random = () => (rng?.rand ? rng.rand() : 0.5);
  const horizontal = random() < 0.5;
  const liquid = new Set();
  const bridges = new Set();
  const pathPoints = [];

  const addPath = (from, to, remember = false) => {
    const steps = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]), 1);
    for (let i = 0; i <= steps; i += 1) {
      const x = Math.round(from[0] + ((to[0] - from[0]) * i) / steps);
      const y = Math.round(from[1] + ((to[1] - from[1]) * i) / steps);
      if (remember) pathPoints.push([x, y]);
      // Two-cell thickness.
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        if (valid.has(`${x + dx},${y + dy}`)) liquid.add(`${x + dx},${y + dy}`);
      }
    }
  };

  const start = horizontal
    ? [minX, rand(minY + 1, Math.max(minY + 1, maxY - 1))]
    : [rand(minX + 1, Math.max(minX + 1, maxX - 1)), minY];
  const ends = [];
  ends.push(
    horizontal
      ? [maxX, rand(minY + 1, Math.max(minY + 1, maxY - 1))]
      : [rand(minX + 1, Math.max(minX + 1, maxX - 1)), maxY]
  );
  if (random() < 0.55) {
    ends.push(
      horizontal
        ? [rand(minX + 1, Math.max(minX + 1, maxX - 1)), maxY]
        : [maxX, rand(minY + 1, Math.max(minY + 1, maxY - 1))]
    );
  }
  ends.forEach((end, index) => addPath(start, end, index === 0));

  // At least one bridge crosses the liquid two cells wide.
  const bridgePoint =
    pathPoints[Math.floor(pathPoints.length * 0.55)] ||
    [rand(minX + 1, Math.max(minX + 1, maxX - 1)), rand(minY + 1, Math.max(minY + 1, maxY - 1))];
  const bridgeX = bridgePoint[0];
  const bridgeY = bridgePoint[1];
  for (let d = -1; d <= 1; d += 1) {
    const cellsToAdd = horizontal
      ? [[bridgeX + d, bridgeY - 1], [bridgeX + d, bridgeY], [bridgeX + d, bridgeY + 1]]
      : [[bridgeX - 1, bridgeY + d], [bridgeX, bridgeY + d], [bridgeX + 1, bridgeY + d]];
    cellsToAdd.forEach(([x, y]) => {
      if (valid.has(`${x},${y}`)) bridges.add(`${x},${y}`);
    });
  }

  return {
    kind,
    cells: [...liquid].map((key) => key.split(",").map(Number)),
    bridges: [...bridges].map((key) => key.split(",").map(Number)),
    start,
    ends,
  };
}

export function difficultCellsFor(cells, environment, effect = "") {
  const text = `${environment || ""} ${effect || ""}`.toLowerCase();
  if (!/rubble|overgrown|fungal|mine|frozen|ice|unstable|difficult/.test(text)) return [];
  return spreadCells(cells, Math.max(2, Math.round(cells.length * 0.24)));
}

const pointXY = (p) =>
  Array.isArray(p)
    ? { x: Number(p[0]), y: Number(p[1]) }
    : { x: Number(p?.x), y: Number(p?.y) };

export function roomSurfaceFeatures(room, cells, rng) {
  const heights = Array.isArray(room?.heights) && room.heights.length
    ? room.heights
        .map((p) =>
          Array.isArray(p)
            ? [Number(p[0]), Number(p[1]), Number(p[2]) || 0]
            : [Number(p?.x), Number(p?.y), Number(p?.height ?? p?.h ?? 0) || 0]
        )
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    : elevationHeightCells(cells, room?.elevation);
  const stairs = Array.isArray(room?.stairs) && room.stairs.length
    ? room.stairs.map(pointXY).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    : findStairs(cells, heights);
  const explicitWater = Array.isArray(room?.water) && room.water.length
    ? room.water.map((p) => {
        const { x, y } = pointXY(p);
        return [x, y];
      })
    : null;
  const explicitLava = Array.isArray(room?.lava) && room.lava.length
    ? room.lava.map((p) => {
        const { x, y } = pointXY(p);
        return [x, y];
      })
    : null;
  const liquid =
    explicitWater || explicitLava
      ? { kind: explicitLava ? "lava" : "water", bridges: [] }
      : liquidCellsFor(cells, room?.environment, rng);
  const water = explicitWater || (liquid.kind === "water" ? liquid.cells : []);
  const lava = explicitLava || (liquid.kind === "lava" ? liquid.cells : []);
  const bridges = Array.isArray(room?.bridges) && room.bridges.length
    ? room.bridges.map((p) => {
        const { x, y } = pointXY(p);
        return [x, y];
      })
    : liquid.bridges || [];
  const hazardPoints = Array.isArray(room?.hazardPoints)
    ? room.hazardPoints.map((p) => ({
        ...pointXY(p),
        type: String(Array.isArray(p) ? p[2] || p[3] || "Hazard" : p?.type || p?.hazard || "Hazard"),
      }))
    : [];
  return {
    heights,
    stairs,
    coverPoints: Array.isArray(room?.coverPoints) && room.coverPoints.length
      ? room.coverPoints.map((p) => ({
          ...pointXY(p),
          cover: Array.isArray(p) ? p[2] || p[3] || "half" : p?.cover || "half",
        }))
      : coverPointsFor(cells, room?.cover),
    trapPoints: Array.isArray(room?.trapPoints) && room.trapPoints.length
      ? room.trapPoints.map((p) => ({
          ...pointXY(p),
          type: Array.isArray(p) ? p[2] || p[3] || "Trap" : p?.type || "Trap",
        }))
      : trapPointsFor(cells, room?.traps, rng),
    water,
    lava,
    bridges,
    hazardPoints,
    liquidStart: liquid.start || null,
    liquidEnds: liquid.ends || [],
    difficult: Array.isArray(room?.difficult) && room.difficult.length
      ? room.difficult.map((p) => {
          const { x, y } = pointXY(p);
          return [x, y];
        })
      : difficultCellsFor(cells, room?.environment, room?.environmentEffect),
  };
}

// Decorative tactical landmarks derived from a room's tags/name/environment.
// These are rendered on the battle map and cost nothing to persist because they
// follow the room description.
export function roomFeaturePoints(room) {
  const cells = roomShapeCells(room);
  if (!cells?.length) return [];
  const text = `${room.name || ""} ${room.category || ""} ${(room.tags || []).join(" ")} ${
    room.environment || ""
  } ${room.description || ""}`.toLowerCase();
  const edges = edgeCells(cells);
  const out = [];
  const add = (cell, type) => {
    if (!cell) return;
    const [x, y] = cell;
    if (out.some((f) => f.x === x && f.y === y && f.type === type)) return;
    out.push({ x, y, type });
  };
  const pick = (list, fraction) =>
    list[Math.max(0, Math.min(list.length - 1, Math.floor(list.length * fraction)))];
  const center = pick(cells, 0.5);

  if (/pillar|colonnade|pillared|hall/.test(text)) {
    [0.15, 0.35, 0.65, 0.85].forEach((fraction) => add(pick(edges, fraction), "pillar"));
  }
  if (/dais|throne|altar|boss|sanctum|shrine|ritual/.test(text)) {
    add(center, "dais");
  }
  if (/pit|chasm|sunken|sinkhole|chasm edge/.test(text)) {
    add(center, "pit");
  }
  if (/rubble|collapsed|broken|overgrown|cavern|fungal/.test(text)) {
    [0.2, 0.45, 0.7].forEach((fraction) => add(pick(cells, fraction), "rubble"));
  }
  if (/forge|flame|volcanic|brazier|ember/.test(text)) {
    add(pick(edges, 0.08), "brazier");
    add(pick(edges, 0.92), "brazier");
  }
  if (/crystal|grotto|arcane|mana|resonance/.test(text)) {
    add(pick(edges, 0.25), "crystal");
    add(pick(edges, 0.75), "crystal");
  }
  return out;
}

export function roomFromTemplate(template, { x = 0, y = 0 } = {}) {
  const t = template || STARTER_DUNGEON_ROOMS[0];
  const w = Math.max(9, Math.min(33, Math.round(((t.minW || 9) + (t.maxW || t.minW || 9)) / 2)));
  const h = Math.max(9, Math.min(33, Math.round(((t.minH || 9) + (t.maxH || t.minH || 9)) / 2)));
  const shape = t.cells?.length ? t.shape || "Custom" : t.shape || "Rectangle";
  const cells = t.cells?.length
    ? t.cells.map(([cx, cy]) => [cx, cy])
    : shapeCells(w, h, shape);
  const environment = t.environment || "";
  const elevation = t.elevation || "Flat";
  const cover = t.cover || "Open";
  const traps = [...(t.traps || [])];
  const surface = roomSurfaceFeatures(
    { ...t, environment, elevation, cover, traps },
    cells
  );
  return {
    id: uid("room"),
    templateId: t.id,
    name: t.name || "Room",
    category: t.category || "Chamber",
    x,
    y,
    w,
    h,
    shape,
    cells,
    heights: surface.heights,
    stairs: surface.stairs,
    coverPoints: surface.coverPoints,
    trapPoints: surface.trapPoints,
    water: surface.water,
    lava: surface.lava || [],
    bridges: surface.bridges || [],
    hazardPoints: surface.hazardPoints || [],
    difficult: surface.difficult,
    environmentEffect: t.environmentEffect || "",
    floorType: t.floorType || "stone",
    floorTextureUrl: t.floorTextureUrl || "",
    tags: [...(t.tags || [])],
    ingressPoints: t.ingressPoints?.length
      ? t.ingressPoints.map((p) => ({ ...p }))
      : defaultIngress(cells),
    spawnPoints: t.spawnPoints?.length
      ? t.spawnPoints.map((p) => ({ ...p }))
      : defaultSpawns(cells, (t.spawns || []).length),
    environment,
    elevation,
    cover,
    connector: t.connector || "Doorway",
    traps,
    spawns: [...(t.spawns || [])],
    loot: [...(t.loot || [])],
    harvest: [...(t.harvest || [])],
    side: false,
    notes: t.notes || "",
    description: t.description || "",
    cr0Only: !!t.cr0Only,
    bonfire: !!t.bonfire,
  };
}

export const CR_STEPS = [
  "0", "1/8", "1/4", "1/2", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23",
  "24", "25", "26", "27", "28", "29", "30",
];

export function crValue(cr) {
  const s = String(cr ?? "").trim();
  if (s === "1/8") return 0.125;
  if (s === "1/4") return 0.25;
  if (s === "1/2") return 0.5;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// A missing CR is not CR 0. Imported records often omit the field; treating
// them as 0 made level-1 dungeons spawn dracoliches and other unrated monsters.
export function hasCr(cr) {
  const s = String(cr ?? "").trim();
  if (!s) return false;
  if (s === "1/8" || s === "1/4" || s === "1/2") return true;
  return Number.isFinite(Number(s));
}

export function crTargets(level) {
  const lv = Math.max(1, Math.round(Number(level) || 1));
  let maxIdx = CR_STEPS.findIndex((s) => crValue(s) >= lv);
  if (maxIdx < 0) maxIdx = CR_STEPS.length - 1;
  maxIdx = Math.max(1, maxIdx);
  const targetIdx = Math.max(1, maxIdx - 2);
  return { maxIdx, targetIdx, maxCR: CR_STEPS[maxIdx], targetCR: CR_STEPS[targetIdx] };
}

// Pick monsters for every room using the party size and level. Two monsters per
// player is the baseline; the target CR is two steps below the party level, and
// never above it. CR0-only rooms (animal dens) draw from CR 0 creatures.
export function scaleEncounters(
  dungeon,
  {
    players = 4,
    partyLevel = 1,
    monsters = [],
    rank = dungeon?.rank,
    encounterTable = null,
    countMultiplier = 1,
    bossCR = null,
  } = {}
) {
  const party = Math.max(1, Math.round(Number(players) || 1));
  const level = Math.max(1, Math.round(Number(partyLevel) || 1));
  const multiplier = Math.max(1, Math.round(Number(countMultiplier) || 1));
  const bossTarget = Math.max(0.125, Number(bossCR ?? partyLevel) || level);
  const band = rankChallenge(rank);
  const allPool = (monsters || []).filter((m) => m?.name);
  // Missing CR is not CR 0. Exempted creatures never enter the automatic pool.
  const pool = allPool.filter((m) => hasCr(m.cr) && !m.dungeonExempt);
  const byName = new Map(allPool.map((m) => [String(m.name).toLowerCase(), m]));
  const uniqueUsed = new Set();
  const generic = (room) => {
    const bossRoom = room.category === "Boss";
    const eliteRoom = room.category === "Elite";
    const target = bossRoom ? bossTarget : eliteRoom ? band.maxCR : band.minionMax;
    if (bossRoom) return `${Math.max(1, multiplier)}× CR ${target} boss`;
    if (eliteRoom) return `${Math.max(1, multiplier + 1)}× CR ${target} elite`;
    return `${Math.max(1, party * 2 * multiplier)}× rank ${rank} minion threat (CR ${band.minionMin}–${band.minionMax})`;
  };
  return {
    ...dungeon,
    rooms: (dungeon.rooms || []).map((room) => {
      if (
        room.bonfire ||
        room.side ||
        room.hall ||
        ["Rest", "Shop", "Entrance", "Start", "Harvest", "Corridor"].includes(room.category)
      ) {
        // Halls can still carry traps, puzzles and set dressing, but never a
        // monster encounter. Halls are the safe connective tissue.
        return { ...room, spawns: [] };
      }
      const bossRoom = room.category === "Boss";
      const miniBoss = bossRoom || room.category === "Elite";
      const lo = bossRoom ? bossTarget : miniBoss ? band.minCR : band.minionMin;
      const hi = bossRoom ? bossTarget : miniBoss ? band.maxCR : band.minionMax;

      if (encounterTable) {
        const rolled = rollEncounter(encounterTable, pool);
        const limit =
          (room.category === "Boss" ? party + 2 : room.category === "Elite" ? party + 1 : party * 2) *
          multiplier;
        let remaining = limit;
        const spawns = [];
        for (const row of rolled) {
          if (remaining <= 0) break;
          const monster = byName.get(String(row.monster).toLowerCase());
          if (monster?.dungeonExempt) continue;
          if (monster?.unique && (!miniBoss || uniqueUsed.has(monster.name))) continue;
          let take = Math.min(remaining, Math.max(1, Number(row.count) || 1));
          if (monster?.unique) take = 1;
          if (take <= 0) continue;
          spawns.push(`${take}× ${row.monster}`);
          remaining -= take;
          if (monster?.unique) uniqueUsed.add(monster.name);
        }
        return {
          ...room,
          spawns: spawns.length ? spawns : [generic(room)],
          encounterTable: encounterTable.name || "",
        };
      }

      if (!pool.length) {
        return { ...room, spawns: [generic(room)] };
      }
      // Animal dens may use CR 0 only when the allowed band includes 0.
      const cr0 = !!room.cr0Only && lo === 0;
      const baseCandidates = pool.filter(
        (m) => !(m.unique && (!miniBoss || uniqueUsed.has(m.name)))
      );
      let candidates;
      if (bossRoom) {
        // Final bosses are always the highest party member's level/CR.
        const exact = baseCandidates.filter(
          (m) => Math.abs(crValue(m.cr) - bossTarget) <= 0.3
        );
        candidates = exact.length
          ? exact
          : [...baseCandidates]
              .sort(
                (a, b) =>
                  Math.abs(crValue(a.cr) - bossTarget) -
                  Math.abs(crValue(b.cr) - bossTarget)
              )
              .slice(0, Math.max(1, Math.min(4, baseCandidates.length)));
      } else {
        candidates = baseCandidates.filter((m) => {
          const v = crValue(m.cr);
          return cr0 ? v === 0 : v >= lo && v <= hi;
        });
      }
      if (!candidates.length) {
        return { ...room, spawns: [generic(room)] };
      }
      const uniqueCandidates = candidates.filter((m) => m.unique);
      const bossPrefersUnique = miniBoss && room.category === "Boss" && uniqueCandidates.length > 0;
      const pickFrom = bossPrefersUnique ? uniqueCandidates : candidates;
      const groups =
        room.category === "Boss" || room.category === "Elite"
          ? 1
          : Math.min(2, pickFrom.length);
      const total =
        room.category === "Boss"
          ? multiplier
          : room.category === "Elite"
            ? multiplier + 1
            : party * 2 * multiplier;
      const picked = [];
      for (let i = 0; i < groups; i += 1) {
        const m = pickFrom[Math.floor(Math.random() * pickFrom.length)];
        const count = m.unique ? 1 : Math.max(1, Math.round(total / groups));
        picked.push(`${count}× ${m.name}${m.cr ? ` (CR ${m.cr})` : ""}`);
        if (m.unique) {
          uniqueUsed.add(m.name);
          // A unique creature cannot also fill the second boss group.
          break;
        }
      }
      return { ...room, spawns: picked };
    }),
    encounterScale: {
      players: party,
      partyLevel: level,
      rank,
      rankCR: band.rankCR,
      bossCR: bossTarget,
      countMultiplier: multiplier,
      minCR: band.minCR,
      maxCR: band.maxCR,
      minionMin: band.minionMin,
      minionMax: band.minionMax,
      targetCR: band.maxCR,
      encounterTable: encounterTable?.name || "",
    },
  };
}

export function dungeonBounds(dungeon) {
  const rooms = dungeon?.rooms || [];
  if (!rooms.length) return { minX: 0, minY: 0, maxX: 10, maxY: 10, w: 10, h: 10 };
  const minX = Math.min(...rooms.map((r) => r.x));
  const minY = Math.min(...rooms.map((r) => r.y));
  const maxX = Math.max(...rooms.map((r) => r.x + r.w));
  const maxY = Math.max(...rooms.map((r) => r.y + r.h));
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export function categoryColor(category) {
  return (DUNGEON_CATEGORIES.find(([c]) => c === category) || [])[1] || "#94a3b8";
}
