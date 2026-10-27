// Procedural dungeon generation: room templates, rank tables, seeded layouts
// for a single dungeon or a branching "spire" run.

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
  return templates.length ? rng.pick(templates) : DEFAULT_DUNGEON_ROOMS[0];
}

function instantiate(template, category, rng, rank, { monsters, lootPools }) {
  const w = rng.int(template.minW || 3, template.maxW || template.minW || 5);
  const h = rng.int(template.minH || 3, template.maxH || template.minH || 5);
  const traps = [...(template.traps || [])];
  if (!traps.length && (category === "Trap" || rng.chance(0.18)))
    traps.push(rng.pick(TRAP_POOL));
  const spawns = [...(template.spawns || [])];
  if (!spawns.length && ["Chamber", "Corridor", "Elite", "Boss"].includes(category)) {
    const names = (monsters || []).map((m) => m.name).filter(Boolean);
    if (names.length) spawns.push(`${rng.int(1, 3)}× ${rng.pick(names)}`);
    else spawns.push(`${rng.int(1, 3)} rank ${rank} minions`);
  }
  const loot = [...(template.loot || [])];
  if (!loot.length && (category === "Loot" || rng.chance(0.22))) {
    const pools = (lootPools || []).map((p) => p.name).filter(Boolean);
    loot.push(pools.length ? `${rng.pick(pools)} (1 roll)` : `1 rank ${rank} loot roll`);
  }
  const shape = template.cells?.length
    ? template.shape || "Custom"
    : template.shape || pickRoomShape(category, rng);
  const cells = template.cells?.length
    ? template.cells.map(([cx, cy]) => [cx, cy])
    : shapeCells(w, h, shape);
  return {
    id: uid("room"),
    templateId: template.id,
    name: template.name || `${category} ${rng.int(1, 9)}`,
    category,
    x: 0,
    y: 0,
    w,
    h,
    environment: template.environment || rng.pick(DUNGEON_ENVIRONMENTS),
    elevation: template.elevation || rng.pick(ELEVATIONS),
    cover: template.cover || rng.pick(COVERS),
    connector: template.connector || "Doorway",
    shape,
    cells,
    ingressPoints: template.ingressPoints?.length
      ? template.ingressPoints.map((p) => ({ ...p }))
      : defaultIngress(cells),
    spawnPoints: template.spawnPoints?.length
      ? template.spawnPoints.map((p) => ({ ...p }))
      : defaultSpawns(cells, spawns.length),
    traps,
    spawns,
    loot,
    notes: template.notes || "",
    cr0Only: !!template.cr0Only,
    bonfire: !!template.bonfire,
  };
}

const link = (from, to, type = "Doorway") => ({
  id: `${from}->${to}`,
  from,
  to,
  type,
});

