// Procedural names and personalities inspired by the table style of
// fantasynamegenerator.com: culture-specific syllable pools, place-name
// patterns and role-aware personal details.

export const CULTURES = [
  "Human",
  "Elven",
  "Dwarven",
  "Halfling",
  "Orcish",
  "Gnomish",
  "Draconic",
  "Celestial",
  "Infernal",
  "Giant",
  "Alien",
  "Cosmic",
];

const SYLLABLES = {
  Human: {
    start: ["Ald", "Bran", "Cer", "Dar", "Ed", "Fen", "Gar", "Hal", "Ivor", "Jor", "Kel", "Lor", "Mar", "Ned", "Os", "Per", "Quin", "Ral", "Ser", "Tor", "Ul", "Val", "Wen", "Yor"],
    mid: ["a", "e", "i", "o", "an", "en", "ar", "el", "in", "or", "ric", "ald", "wen", "mar"],
    end: ["a", "an", "ard", "en", "ric", "ton", "ley", "ford", "wick", "mere", "stead", "gate", "holm", "dale", "wyn", "eth"],
  },
  Elven: {
    start: ["Ael", "Aer", "Cael", "El", "Fa", "Gal", "Ith", "Lae", "Lor", "Ma", "Nae", "Ori", "Ria", "Sae", "Sil", "Thae", "Va", "Yl"],
    mid: ["a", "ae", "i", "ia", "el", "il", "or", "ea", "ua", "iel"],
    end: ["iel", "wen", "thil", "rion", "lith", "dore", "anor", "sael", "viel", "wyn", "las", "mere"],
  },
  Dwarven: {
    start: ["Bal", "Brom", "Dain", "Dur", "Gim", "Grim", "Hjal", "Kaz", "Krag", "Mor", "Nor", "Od", "Rur", "Thor", "Ul", "Var"],
    mid: ["a", "o", "i", "ur", "ar", "in", "or", "un"],
    end: ["din", "dur", "grim", "hammer", "forge", "stone", "beard", "hold", "mine", "skar", "gath", "rum"],
  },
  Halfling: {
    start: ["Bil", "Bram", "Cor", "Dap", "Fen", "Fil", "Gil", "Hal", "Mer", "Pip", "Ros", "Sam", "Tob", "Wil"],
    mid: ["a", "o", "i", "er", "in", "el"],
    end: ["bo", "by", "doc", "foot", "goodbody", "hill", "leaf", "pip", "wick", "wise", "berry", "meadow"],
  },
  Orcish: {
    start: ["Bru", "Drak", "Gor", "Grum", "Hag", "Kar", "Krug", "Mor", "Nag", "Ogr", "Rag", "Skab", "Thok", "Ug", "Ur", "Zag"],
    mid: ["a", "o", "u", "ag", "og", "uk", "ar", "or"],
    end: ["ash", "bag", "fang", "gash", "gor", "kull", "maw", "rok", "skull", "snag", "tusk", "zar"],
  },
  Gnomish: {
    start: ["Bim", "Cog", "Dim", "Fiz", "Gim", "Nim", "Pip", "Rin", "Sprock", "Tink", "Wiz", "Zap"],
    mid: ["a", "e", "i", "o", "inkle", "oggle", "ander"],
    end: ["ble", "cog", "fizz", "gear", "nick", "sprocket", "tock", "whistle", "wick", "widget"],
  },
  Draconic: {
    start: ["Aza", "Bala", "Cyn", "Dra", "Ere", "Ix", "Kry", "Mal", "Nyx", "Rha", "Sari", "Tia", "Vex", "Xar", "Zyr"],
    mid: ["a", "e", "i", "o", "ax", "ex", "ith", "or", "ur"],
    end: ["axes", "eth", "ion", "ith", "or", "oth", "ra", "rion", "thas", "vex", "zar", "zul"],
  },
  Celestial: {
    start: ["Aur", "Cae", "Ely", "Fae", "Lum", "Mira", "Ora", "Sera", "Sola", "Theo", "Val", "Zora"],
    mid: ["a", "e", "i", "ia", "el", "ora", "uri"],
    end: ["el", "ia", "iel", "ion", "ora", "phiel", "riel", "sola", "thiel", "wyn"],
  },
  Infernal: {
    start: ["Ab", "Bel", "Cain", "Drav", "Ere", "Ith", "Mal", "Ner", "Paz", "Sar", "Vex", "Zul"],
    mid: ["a", "e", "i", "o", "ag", "ax", "eth", "or", "ur"],
    end: ["az", "eth", "gar", "ith", "oth", "rax", "roth", "tar", "vex", "zul"],
  },
  Giant: {
    start: ["Aur", "Bor", "Dun", "Fjol", "Gorm", "Hrim", "Jor", "Kald", "Nor", "Skad", "Thor", "Ymir"],
    mid: ["a", "o", "u", "al", "or", "un"],
    end: ["gard", "heim", "hild", "jotun", "marr", "stein", "thrym", "vang", "fjell", "skald"],
  },
  Alien: {
    start: ["Xel", "Qor", "Vys", "Zar", "Nex", "Ori", "Tel", "Kai", "Ryn", "Sol", "Uln", "Ix"],
    mid: ["a", "e", "i", "o", "u", "ae", "io", "yx"],
    end: ["ax", "eon", "ith", "on", "or", "ul", "yx", "zar", "tia", "vesk"],
  },
  Cosmic: {
    start: ["Aeth", "Cos", "Eon", "Nyx", "Obl", "Prax", "Quas", "Sar", "Void", "Xen", "Ygg", "Zeph"],
    mid: ["a", "e", "i", "o", "ae", "io", "on", "yr"],
    end: ["aeth", "eon", "ith", "os", "oth", "rax", "ryn", "thys", "vane", "xul"],
  },
};

