// Procedural dungeon generation: room templates, rank tables, seeded layouts
// for a single dungeon or a branching "spire" run.

export const DUNGEON_RANKS = {
  E: { label: "E", nickname: "Expie", rooms: 3, downtime: "2 weeks", level: "0–2", prof: 0, color: "#94a3b8" },
  D: { label: "D", nickname: "Newk", rooms: 6, downtime: "3 weeks", level: "3–5", prof: 1, color: "#86efac" },
  C: { label: "C", nickname: "Rookie", rooms: 9, downtime: "4 weeks", level: "6–8", prof: 2, color: "#5eead4" },
  B: { label: "B", nickname: "Reg", rooms: 12, downtime: "5 weeks", level: "9–11", prof: 3, color: "#60a5fa" },
  A: { label: "A", nickname: "Prestige", rooms: 15, downtime: "6 weeks", level: "12–14", prof: 4, color: "#a78bfa" },
  S: { label: "S", nickname: "Cavalry", rooms: 18, downtime: "7 weeks", level: "15–17", prof: 5, color: "#f472b6" },
  SS: { label: "SS", nickname: "Hero", rooms: 21, downtime: "8 weeks", level: "18–20", prof: 6, color: "#fb923c" },
  SSS: { label: "SSS", nickname: "Mythos", rooms: 24, downtime: "9 weeks", level: "21+", prof: 7, color: "#ef4444" },
};

export const DUNGEON_CATEGORIES = [
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
    traps,
    spawns,
    loot,
    notes: template.notes || "",
  };
}

const link = (from, to, type = "Doorway") => ({
  id: `${from}->${to}`,
  from,
  to,
  type,
});

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
  const source = (templates || []).length ? templates : DEFAULT_DUNGEON_ROOMS;
  const rooms = [];
  const connections = [];
  const total = Math.max(3, Math.min(24, info.rooms));
  const opts = { monsters, lootPools };
  let title = name || `${rank} ${mode === "spire" ? "Spire" : "Dungeon"}`;

  if (mode === "spire") {
    const floors = 15;
    let entrance = instantiate(templateFor("Entrance", source, rng), "Entrance", rng, rank, opts);
    entrance.x = 0;
    entrance.y = 0;
    rooms.push(entrance);
    let previous = [entrance];
    for (let f = 1; f < floors; f++) {
      const last = f === floors - 1;
      const count = last ? 1 : rng.int(1, 3);
      const current = [];
      for (let lane = 0; lane < count; lane++) {
        let category = "Chamber";
        if (last) category = "Boss";
        else if (f === 4 || f === 9) category = "Elite";
        else if (f === 5 || f === 10) category = "Rest";
        else if (f === 3 || f === 8) category = "Shop";
        else if (rng.chance(0.16)) category = rng.pick(["Trap", "Puzzle", "Loot"]);
        const room = instantiate(templateFor(category, source, rng), category, rng, rank, opts);
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
    }
    title = name || `${rank} Spire`;
  } else {
    const branchCount = total >= 9 ? 2 : total >= 6 ? 1 : 0;
    const spineCount = Math.max(2, total - branchCount);
    const categories = ["Entrance"];
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
      const room = instantiate(templateFor(cat, source, rng), cat, rng, rank, opts);
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
    positionSingle(rooms, rng);
    title = name || `${rank} Dungeon`;
  }

  return {
    id: uid("dungeon"),
    name: title,
    mode,
    rank,
    seed,
    rooms,
    connections,
    notes: `${info.nickname} · ${info.downtime} downtime · ${info.rooms} encounters`,
    createdAt: new Date().toISOString(),
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
