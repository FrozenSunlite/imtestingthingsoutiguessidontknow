// Homebuilder rules data: economic stations, property ownership, facility
// types, furnishings and the gold/time math from the Bastions & Property
// homebrew. The plot grid measures everything in "spaces" (1 space = one
// 5 ft square, so a 5x5 ft room fills exactly one grid space).

export const CELL = 32; // canvas pixels per grid space

// Economic Stations & Property Values (Chapter 1). fac is "Vast/Roomy/Cramped"
// — the basic facilities a property of that comfort should expect. land is the
// undeveloped land table (cost, total spaces of development capacity).
export const STATIONS = {
  wretched: { label: "Wretched", income: 1, value: 0, rent: 0, mortgage: 0, fac: [0, 0, 0], land: { cost: 0, spaces: 4 } },
  squalid: { label: "Squalid", income: 10, value: 400, rent: 2, mortgage: 5, fac: [0, 0, 1], land: { cost: 100, spaces: 16 } },
  poor: { label: "Poor", income: 25, value: 1000, rent: 5, mortgage: 12.5, fac: [0, 1, 3], land: { cost: 250, spaces: 64 } },
  modest: { label: "Modest", income: 100, value: 3500, rent: 20, mortgage: 43.75, fac: [1, 2, 6], land: { cost: 750, spaces: 128 } },
  comfortable: { label: "Comfortable", income: 250, value: 7000, rent: 50, mortgage: 87.5, fac: [2, 4, 12], land: { cost: 1500, spaces: 256 } },
  wealthy: { label: "Wealthy", income: 500, value: 18000, rent: 100, mortgage: 225, fac: [4, 8, 24], land: { cost: 4000, spaces: 512 } },
  aristocratic: { label: "Aristocratic", income: 1000, value: 50000, rent: 200, mortgage: 625, fac: [8, 16, 48], land: { cost: 10000, spaces: 1024 } },
};
export const COMFORT_LEVELS = [
  "wretched", "squalid", "poor", "modest", "comfortable", "wealthy", "aristocratic",
];

// Living quality effects for a property used as a primary residence, keyed by
// comfort level. Resting outside of a property always uses Squalid, unless
// some other means of lodging applies.
export const LIVING_QUALITY = {
  wretched: {
    food: "The bugs in the dirt — eating this for sustenance instead of rations needs a DC 15 Constitution save or Filth Fever for 1d4−1 (minimum 1) weeks.",
    rest: "Long Rests subtract 1 hit die — run out and you make a Death Saving Throw instead (add your Constitution).",
    recovery: "Disadvantage on saving throws against disease.",
    note: "Also used when starving — traveling without rations and a waterskin and nothing scavenged.",
  },
  squalid: {
    food: "Poor quality, barely edible — eating this instead of rations needs a DC 10 Constitution save or Filth Fever for 1d6 days.",
    rest: "Long rests restore no hit dice.",
    recovery: "No benefit to saving throws against disease.",
  },
  poor: {
    food: "Basic sustenance, no flavor.",
    rest: "Long rests restore 1 hit die.",
    recovery: "No benefit to saving throws against disease.",
    note: "Tool or instrument proficiency lets you odd-job your way into lodging here — a long rest's worth of time each day, but it doesn't count as a rest.",
  },
  modest: {
    food: "Simple but nutritious meals — 1d4 temporary hit points.",
    rest: "Long rests restore half your hit dice (minimum 1).",
    recovery: "Advantage vs common diseases; recover 1 level of exhaustion after 2 long rests over 2 days.",
  },
  comfortable: {
    food: "Well-prepared, varied meals — 2d4 temporary hit points.",
    rest: "Long rests restore half your hit dice (minimum 1).",
    recovery: "Advantage vs all diseases; recover 1 level of exhaustion per long rest.",
    note: "Survival proficiency lets you live at this level off your surroundings — a long rest's worth of time each day, and obvious to onlookers.",
  },
  wealthy: {
    food: "Gourmet meals prepared by skilled cooks — 2d6 temporary hit points.",
    rest: "Long rests restore all hit dice.",
    recovery: "Advantage vs disease and poison; recover 1 level of exhaustion per long rest.",
  },
  aristocratic: {
    food: "Exquisite cuisine with rare ingredients — 3d6 temporary hit points.",
    rest: "Long rests restore all hit dice, plus hit points equal to your level.",
    recovery: "Advantage on all Constitution saving throws; all exhaustion clears after a long rest.",
  },
};

export const OWNERSHIP = [
  { id: "purchased", label: "Purchased outright", note: "5% of property value in legal fees on transfer." },
  { id: "mortgaged", label: "Mortgage", note: "Property value +25%, 10% down; miss 3 payments and it's foreclosed." },
  { id: "rented", label: "Rented", note: "No structural changes; business conversion needs landlord permission (DC 20)." },
  { id: "granted", label: "Granted as reward", note: "Owned free and clear; may carry service conditions." },
  { id: "land", label: "Undeveloped land", note: "Building your own facilities costs half the standard gp." },
];