const PLACE_PATTERNS = [
  (a, b) => `${a}${b}`,
  (a, b) => `${a} ${b}`,
  (a, b) => `${a}'s ${b}`,
  (a, b) => `The ${b} of ${a}`,
  (a, b) => `${a} ${b}`,
];

const PLACE_SUFFIXES = {
  settlement: ["ford", "hold", "haven", "market", "cross", "gate", "watch", "rest", "bridge", "well", "stead", "reach"],
  kingdom: ["Kingdom", "Realm", "Dominion", "Crown", "Throne", "Concord", "League", "Empire", "Protectorate", "Hegemony"],
  region: ["Vale", "March", "Wilds", "Coast", "Reach", "Expanse", "Basin", "Highlands", "Lowlands", "Waste"],
  realm: ["World", "Prime", "Expanse", "Sphere", "Plane", "Realm", "Cluster", "System", "Void"],
};

const PLACE_PREFIXES = [
  "Ash", "Amber", "Black", "Bright", "Broken", "Cinder", "Crimson", "Crystal", "Dark", "Dawn",
  "Dusk", "Ember", "Frost", "Gilded", "Golden", "Grey", "Hollow", "Iron", "Ivory", "Jade",
  "Moon", "Moss", "Obsidian", "Pearl", "Raven", "Red", "Rose", "Salt", "Shadow", "Silver",
  "Star", "Stone", "Storm", "Sun", "Thorn", "Umber", "Verdant", "White", "Wild", "Winter",
];

const OCCUPATIONS = {
  settlement: ["Innkeeper", "Blacksmith", "Merchant", "Guard captain", "Priest", "Herbalist", "Stablemaster", "Baker", "Weaver", "Tanner", "Cooper", "Fisher", "Farmer", "Scribe", "Apothecary", "Cartwright", "Mason", "Miller", "Butcher", "Tailor"],
  city: ["Guildmaster", "Magistrate", "Courtier", "Banker", "Ship captain", "Counter-Intel", "Head librarian", "High priest", "Watch commander", "Master artisan", "Alchemist", "Diplomat", "Tax collector", "Innkeeper", "Merchant prince"],
  ruler: ["Ruler", "Monarch", "High chieftain", "Archduke", "Warlord", "Hierophant", "Council speaker", "Sovereign"],
  court: ["Steward", "Chancellor", "Architect", "General", "Warden", "Counter-Intel"],
  wilderness: ["Hunter", "Trapper", "Ranger", "Hermit", "Prospector", "Guide", "Beast tamer", "Druid", "Courier", "Outrider"],
};

const TRAITS = [
  "Cheerful", "Grim", "Curious", "Cautious", "Bold", "Soft-spoken", "Theatrical", "Meticulous",
  "Warm", "Cold", "Restless", "Patient", "Sarcastic", "Earnest", "Secretive", "Generous",
  "Frugal", "Reckless", "Stoic", "Anxious", "Charismatic", "Plain-spoken", "Dreamy", "Pragmatic",
];