function makeMissionStart() {
  const w = 4;
  const h = 4;
  const cells = rectCells(w, h);
  return {
    id: uid("room"),
    templateId: "room-mission-start",
    name: "Mission Start",
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
  spine.forEach((room, i) => {
    room.x = i * 18;
    room.y = (i % 2 ? 9 : 0) + rng.int(-2, 2);
  });
  rooms.filter((r) => r.branch).forEach((room) => {
    const parent = rooms.find((r) => r.id === room.parentId) || spine[0];
    room.x = (parent?.x || 0) + 6;
    room.y = (parent?.y || 0) + 20;
  });
}

function buildRoutes(rooms, connections) {
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

export function generateDungeon({
  mode = "single",
  rank = "E",
  seed = randomSeed(),
  templates = DEFAULT_DUNGEON_ROOMS,
  monsters = [],
  lootPools = [],
  name = "",
} = {}) {
  const rng = makeRng(`${mode}:${rank}:${seed}`);
  const info = DUNGEON_RANKS[rank] || DUNGEON_RANKS.E;
  const rankIndex = Math.max(0, Object.keys(DUNGEON_RANKS).indexOf(rank));
  const source = (templates || []).length ? templates : DEFAULT_DUNGEON_ROOMS;
  const rooms = [];
  const connections = [];
  const total = Math.max(3, Math.min(24, info.rooms));
  const opts = { monsters, lootPools };
  let title = name || generateDungeonName(seed, mode, rank);

  if (mode === "spire") {
    const floors = 15;
    const start = makeMissionStart();
    start.x = -22;
    start.y = 0;
    rooms.push(start);
    let entrance = instantiate(templateFor("Entrance", source, rng), "Entrance", rng, rank, opts);
    entrance.x = 0;
    entrance.y = 0;
    rooms.push(entrance);
    connections.push(link(start.id, entrance.id, "Trail"));
    let previous = [entrance];
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
        room.x = f * 22;
        room.y = (lane - (count - 1) / 2) * 14 + (last ? 0 : rng.int(-2, 2));
        current.push(room);
        rooms.push(room);
      }
      // Every previous node connects to one or two nearest nodes on this floor.
      previous.forEach((p) => {
        const nearest = [...current].sort(
          (a, b) => Math.abs(a.y - p.y) - Math.abs(b.y - p.y)
        );
        connections.push(link(p.id, nearest[0].id, p.connector));
        if (nearest[1] && rng.chance(0.35))
          connections.push(link(p.id, nearest[1].id, p.connector));
      });
      // Make sure every node on this floor has an entrance.
      current.forEach((c) => {
        if (!connections.some((e) => e.to === c.id)) {
          const p = [...previous].sort(
            (a, b) => Math.abs(a.y - c.y) - Math.abs(b.y - c.y)
          )[0];
          if (p) connections.push(link(p.id, c.id, p.connector));
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
        camp.x = f * 22 + 11;
        camp.y = 0;
        rooms.push(camp);
        current.forEach((room) => connections.push(link(room.id, camp.id, room.connector)));
        previous = [camp];
        encounterFloors = 0;
      }
    }
  } else {
    const branchCount = total >= 9 ? 2 : total >= 6 ? 1 : 0;
    const spineCount = Math.max(2, total - branchCount);
    const categories = ["Start", "Entrance"];
    for (let i = 0; i < spineCount - 2; i++) {
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
    // Higher ranks expose alternate final bosses as route choices.
    const altCount = rankIndex >= 4 ? 2 : rankIndex >= 2 ? 1 : 0;
    const bossParent = expandedSpine[expandedSpine.length - 2];
    if (altCount && bossParent) {
      for (let i = 0; i < altCount; i += 1) {
        const alt = themedBoss(
          instantiate(templateFor("Boss", source, rng), "Boss", rng, rank, opts),
          i + 1
        );
        alt.branch = true;
        alt.parentId = bossParent.id;
        rooms.push(alt);
        connections.push(link(bossParent.id, alt.id, bossParent.connector));
      }
    }
    positionSingle(rooms, rng);
  }

  const routes = buildRoutes(rooms, connections);
  return {
    id: uid("dungeon"),
    name: title,
    mode,
    rank,
    seed,
    rooms,
    connections,
    routes,
    chosenRouteId: routes[0]?.id || "",
    notes: `${info.nickname} · ${info.downtime} downtime · ${info.rooms} encounters`,
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
  "Cross", "Octagon", "Irregular",
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
  const w = Math.max(2, Math.round(Number(width) || 2));
  const h = Math.max(2, Math.round(Number(height) || 2));
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
  if (roll < 0.04) return "Irregular";
  if (roll < 0.07) return "Circle";
  if (roll < 0.13) return "Diamond";
  if (roll < 0.21) return "L-Shape";
  if (roll < 0.28) return "T-Shape";
  if (roll < 0.34) return "Cross";
  if (roll < 0.39) return "Octagon";
  if (roll < 0.45) return "U-Shape";
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

export function roomFromTemplate(template, { x = 0, y = 0 } = {}) {
  const t = template || DEFAULT_DUNGEON_ROOMS[0];
  const w = Math.max(t.minW || 4, Math.round(((t.minW || 4) + (t.maxW || t.minW || 6)) / 2));
  const h = Math.max(t.minH || 4, Math.round(((t.minH || 4) + (t.maxH || t.minH || 6)) / 2));
  const shape = t.cells?.length ? t.shape || "Custom" : t.shape || "Rectangle";
  const cells = t.cells?.length
    ? t.cells.map(([cx, cy]) => [cx, cy])
    : shapeCells(w, h, shape);
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
    ingressPoints: t.ingressPoints?.length
      ? t.ingressPoints.map((p) => ({ ...p }))
      : defaultIngress(cells),
    spawnPoints: t.spawnPoints?.length
      ? t.spawnPoints.map((p) => ({ ...p }))
      : defaultSpawns(cells, (t.spawns || []).length),
    environment: t.environment || "",
    elevation: t.elevation || "Flat",
    cover: t.cover || "Open",
    connector: t.connector || "Doorway",
    traps: [...(t.traps || [])],
    spawns: [...(t.spawns || [])],
    loot: [...(t.loot || [])],
    notes: t.notes || "",
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
  { players = 4, partyLevel = 1, monsters = [], rank = dungeon?.rank } = {}
) {
  const party = Math.max(1, Math.round(Number(players) || 1));
  const level = Math.max(1, Math.round(Number(partyLevel) || 1));
  const band = rankChallenge(rank);
  const pool = (monsters || []).filter((m) => m?.name);
  return {
    ...dungeon,
    rooms: (dungeon.rooms || []).map((room) => {
      if (room.bonfire || ["Rest", "Shop", "Entrance", "Start"].includes(room.category)) {
        return room;
      }
      const miniBoss = room.category === "Boss" || room.category === "Elite";
      const lo = miniBoss ? band.minCR : band.minionMin;
      const hi = miniBoss ? band.maxCR : band.minionMax;
      if (!pool.length) {
        return {
          ...room,
          spawns: [
            `${Math.max(1, party * 2)}× rank ${rank} ${miniBoss ? "boss" : "minion"} threat (CR ${lo}–${hi})`,
          ],
        };
      }
      // Animal dens may use CR 0 only when the allowed band includes 0.
      const cr0 = !!room.cr0Only && lo === 0;
      const candidates = pool.filter((m) => {
        const v = crValue(m.cr);
        return cr0 ? v === 0 : v >= lo && v <= hi;
      });
      if (!candidates.length) {
        return {
          ...room,
          spawns: [
            `${Math.max(1, party * 2)}× rank ${rank} ${miniBoss ? "boss" : "minion"} threat (CR ${lo}–${hi})`,
          ],
        };
      }
      const groups =
        room.category === "Boss" ? 2 : room.category === "Elite" ? 2 : Math.min(2, candidates.length);
      const total =
        room.category === "Boss" ? party + 2 : room.category === "Elite" ? party + 1 : party * 2;
      const picked = [];
      for (let i = 0; i < groups; i++) {
        const m = candidates[Math.floor(Math.random() * candidates.length)];
        const count = Math.max(1, Math.round(total / groups));
        picked.push(`${count}× ${m.name}${m.cr ? ` (CR ${m.cr})` : ""}`);
      }
      return { ...room, spawns: picked };
    }),
    encounterScale: {
      players: party,
      partyLevel: level,
      rank,
      rankCR: band.rankCR,
      minCR: band.minCR,
      maxCR: band.maxCR,
      minionMin: band.minionMin,
      minionMax: band.minionMax,
      targetCR: band.maxCR,
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