// Placeable facility structures. Cost is gold, weeks is build time —
// "costPerSpace" types scale with area, "weeksPerArea" types take one week per
// N spaces. resizable ones can be resized in the details panel.
export const FACILITY_TYPES = {
  Cramped: { w: 2, h: 2, spaces: 4, cost: 500, weeks: 3, desc: "2×2 basic facility — 500 gp, 3 weeks" },
  Roomy: { w: 4, h: 4, spaces: 16, cost: 1000, weeks: 7, desc: "4×4 basic facility — 1,000 gp, 7 weeks" },
  Vast: { w: 6, h: 6, spaces: 36, cost: 2500, weeks: 12, desc: "6×6 basic facility — 2,500 gp, 12 weeks" },
  Courtyard: { w: 6, h: 6, cost: 0, weeksPerArea: 9, resizable: true, minSpaces: 9, desc: "Fenced yard — 1 week per 9 spaces, no gold cost" },
  Porch: { w: 2, h: 3, costPerSpace: 25, weeks: 1, resizable: true, minSpaces: 6, desc: "25 gp per space, 1 week. 2×3 spaces. Limit 1 per entrance" },
  Balcony: { w: 1, h: 3, costPerSpace: 25, weeks: 1, resizable: true, minSpaces: 3, desc: "25 gp per space, 1 week. 1×3 spaces, placed on the floor above" },
  Tower: { w: 2, h: 2, cost: 1000, weeks: 4, desc: "1,000 gp, 4 weeks — 3 cramped facilities across 3 floors, 360° view" },
};