const IDEALS = [
  "Order is the only shield against chaos.", "Freedom is worth any price.", "Knowledge should be shared.",
  "Family and community come first.", "Power belongs to those who seize it.", "Mercy is a strength, not a weakness.",
  "Tradition keeps the world from falling apart.", "Gold is honest; people are not.", "The strong must protect the weak.",
  "A promise is a debt that must be paid.", "Beauty is proof that life is worth living.", "Survival is its own morality.",
];

const BONDS = [
  "A vanished sibling.", "A debt to a local temple.", "A rival whose respect they crave.", "A child studying far away.",
  "A guild that gave them a second chance.", "A secret lover from a rival nation.", "A farm that has been in the family for generations.",
  "A mentor who disappeared.", "A soldier they failed to save.", "A monster they once spared.",
];

const FLAWS = [
  "Cannot resist a wager.", "Trusts the wrong people.", "Holds grudges too long.", "Drinks to forget.",
  "Believes they are always right.", "Freezes under pressure.", "Hoards secrets.", "Spends coin as fast as it comes.",
  "Looks down on outsiders.", "Is terrified of failure.", "Lies to avoid conflict.", "Cannot let go of the past.",
];

const QUIRKS = [
  "Always sharpening a knife.", "Hums old marching songs.", "Keeps a journal of everyone they meet.",
  "Collects strange stones.", "Speaks to animals.", "Refuses to sit with their back to a door.",
  "Wears a faded lucky charm.", "Corrects other people's grammar.", "Brings gifts no one asked for.",
  "Quotes proverbs that make no sense.", "Never drinks water in a new place.", "Taps a rhythm when thinking.",
];

const BACKGROUNDS = [
  "Raised in a crowded tenement above a tannery.", "The only survivor of a border raid.",
  "Apprenticed to a traveling cartographer.", "Fled a noble house after a scandal.",
  "Spent a decade as a caravan guard.", "Studied at a monastery until the money ran out.",
  "Grew up on a fishing boat and still hates dry land.", "Was a soldier until a siege broke their unit.",
  "Inherited a shop and a pile of debts.", "Lived alone in the wilds for three winters.",
  "Served as a court servant and learned every secret.", "Was once a monster hunter's porter.",
  "Escaped a cult in the deep woods.", "Grew up in a city orphanage run by thieves.",
  "Was a miner until the tunnel collapsed.", "Trained as a scribe but never learned to keep quiet.",
];

const VOICES = [
  "Low and measured.", "Quick and bright.", "Hoarse from smoke.", "Soft, almost a whisper.",
  "Musical and theatrical.", "Clipped and formal.", "Rumbling and slow.", "Nervous and uneven.",
];

export function makeRng(seed) {
  let a = 0;
  const text = String(seed ?? "seed");
  for (let i = 0; i < text.length; i += 1) a = (a * 31 + text.charCodeAt(i)) | 0;
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
      const next = [...arr];
      for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    },
  };
}

const syllable = (culture, part, rng) =>
  rng.pick(SYLLABLES[culture]?.[part] || SYLLABLES.Human[part]);

export function generatePersonName(culture = "Human", sex = "", rng = makeRng("name")) {
  const pool = SYLLABLES[culture] ? culture : "Human";
  const first = `${syllable(pool, "start", rng)}${rng.chance(0.55) ? syllable(pool, "mid", rng) : ""}${syllable(pool, "end", rng)}`;
  const last = `${syllable(pool, "start", rng)}${syllable(pool, "end", rng)}`;
  const title = rng.chance(0.22) ? rng.pick(["the Bold", "the Quiet", "the Younger", "the Elder", "of the Vale", "the Wanderer"]) : "";
  return { first, last, full: `${first} ${last}${title ? ` ${title}` : ""}`, sex };
}

export function generateSettlementName(culture, rng, kind = "town") {
  const base = generatePersonName(culture, "", rng).first;
  const suffix = rng.pick(PLACE_SUFFIXES.settlement);
  const prefix = rng.pick(PLACE_PREFIXES);
  const patterns = [
    `${base}${suffix}`,
    `${prefix} ${suffix}`,
    `${prefix}${suffix}`,
    `${base}'s ${suffix}`,
    `${base} ${rng.pick(["Crossing", "Landing", "Hollow", "Rest", "Watch", "Reach"])}`,
  ];
  return rng.pick(patterns);
}