// DMG'24 Bastion special facilities (Chapter 2). Unlike basic facilities they
// can't be bought: a character claims each one free of gold and build time
// when their level unlocks the tier, and may swap one per level-up. Space is
// the entry's default facility space, mapped to the same grid sizes as the
// basic facility types (Cramped 2×2, Roomy 4×4, Vast 6×6). "multi" marks the
// four facilities the DMG allows in multiples; all others are unique.
export const BASTION_LEVELS = [5, 9, 13, 17];
export const BASTION_FACILITIES = [
  // Level 5 — two are chosen when the Bastion is claimed
  { name: "Arcane Study", level: 5, space: "Roomy", hirelings: 1, prereq: "Ability to use an Arcane Focus or a tool as a Spellcasting Focus" },
  { name: "Armory", level: 5, space: "Roomy", hirelings: 1, prereq: "" },
  { name: "Barrack", level: 5, space: "Roomy", hirelings: 0, prereq: "", multi: true },
  { name: "Garden", level: 5, space: "Roomy", hirelings: 1, prereq: "", multi: true },
  { name: "Library", level: 5, space: "Roomy", hirelings: 1, prereq: "" },
  { name: "Sanctuary", level: 5, space: "Roomy", hirelings: 1, prereq: "Ability to use a Holy Symbol or Druidic Focus as a Spellcasting Focus" },
  { name: "Smithy", level: 5, space: "Roomy", hirelings: 2, prereq: "" },
  { name: "Storehouse", level: 5, space: "Roomy", hirelings: 1, prereq: "" },
  { name: "Workshop", level: 5, space: "Roomy", hirelings: 2, prereq: "" },
  // Level 9 — two more
  { name: "Gaming Hall", level: 9, space: "Vast", hirelings: 4, prereq: "" },
  { name: "Greenhouse", level: 9, space: "Roomy", hirelings: 1, prereq: "" },
  { name: "Laboratory", level: 9, space: "Roomy", hirelings: 1, prereq: "" },
  { name: "Sacristy", level: 9, space: "Roomy", hirelings: 1, prereq: "Ability to use a Holy Symbol or Druidic Focus as a Spellcasting Focus" },
  { name: "Scriptorium", level: 9, space: "Roomy", hirelings: 1, prereq: "" },
  { name: "Stable", level: 9, space: "Roomy", hirelings: 1, prereq: "", multi: true },
  { name: "Teleportation Circle", level: 9, space: "Roomy", hirelings: 0, prereq: "" },
  { name: "Theater", level: 9, space: "Vast", hirelings: 4, prereq: "" },
  { name: "Training Area", level: 9, space: "Vast", hirelings: 4, prereq: "", multi: true },
  { name: "Trophy Room", level: 9, space: "Roomy", hirelings: 1, prereq: "" },
  // Level 13 — one more
  { name: "Archive", level: 13, space: "Roomy", hirelings: 1, prereq: "" },
  { name: "Meditation Chamber", level: 13, space: "Cramped", hirelings: 0, prereq: "" },
  { name: "Menagerie", level: 13, space: "Vast", hirelings: 2, prereq: "" },
  { name: "Observatory", level: 13, space: "Roomy", hirelings: 1, prereq: "Ability to use a Spellcasting Focus" },
  { name: "Pub", level: 13, space: "Roomy", hirelings: 1, prereq: "" },
  { name: "Reliquary", level: 13, space: "Cramped", hirelings: 1, prereq: "Ability to use a Holy Symbol or Druidic Focus as a Spellcasting Focus" },
  // Level 17 — the last one
  { name: "Demiplane", level: 17, space: "Vast", hirelings: 0, prereq: "Ability to use an Arcane Focus or a tool as a Spellcasting Focus" },
  { name: "Guildhall", level: 17, space: "Vast", hirelings: 0, prereq: "Expertise in a skill" },
  { name: "Sanctum", level: 17, space: "Roomy", hirelings: 4, prereq: "Ability to use a Holy Symbol or Druidic Focus as a Spellcasting Focus" },
  { name: "War Room", level: 17, space: "Vast", hirelings: 0, prereq: "Fighting Style or Unarmored Defense feature" },
  // Facility sets from later source books, level-gated only — their
  // membership / renown prerequisites are cut for homebrew play.
  // Forgotten Realms: Heroes of Faerûn
  { name: "Amethyst Dragon Den", level: 5, space: "Vast", hirelings: 1, prereq: "", source: "Forgotten Realms" },
  { name: "Harper Hideout", level: 5, space: "Roomy", hirelings: 1, prereq: "", source: "Forgotten Realms" },
  { name: "Red Wizard Necropolis", level: 5, space: "Roomy", hirelings: 1, prereq: "", source: "Forgotten Realms" },
  { name: "Zhentarim Travel Station", level: 5, space: "Vast", hirelings: 2, prereq: "", source: "Forgotten Realms" },
  { name: "Emerald Enclave Grove", level: 9, space: "Vast", hirelings: 2, prereq: "", source: "Forgotten Realms" },
  { name: "Lords' Alliance Noble Residence", level: 9, space: "Vast", hirelings: 1, prereq: "", source: "Forgotten Realms" },
  { name: "Order of the Gauntlet Tournament Field", level: 9, space: "Vast", hirelings: 1, prereq: "", source: "Forgotten Realms" },
  { name: "Cult of the Dragon Archive", level: 13, space: "Roomy", hirelings: 1, prereq: "", source: "Forgotten Realms" },
  // Eberron: Forge of the Artificer
  { name: "Dragonmark Outpost", level: 5, space: "Roomy", hirelings: 1, prereq: "", source: "Eberron" },
  { name: "Kundarak Vault", level: 9, space: "Cramped", hirelings: 1, prereq: "", source: "Eberron" },
  { name: "Navigator's Helm", level: 9, space: "Cramped", hirelings: 1, prereq: "", source: "Eberron" },
  { name: "Orien Helm", level: 9, space: "Cramped", hirelings: 1, prereq: "", source: "Eberron" },
  { name: "Artificer's Forge", level: 13, space: "Roomy", hirelings: 2, prereq: "", source: "Eberron" },
  { name: "Inquisitive Agency", level: 13, space: "Roomy", hirelings: 1, prereq: "", source: "Eberron" },
  { name: "Lyrandar Helm", level: 13, space: "Cramped", hirelings: 1, prereq: "", source: "Eberron" },
  { name: "Manifest Zone", level: 13, space: "Vast", hirelings: 1, prereq: "", source: "Eberron" },
  { name: "Museum", level: 13, space: "Roomy", hirelings: 1, prereq: "", source: "Eberron" },
  { name: "Construct Forge", level: 17, space: "Vast", hirelings: 2, prereq: "", source: "Eberron" },
  // Ravenloft: The Horrors Within
  { name: "Rookery", level: 5, space: "Cramped", hirelings: 1, prereq: "", source: "Ravenloft" },
  { name: "Séance Parlor", level: 5, space: "Cramped", hirelings: 1, prereq: "", source: "Ravenloft" },
  { name: "Ancient Altar", level: 9, space: "Cramped", hirelings: 1, prereq: "", source: "Ravenloft" },
  { name: "Cabinet of Curiosities", level: 9, space: "Cramped", hirelings: 1, prereq: "", source: "Ravenloft" },
  { name: "Infirmary", level: 9, space: "Roomy", hirelings: 2, prereq: "", source: "Ravenloft" },
  { name: "Lightning Generator", level: 13, space: "Roomy", hirelings: 1, prereq: "", source: "Ravenloft" },
  { name: "Spirit Vault", level: 13, space: "Roomy", hirelings: 1, prereq: "", source: "Ravenloft" },
  { name: "Liminal Space", level: 17, space: "Vast", hirelings: 1, prereq: "", source: "Ravenloft" },
  // Arcana Unleashed
  { name: "Entertainment Salon", level: 5, space: "Roomy", hirelings: 2, prereq: "", source: "Arcana Unleashed" },
  { name: "Geothermal Vent", level: 5, space: "Roomy", hirelings: 1, prereq: "", source: "Arcana Unleashed" },
  { name: "Morgue", level: 5, space: "Cramped", hirelings: 1, prereq: "", source: "Arcana Unleashed" },
  { name: "Soup Kitchen", level: 5, space: "Roomy", hirelings: 1, prereq: "", source: "Arcana Unleashed" },
  { name: "Transmutation Vat", level: 5, space: "Cramped", hirelings: 1, prereq: "", source: "Arcana Unleashed" },
  { name: "Circus Tent", level: 9, space: "Vast", hirelings: 4, prereq: "", source: "Arcana Unleashed" },
  { name: "Heist Planning Chamber", level: 9, space: "Roomy", hirelings: 1, prereq: "", source: "Arcana Unleashed" },
  { name: "Lighthouse", level: 9, space: "Roomy", hirelings: 1, prereq: "", source: "Arcana Unleashed" },
  { name: "Planar Gateway", level: 17, space: "Roomy", hirelings: 1, prereq: "", source: "Arcana Unleashed" },
];

export const bastionFacilityByName = (name) => BASTION_FACILITIES.find((b) => b.name === name);

export const CONNECTION_TYPES = [
  { type: "Corridor", desc: "Hallway space — 25 gp, 1 week. May be built as unfurnishable empty space." },
  { type: "Doorway", desc: "Drag along a wall or a room's frame to draw the door. 25 gp, 1 week." },
  { type: "Window", desc: "Drag along a wall or a room's frame to add a window. 25 gp, 1 week." },
  { type: "Staircase", desc: "1 space per floor connected — 25 gp, 1 week." },
  { type: "Ramp", desc: "1 space per floor connected — 25 gp, 1 week." },
];

// Per-facility attachments: extra floor space above/below one facility.
export const ATTACHMENTS = {
  attic: {
    label: "Attic", costPerSpace: 50, weeks: 2, limit: 1,
    allowed: ["Bedroom", "Sun/Wet Room", "Closet", "Living Room"],
    desc: "50 gp per space, 2 weeks. Limit 1 per facility; no facility above this one.",
  },
  cellar: {
    label: "Cellar", costPerSpace: 50, weeks: 2, limit: 1,
    allowed: ["Bedroom", "Sun/Wet Room", "Kitchen", "Vault", "Storage Room"],
    desc: "50 gp per space, 2 weeks. Limit 1 per facility; no facility below this one.",
  },
  floor: {
    label: "Floor", costPerSpace: 50, weeks: 2, limit: 1,
    allowed: ["Bedroom", "Sun/Wet Room", "Closet", "Living Room", "Storage Room", "Kitchen"],
    desc: "50 gp per space, 2 weeks. Adds an upper storey to this facility.",
  },
};

export const FURNISH_CATS = ["Living", "Social", "Storage", "Business", "Outdoor", "Misc"];