export function generateKingdomName(culture, rng, kind = "kingdom") {
  const base = generatePersonName(culture, "", rng).first;
  const suffix = rng.pick(PLACE_SUFFIXES.kingdom);
  const prefix = rng.pick(PLACE_PREFIXES);
  const patterns = [
    `The ${prefix} ${suffix}`,
    `${base}${rng.pick(["ia", "land", "mark", "heim", "oria", "ath"])}`,
    `The ${suffix} of ${base}`,
    `${prefix} ${suffix}`,
    `${base}'s ${suffix}`,
  ];
  return rng.pick(patterns);
}

export function generateRealmName(culture, rng, kind = "realm") {
  const base = generatePersonName(culture, "", rng).first;
  const suffix = rng.pick(PLACE_SUFFIXES.realm);
  return rng.pick([
    `${base} ${suffix}`,
    `The ${rng.pick(PLACE_PREFIXES)} ${suffix}`,
    `${base}${rng.pick(["ar", "os", "ea", "um", "is"])}`,
    `The ${suffix} of ${base}`,
  ]);
}

export function generateTavernName(rng) {
  return rng.pick([
    `The ${rng.pick(["Gilded", "Laughing", "Broken", "Sleeping", "Drunken", "Silver", "Black", "Red"])} ${rng.pick(["Griffin", "Crown", "Anchor", "Lantern", "Boar", "Dragon", "Cup", "Stag", "Wyrm", "Bell"])}`,
    `The ${rng.pick(["Prancing", "Wandering", "Hungry", "Singing"])} ${rng.pick(["Pony", "Bard", "Ogre", "Fox", "Kettle"])}`,
    `${rng.pick(["Mother", "Old", "Captain"])} ${generatePersonName("Human", "", rng).last}'s`,
  ]);
}

export function generatePersonality(rng) {
  return {
    trait: rng.pick(TRAITS),
    ideal: rng.pick(IDEALS),
    bond: rng.pick(BONDS),
    flaw: rng.pick(FLAWS),
    quirk: rng.pick(QUIRKS),
    voice: rng.pick(VOICES),
    background: rng.pick(BACKGROUNDS),
  };
}

export function occupationFor(role, settlementKind, rng) {
  if (OCCUPATIONS[role]) return rng.pick(OCCUPATIONS[role]);
  if (settlementKind === "capital" || settlementKind === "city") return rng.pick(OCCUPATIONS.city);
  if (settlementKind === "wilderness") return rng.pick(OCCUPATIONS.wilderness);
  return rng.pick(OCCUPATIONS.settlement);
}

// Stored starting attitude. Court and rulers side with their own kingdom;
// ordinary people lean indifferent but can be trusting, friendly or hostile.
function initialDisposition(role, rng) {
  if (role === "ruler" || role === "court") return "allied";
  const roll = rng.rand();
  if (roll > 0.86) return "friendly";
  if (roll > 0.64) return "trusting";
  if (roll > 0.16) return "indifferent";
  if (roll > 0.05) return "hostile";
  return "hated";
}

export function generateNpc({ culture = "Human", role = "settlement", settlementKind = "town", rng, settlementId = "", nationId = "" }) {
  const sex = rng.pick(["female", "male", "nonbinary"]);
  const name = generatePersonName(culture, sex, rng);
  const age = rng.int(16, 72);
  const abilities = Object.fromEntries(
    ["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((key) => [key, rng.int(8, 16)])
  );
  const roleAbility = {
    Steward: "INT",
    Chancellor: "CHA",
    Architect: "WIS",
    General: "STR",
    Warden: "CON",
    "Counter-Intel": "DEX",
    Ruler: "CHA",
  }[role];
  if (roleAbility) abilities[roleAbility] = rng.int(14, 18);
  return {
    id: `npc_${Math.floor(rng.rand() * 1e9).toString(36)}`,
    name: name.full,
    first: name.first,
    last: name.last,
    sex,
    age,
    abilities,
    culture,
    role,
    occupation: occupationFor(role, settlementKind, rng),
    personality: generatePersonality(rng),
    disposition: initialDisposition(role, rng),
    settlementId,
    nationId,
    homeBuildingId: "",
    workBuildingId: "",
    status: "Alive",
    notes: "",
  };
}