// Furnishings: foot is the default footprint (w×h spaces); min is the minimum
// number of spaces (footprints can be enlarged, never shrunk below min).
// options are "chosen at creation" picks; businessOnly rooms are only allowed
// on a business property.
export const FURNISHINGS = [
  // Essential living
  { name: "Bedroom", cat: "Living", foot: [2, 1], min: 2, req: "None", benefits: "Each comfort level provides +1 Hit Die recovered on a long rest here. Shared with unfriendly occupants: no benefit. One bunk bed may be stacked on top (two total)." },
  { name: "Kitchen", cat: "Living", foot: [1, 1], min: 1, req: "1 space per 2 residents, in a line or elbow", benefits: "Essential for food preparation — prevents food quality from dropping to Squalid. Also usable as Cook's Utensils." },
  { name: "Sun/Wet Room", cat: "Living", foot: [2, 2], min: 4, options: ["Sun Room", "Wet Room"], req: "Chosen at creation", benefits: "Sun Room: sunlight for plant-based creatures. Wet Room: submersion for aquatic creatures." },
  { name: "Privy", cat: "Living", foot: [1, 1], min: 1, req: "5 gp per month in cleaning fees", benefits: "Waste disposal without leaving the property. Conversations in a facility sharing an unisolated Privy: Disadvantage on Charisma (Persuasion). May sit outside, within 10 spaces, on owned land." },
  { name: "Bathhouse", cat: "Living", foot: [2, 1], min: 2, req: "Water source within 1 mile", benefits: "Bathing here grants advantage on saving throws against disease for 24 hours. Doubles as a social space." },
  { name: "Nursery", cat: "Living", foot: [2, 1], min: 2, req: "Same facility as 1 Bedroom; 1 Hireling per 4 Nurseries (optional if never away over a day)", benefits: "Advantage on saving throws against fear for 24 hours after spending time with your children here. A Wetnurse covers up to four Nurseries (permanent resident, needs a Bedroom)." },
  { name: "Washateria", cat: "Living", foot: [2, 1], min: 2, req: "Water source within 1 mile", benefits: "Prevents disease and dirt spread among occupants while used 1 hour per occupant. A hireling can tend the wardrobes." },
  // Social & gathering
  { name: "Dining Room", cat: "Social", foot: [1, 1], min: 1, req: "1 space per guest; no wider than 2 spaces", benefits: "When 2+ creatures share a meal here, all patrons gain Inspiration (once per day across all Dining Rooms). Actual dining only." },
  { name: "Parlor", cat: "Social", foot: [2, 2], min: 4, options: ["Any musical instrument (chosen at creation)"], req: "None", benefits: "Advantage on Charisma (Persuasion) and (Deception) with Comfortable-or-higher guests. Usable as one musical instrument." },
  { name: "Living Room", cat: "Social", foot: [3, 1], min: 3, options: ["Any gaming set (chosen at creation)"], req: "None", benefits: "Advantage on Charisma (Persuasion) and (Deception) with Modest-or-lower guests. Usable as one gaming set." },
  { name: "Conservatory", cat: "Social", foot: [3, 3], min: 9, req: "Ground floor with windows, or a courtyard", benefits: "Advantage on Performance checks here; can host recitals. Vibrant plants grant weekly Inspiration for leisure time spent here." },
  // Storage & utility
  { name: "Storage Room", cat: "Storage", foot: [1, 1], min: 1, req: "None", benefits: "Stores 250 lbs of non-wearable items per space (foodstuffs, treasure, bulk goods). Guests may temporarily store belongings." },
  { name: "Closet", cat: "Storage", foot: [1, 1], min: 1, req: "None", benefits: "Stores 125 lbs of wearable items per space." },
  { name: "Vault", cat: "Storage", foot: [3, 2], min: 6, limit: 1, req: "Adjacent to a Safe Room; may sit outside a Cellar's bounds", benefits: "Secure storage: DC 25 to break in. 2,000 lbs of storage per 6 spaces." },
  { name: "Guard Post", cat: "Storage", foot: [2, 1], min: 2, req: "1 Hireling (permanent resident, needs a Bedroom)", benefits: "The stationed hireling grants advantage on Perception to detect and combat intruders; monitors all entry points." },
  { name: "Pantry", cat: "Storage", foot: [2, 1], min: 2, req: "Must be adjacent to a Kitchen", benefits: "Doubles food preservation and prevents spoilage. Stockpiles 2 weeks of food per space." },
  // Business & commercial (business property only)
  { name: "Workstation", cat: "Business", foot: [2, 1], min: 2, businessOnly: true, options: ["Any Artisan's Tool or other tool (chosen at creation)"], req: "1 Hireling", benefits: "Required for hirelings to work. Grants one type of Tool. May sit in a courtyard for industrial work; +50 gp roofs it against weather." },
  { name: "Till Counter", cat: "Business", foot: [1, 1], min: 1, limit: 2, businessOnly: true, req: "1 Hireling", benefits: "Required for retail sales. Counts as a Workstation for one hireling. Outside Covered Stall: 50 gp, 2 spaces." },
  { name: "Ledger Room", cat: "Business", foot: [3, 1], min: 3, limit: 1, businessOnly: true, req: "1 Hireling", benefits: "Required for the Resupply action. Trade Route limit 10; up to 4 Couriers at 15 gp/month each." },
  { name: "Showroom", cat: "Business", foot: [3, 1], min: 3, limit: 1, businessOnly: true, req: "Adjacent to a Till Counter (1 per Till)", benefits: "Displaying stockpiled goods here adds +1d6 gp to every passed Harvest Action. Hosts client viewings." },
  { name: "Counting House", cat: "Business", foot: [2, 2], min: 4, limit: 1, businessOnly: true, req: "1 Hireling; adjacent to the Ledger Room", benefits: "Required for multiple locations; prevents the running-multi-business Disadvantage up to 6 businesses. +1d6 gp to every passed Harvest Action and Trade Route." },
  { name: "Safe Room", cat: "Business", foot: [3, 2], min: 6, limit: 1, req: "Ground floor or cellar", benefits: "Secure refuge: DC 25 to break in. Defenders here have three-quarters cover. Emergency storage." },
  { name: "Chancery", cat: "Business", foot: [2, 2], min: 4, businessOnly: true, req: "Business with a Ledger Room", benefits: "+1 on Charisma (Persuasion) business-negotiation checks in this room per Comfort Level of the property." },
  { name: "Shipping & Receiving", cat: "Business", foot: [3, 2], min: 6, limit: 1, businessOnly: true, req: "Business with a Ledger Room", benefits: "Resupply benefits +2; nonmagical items purchasable at a 10% discount." },
  // Outdoor & specialized
  { name: "Wagonstation", cat: "Outdoor", foot: [2, 2], min: 4, limit: 4, businessOnly: true, req: "1 Hireling", benefits: "Stores one carriage-sized ground vehicle; tools to build/maintain Land Vehicles. Enables a Trade Route (Cart −1d6 gp, Wagon 0, Carriage +1d6 gp)." },
  { name: "Fishing Dock", cat: "Outdoor", foot: [4, 3], min: 11, limit: 2, businessOnly: true, outdoor: true, req: "Courtyard next to water; 3 Hirelings", benefits: "Tools for Water Vehicles. 8 hours fishing raises food quality one level for two weeks. Stores 2 rowboats; +2d6 gp/week during Harvest; a stored boat can run a Trade Route." },
  { name: "Airship Dock", cat: "Outdoor", foot: [4, 8], min: 32, limit: 1, businessOnly: true, outdoor: true, req: "Rooftop or courtyard; 5 Hirelings per Airship", benefits: "Stores one Airship ≤32 spaces or two ≤16 spaces. Tools for Air Vehicles. Each Airship provides two Trade Routes, immune to bandits and pirates." },
  { name: "Animal Pen", cat: "Outdoor", foot: [4, 3], min: 12, outdoor: true, req: "Courtyard; 2 Hirelings across all Pens", benefits: "Houses a beast of burden, 1 cow, 2 pigs or 10 chickens. 3 gp/month upkeep (chickens instead earn 3 gp/week each and keep food quality at Poor+ with 4+ hens). Pigs: buy 4 gp / sell 10 gp; cows: buy 8 gp / sell 20 gp — once per week, one or the other." },
  { name: "Apiary", cat: "Outdoor", foot: [4, 2], min: 7, outdoor: true, req: "Courtyard; 1 Closet for gear; no benefits in Winter", benefits: "+1d6 gp of honey and wax each Harvest, regardless of results." },
  { name: "Supply Shed", cat: "Outdoor", foot: [2, 2], min: 4, outdoor: true, req: "Courtyard, outdoors only", benefits: "Stores up to 400 lbs of items per space; walled, with door and roof." },
  { name: "Stockhouse", cat: "Outdoor", foot: [2, 2], min: 4, outdoor: true, req: "Courtyard, outdoors only", benefits: "Stores 2 weeks of business Supply per space (see Resupply)." },
  { name: "Garden", cat: "Outdoor", foot: [2, 2], min: 4, outdoor: true, req: "1 gp fertilizer per 8 spaces (waived by a Stable or Animal Pen, with 1 hour of tending)", benefits: "Grows 2 lbs of one fruit or vegetable per week per space (not in Winter); 4 weeks to first harvest. 2 lbs convert to 1 Ration in a Kitchen." },
  { name: "Farmland", cat: "Outdoor", foot: [2, 2], min: 4, outdoor: true, req: "1 gp fertilizer per 8 spaces (waived by owning 2 pigs, with 1 hour of tending)", benefits: "Grows 2 lbs of one root or grain per week per space (no grain in Winter); 4 weeks to first harvest. 2 lbs convert to 1 Ration in a Kitchen." },
  { name: "Greenhouse", cat: "Outdoor", foot: [2, 2], min: 4, outdoor: true, req: "Outdoors only; may attach to a facility or connection with space for a door", benefits: "Year-round production for any Garden, Farmland or Apiary contained within it." },
  // Miscellaneous
  { name: "Infirmary", cat: "Misc", foot: [3, 2], min: 6, req: "1 Hireling (permanent resident, needs a Bedroom)", benefits: "Advantage on Medicine checks; short rests here restore +3 hit dice at the cost of one exhaustion level. Treats 2 patients per 6 spaces; usable as Alchemist's, Herbalism or Poisoner's Kit; treatment 5 gp per person." },
  { name: "Brewery", cat: "Misc", foot: [3, 2], min: 6, businessOnly: true, req: "Business, indoors; 12 spaces of Garden (fruit) or Farmland (hops) per 6 spaces of Brewery; 1 Hireling", benefits: "One barrel (mead, fruit cider, honeyed mead, vinegar or wine) every 4 weeks: +3d6 gp per Harvest starting 4 weeks after production; counts as a Workstation. Honeyed mead needs an Apiary (+2d6 instead of its honey bonus)." },
  { name: "Taverny", cat: "Misc", foot: [2, 2], min: 4, businessOnly: true, req: "Business; 2 Hirelings per 6 tables; 3 spaces of Kitchen per 6 tables; 1 Till Counter; weekly food and drink requirements", benefits: "While open: +1d6 gp per table on every Harvest check, plus +1 gp per table per extra drink, meat source and plant type. Missing supplies convert a Trade Route into a paid Supply Route." },
];

// Attic / cellar room allow-lists use these names; Storage Room is listed in
// the homebrew as "Storage".
export const furnishingByName = (name) => FURNISHINGS.find((f) => f.name === name);

export const OWNERSHIP_BY_ID = Object.fromEntries(OWNERSHIP.map((o) => [o.id, o]));

let uidCounter = 0;
export const uid = () =>
  `${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const PLOT_KINDS = [
  { id: "home", label: "Home / Apartment", kinds: ["home"] },
  { id: "business", label: "Business", kinds: ["business"] },
  { id: "bastion", label: "Bastion", kinds: ["bastion"] },
  // Hybrid plots: one property that mixes two or all three roles. Business
  // furnishings unlock, and home + bastion roles stack.
  { id: "hybrid-home-business", label: "Home + Business", kinds: ["home", "business"] },
  { id: "hybrid-home-bastion", label: "Home + Bastion", kinds: ["home", "bastion"] },
  { id: "hybrid-business-bastion", label: "Business + Bastion", kinds: ["business", "bastion"] },
  { id: "hybrid-all", label: "Home + Business + Bastion", kinds: ["home", "business", "bastion"] },
];

export const PLOT_KIND_BY_ID = Object.fromEntries(PLOT_KINDS.map((k) => [k.id, k]));

// Which base roles a plot serves — hybrid kinds list several.
export const plotKinds = (plot) =>
  PLOT_KIND_BY_ID[plot?.kind]?.kinds ||
  (Array.isArray(plot?.kinds) && plot.kinds.length ? plot.kinds : ["home"]);

export const plotHasKind = (plot, kind) => plotKinds(plot).includes(kind);

export const plotKindLabel = (plot) =>
  plotKinds(plot)
    .map((k) => ({ home: "Home", business: "Business", bastion: "Bastion" }[k]))
    .join(" + ");

const KIND_DEFAULT_NAMES = {
  home: "My Home",
  business: "My Business",
  bastion: "My Bastion",
  "hybrid-home-business": "My Home & Business",
  "hybrid-home-bastion": "My Home & Bastion",
  "hybrid-business-bastion": "My Business & Bastion",
  "hybrid-all": "My Home, Business & Bastion",
};

export function blankPlot(kind = "home") {
  return {
    id: uid(),
    name: KIND_DEFAULT_NAMES[kind] || "My Home",
    kind,
    ownership: kind === "home" ? "purchased" : "land",
    comfort: "modest",
    landTier: "modest",
    mortgageTotal: 0,
    mortgagePaid: 0,
    staff: 0,
    charLevel: 5,
    notes: "",
    floors: [{ id: uid(), name: "1st Floor", index: 0 }],
    facilities: [],
    furnishings: [],
    connections: [],
    walls: [],
  };
}

export const clonePlot = (p) => JSON.parse(JSON.stringify(p));

// "1st", "2nd", "3rd"… for floor names.
export const ordinal = (n) =>
  `${n}${["th", "st", "nd", "rd"][n % 10 > 3 || Math.floor((n % 100) / 10) === 1 ? 0 : n % 10] || "th"}`;

// First free spot for a w×h room placed inside facility fac, given the
// attachment's already-placed rooms as facility-relative rects. Returns
// relative { x, y } or null when nothing fits.
export function firstFitRoom(fac, items, w, h) {
  for (let y = 0; y + h <= fac.h; y++)
    for (let x = 0; x + w <= fac.w; x++)
      if (!items.some((it) => overlaps({ x, y, w, h }, it))) return { x, y };
  return null;
}

// Facilities / attachments on one floor.
export const floorFacilities = (plot, floorId) =>
  (plot.facilities || []).filter((f) => f.floorId === floorId);

export const floorFurnishings = (plot, floorId) =>
  (plot.furnishings || []).filter((fu) => {
    const fac = (plot.facilities || []).find((f) => f.id === fu.facilityId);
    return fac ? fac.floorId === floorId : true; // loose (outdoor) items live on their floor
  });

export const floorConnections = (plot, floorId) =>
  (plot.connections || []).filter((c) => c.floorId === floorId);

// Wall and fence runs on one floor.
export const floorWalls = (plot, floorId) =>
  (plot.walls || []).filter((wl) => wl.floorId === floorId);

export const overlaps = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const rectsOverlap = (a, list, ignoreId) =>
  list.some((b) => b.id !== ignoreId && overlaps(a, b));

// The grid-line segments a door may be drawn along on one floor: the line of
// an interior wall, both edges of every thick wall or fence run, and the
// frame of every room (facility) rectangle.
export const doorHostSpans = (plot, floorId) => {
  const horiz = [], vert = [];
  for (const wl of plot.walls || []) {
    if (wl.floorId !== floorId) continue;
    if (wl.type === "Interior Wall") {
      if (wl.h === 1) horiz.push({ line: wl.y, lo: wl.x, hi: wl.x + wl.w });
      else vert.push({ line: wl.x, lo: wl.y, hi: wl.y + wl.h });
    } else {
      horiz.push({ line: wl.y, lo: wl.x, hi: wl.x + wl.w });
      horiz.push({ line: wl.y + 1, lo: wl.x, hi: wl.x + wl.w });
      vert.push({ line: wl.x, lo: wl.y, hi: wl.y + wl.h });
      vert.push({ line: wl.x + 1, lo: wl.y, hi: wl.y + wl.h });
    }
  }
  for (const f of plot.facilities || []) {
    if (f.floorId !== floorId) continue;
    horiz.push({ line: f.y, lo: f.x, hi: f.x + f.w });
    horiz.push({ line: f.y + f.h, lo: f.x, hi: f.x + f.w });
    vert.push({ line: f.x, lo: f.y, hi: f.y + f.h });
    vert.push({ line: f.x + f.w, lo: f.y, hi: f.y + f.h });
  }
  return { horiz, vert };
};

// Is [lo, hi] fully covered by the union of the given [start, end] spans?
const coveredBy = (spans, lo, hi) => {
  let reach = lo;
  for (const [s, e] of [...spans].sort((a, b) => a[0] - b[0])) {
    if (s > reach) return false;
    reach = Math.max(reach, e);
    if (reach >= hi) return true;
  }
  return reach >= hi;
};

// A drawn door {x, y, w, h} (h = 1 horizontal, w = 1 vertical — the door's
// line runs along the top / left grid line of its cells, like an interior
// wall) is placeable only when its whole span lies along host segments.
export const doorFits = (hosts, door) =>
  door.h === 1
    ? coveredBy(hosts.horiz.filter((s) => s.line === door.y).map((s) => [s.lo, s.hi]), door.x, door.x + door.w)
    : coveredBy(hosts.vert.filter((s) => s.line === door.x).map((s) => [s.lo, s.hi]), door.y, door.y + door.h);

// The facility containing a furnishing's whole footprint (or null for loose).
export const containingFacility = (plot, floorId, rect) =>
  (plot.facilities || []).find(
    (f) => f.floorId === floorId &&
      rect.x >= f.x && rect.y >= f.y &&
      rect.x + rect.w <= f.x + f.w && rect.y + rect.h <= f.y + f.h
  ) || null;

// Total gold cost, build weeks and spaces used for the whole plot.
export function plotTotals(plot) {
  let gp = 0, weeks = 0, spaces = 0;
  const tiles = plot.landTiles || 0;
  gp += plot.landGold ?? tiles * 25; // gold spent on purchased boundary tiles
  const facCounts = { Vast: 0, Roomy: 0, Cramped: 0 };
  for (const f of plot.facilities || []) {
    // Bastion special facilities bypass the gold/time tables — they're
    // claimed at a character level, not built, and aren't counted against
    // the comfort tier's basic-facility guideline.
    if (f.bastion) continue;
    const def = FACILITY_TYPES[f.type];
    const area = f.w * f.h;
    gp += def.costPerSpace ? def.costPerSpace * area : def.cost || 0;
    weeks += def.weeksPerArea ? Math.ceil(area / def.weeksPerArea) : def.weeks || 0;
    if (facCounts[f.type] !== undefined) {
      facCounts[f.type]++;
      spaces += area;
    }
    for (const key of ["attic", "floor", "cellar"]) {
      const at = f[key];
      if (at?.on && at.items?.length) {
        gp += 50 * at.items.reduce((n, it) => n + it.w * it.h, 0);
        weeks += 2;
      }
    }
  }
  for (const fu of plot.furnishings || []) {
    gp += 25 * fu.w * fu.h;
    weeks += Math.ceil((fu.w * fu.h) / 4);
    spaces += fu.w * fu.h;
  }
  for (const c of plot.connections || []) {
    gp += 25;
    weeks += 1;
  }
  for (const wl of plot.walls || []) {
    if (wl.free) continue; // boundary walls added per room are free
    const def = WALL_TYPES[wl.type] || WALL_TYPES.Wall;
    const area = wl.w * wl.h;
    gp += def.gpPerSpace * area;
    weeks += Math.ceil(area / def.weeksPer);
  }
  return { gp, weeks, spaces, facCounts, landTiles: tiles };
}

// The plot's owned boundary: a square of land sized from its tier's land
// table, expandable by buying 25 gp tiles (tracked on plot.landTiles).
export const defaultBoundary = (plot) => {
  const tier = STATIONS[plot.ownership === "land" ? plot.landTier : plot.comfort] || STATIONS.modest;
  const side = Math.max(2, Math.round(Math.sqrt(tier.land.spaces)));
  return { w: side, h: side };
};

export const plotBoundary = (plot) =>
  plot.boundary && plot.boundary.w > 0 && plot.boundary.h > 0
    ? plot.boundary
    : defaultBoundary(plot);

// Walls and fences: drawn inside the boundary as 1-space-thick runs. Fences
// enclose courtyards and yards; walls divide interiors or close off buildings.
export const WALL_TYPES = {
  Wall: { desc: "Solid wall — drag to draw a run; it fuses with touching runs of the same kind, and shares corner cells to form L, T and + shapes.", gpPerSpace: 5, weeksPer: 10 },
  "Interior Wall": { desc: "Thin divider drawn along the grid line — joins and crosses other walls freely, so dynamic shapes build up segment by segment.", gpPerSpace: 2, weeksPer: 20 },
  Fence: { desc: "Fenced run for courtyards and yards — drag to draw; fuses with touching fence runs.", gpPerSpace: 2, weeksPer: 20 },
};

// Monthly upkeep from the homebrew: utilities 0.25% and taxes 1% of property
// value, 5 gp per staff member, 5 gp per Privy in cleaning fees.
export function plotUpkeep(plot) {
  const st = STATIONS[plot.comfort] || STATIONS.modest;
  const value = plot.ownership === "land" ? (STATIONS[plot.landTier] || st).land.cost : st.value;
  const privies = (plot.furnishings || []).filter((fu) => fu.type === "Privy").length;
  return {
    value,
    utilities: Math.round(value * 0.0025 * 100) / 100,
    taxes: Math.round(value * 0.01 * 100) / 100,
    staff: 5 * (plot.staff || 0),
    privies: 5 * privies,
  };
}

// gp value of one grid space for furnishings (25 gp per space).
export const FURNISH_GP_PER_SPACE = 25;

// The living style the property's rooms support, derived from what's built:
// beds from Bedrooms (one resident per space; a bunk stacks a second bed on
// top of each Bedroom), food quality (the homebrew rule — it sits at the
// property's comfort tier, but without a Kitchen it drops to Squalid, and
// four or more hens in an Animal Pen keep it at Poor or better), hygiene
// (Bathhouse / Washateria / Privy) and bulk storage.
export function livingStyle(plot) {
  const furs = [...(plot.furnishings || [])];
  for (const f of plot.facilities || []) {
    for (const key of ["attic", "floor", "cellar"]) {
      for (const it of f[key]?.items || []) furs.push({ type: it.type, w: it.w, h: it.h });
    }
  }
  const count = (type) => furs.filter((fu) => fu.type === type);
  const beds = count("Bedroom").reduce((n, b) => n + b.w * b.h, 0);
  const kitchenSpaces = count("Kitchen").reduce((n, k) => n + k.w * k.h, 0);
  const comfortIdx = COMFORT_LEVELS.indexOf(plot.comfort || "modest");
  const food = kitchenSpaces > 0
    ? COMFORT_LEVELS[comfortIdx]
    : "squalid";
  const foodIdx = COMFORT_LEVELS.indexOf(food);
  const overall = kitchenSpaces > 0
    ? COMFORT_LEVELS[comfortIdx]
    : COMFORT_LEVELS[Math.max(0, Math.min(comfortIdx, COMFORT_LEVELS.indexOf("poor")))];
  return {
    overall,
    beds,
    kitchenSpaces,
    kitchenSupports: kitchenSpaces * 2,
    food,
    foodFloor: count("Animal Pen").length > 0 ? "poor" : null,
    hygiene: {
      bathhouse: count("Bathhouse").length,
      washateria: count("Washateria").length,
      privy: count("Privy").length,
    },
    storageLbs:
      count("Storage Room").reduce((n, s) => n + s.w * s.h, 0) * 250 +
      count("Closet").reduce((n, c) => n + c.w * c.h, 0) * 125 +
      count("Vault").reduce((n, v) => n + Math.floor((v.w * v.h) / 6) * 2000, 0),
    rationsPerWeek:
      [...count("Garden"), ...count("Farmland")].reduce((n, g) => n + g.w * g.h, 0),
  };
}