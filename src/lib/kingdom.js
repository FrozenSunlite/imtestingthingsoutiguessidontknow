import { makeRng } from "@/lib/worldNames";
import { advanceDevelopments, DEVELOPMENT_FINANCE } from "@/lib/worldDevelopments";

// Counts and stats have no upper limit. This only keeps the four economy keys
// and the four count keys present and non-negative for older saves.
export function normalizeKingdomEconomy(kingdom) {
  if (!kingdom) return kingdom;
  kingdom.stats = { ...(kingdom.stats || {}) };
  kingdom.counts = { ...(kingdom.counts || {}) };
  ["economy", "military", "influence", "prosperity"].forEach((key) => {
    kingdom.stats[key] = Math.max(0, Number(kingdom.stats[key]) || 0);
  });
  ["ec", "mc", "ic", "pc"].forEach((key) => {
    kingdom.counts[key] = Math.max(0, Number(kingdom.counts[key]) || 0);
  });
  return kingdom;
}

function settlementFinance(world, province) {
  const settlement = (world?.settlements || []).find(
    (item) => item.id === province?.settlementId
  );
  if (!settlement) return { name: province?.name || "Unknown", income: 0, upkeep: 0, net: 0 };
  const buildings = settlement.buildings || [];
  const population = Number(settlement.population) || 0;
  const prosperity = Number(settlement.prosperity) || 0;
  const commerce = buildings.filter((building) =>
    /Tavern|Inn|Market|Shop|Bakery|Blacksmith|Guild|Bank|Trade|Dock|Warehouse/.test(
      building.type || ""
    )
  ).length;
  const income = Math.round(
    (population / 1000) * (1 + prosperity / 4) +
      commerce * 2 +
      (settlement.kind === "capital" ? 12 : 0)
  );
  const upkeep = buildings.length
    ? Math.round(buildings.length * 0.5 + (settlement.kind === "capital" ? 4 : 1))
    : 0;
  return {
    name: settlement.name,
    income,
    upkeep,
    net: income - upkeep,
    settlementId: settlement.id,
    kind: "settlement",
  };
}

function applyLedger(kingdom, world, log) {
  if (!world) return;
  const lines = [];
  let income = 0;
  let costs = 0;
  (kingdom.provinces || []).forEach((province) => {
    const finance = settlementFinance(world, province);
    income += finance.income;
    costs += finance.upkeep;
    lines.push(finance);
  });
  (world.developments || []).forEach((development) => {
    if (development.kingdomId !== kingdom.id || development.status !== "built") return;
    const finance = DEVELOPMENT_FINANCE[development.typeId] || { income: 0, upkeep: 0 };
    income += finance.income;
    costs += finance.upkeep;
    lines.push({
      name: development.name,
      income: finance.income,
      upkeep: finance.upkeep,
      net: finance.income - finance.upkeep,
      developmentId: development.id,
      kind: "development",
    });
  });
  const net = income - costs;
  kingdom.treasury = Math.max(0, (kingdom.treasury || 0) + net);
  kingdom.ledger = [
    ...(kingdom.ledger || []),
    {
      turn: kingdom.turn,
      month: kingdom.month,
      year: kingdom.year,
      lines,
      income,
      costs,
      net,
    },
  ].slice(-24);
  if (lines.length) {
    log.push(
      `Ledger: +${income} gp income, -${costs} gp upkeep, net ${net >= 0 ? "+" : ""}${net} gp.`
    );
  }
}

export const COUNCIL_ROLES = [
  { id: "steward", name: "Steward", ability: "INT", stat: "economy", resource: "ec", description: "Treasury, trade and supplies." },
  { id: "chancellor", name: "Chancellor", ability: "CHA", stat: "influence", resource: "ic", description: "Domestic and foreign relations." },
  { id: "architect", name: "Architect", ability: "WIS", stat: "prosperity", resource: "pc", description: "Construction, research and expansion." },
  { id: "general", name: "General", ability: "STR", stat: "military", resource: "mc", description: "Armies and military orders." },
  { id: "warden", name: "Warden", ability: "CON", stat: "military", resource: "mc", description: "Defenses and honorguard." },
  { id: "counter_intel", name: "Counter-Intel", ability: "DEX", stat: "influence", resource: "ic", description: "Espionage, scouting, sabotage and counter-intelligence." },
];

export const normalizeCouncilRole = (value) => {
  const key = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
  if (key === "spymaster" || key === "counterintel") return "counter_intel";
  return key;
};

export const COUNCIL_ACTION_GROUPS = [
  { id: "steward", name: "Steward", detail: "Trade, economy, taxes and supplies" },
  { id: "chancellor", name: "Chancellor", detail: "Diplomacy, accords and influence" },
  { id: "architect", name: "Architect", detail: "Construction, research and expansion" },
  { id: "general", name: "General", detail: "Recruitment, war and field battles" },
  { id: "warden", name: "Warden", detail: "Defence, fortifications and loyalty" },
  { id: "counter_intel", name: "Counter-Intel", detail: "Espionage, scouting and sabotage" },
];

export const BUILDING_MONTHS_BY_TIER = {
  Wretched: 1,
  Squalid: 1,
  Poor: 1,
  Modest: 2,
  Comfortable: 3,
  Wealthy: 4,
  Aristocratic: 5,
};

export const KINGDOM_STATS = [
  { id: "economy", label: "Economy", abbr: "ECO", count: "ec" },
  { id: "military", label: "Military", abbr: "MIL", count: "mc" },
  { id: "influence", label: "Influence", abbr: "INF", count: "ic" },
  { id: "prosperity", label: "Prosperity", abbr: "PRO", count: "pc" },
];

export const COMFORT_LEVELS = ["Wretched", "Squalid", "Poor", "Modest", "Comfortable", "Wealthy", "Aristocratic"];

const BUILDING_TEMPLATES = [
  // Wretched
  ["Guide Services", "Wretched", "Civic", { ec: 3, pc: 0, mc: 0, ic: 0 }, "Enables Scouts and gives +1 to every stat while it is the only civic building."],
  ["Shanty Shack", "Wretched", "Residential", { ec: 1, pc: 1, mc: 0, ic: 0 }, "+1 population capacity."],
  ["Trapper's Camp", "Wretched", "Industrial", { ec: 3, pc: 0, mc: 0, ic: 0 }, "Produces pelts and wood; enables Levy (Troop)."],
  ["Yard Garden", "Wretched", "Food", { ec: 1, pc: 0, mc: 0, ic: 0 }, "Supplies herbs and +2 population capacity."],
  ["Militia Training Ground", "Wretched", "Military", { ec: 3, pc: 0, mc: 3, ic: 0 }, "Enables Levy (Troop) and +1 MIL."],
  // Squalid
  ["Town Hall", "Squalid", "Civic", { ec: 20, pc: 20, mc: 20, ic: 20 }, "Required for a Squalid province; enables Builders, Spies, Caravans and Missionaries."],
  ["General Store", "Squalid", "Commercial", { ec: 6, pc: 1, mc: 0, ic: 1 }, "+1 ECO when supplied."],
  ["Tavern & Inn", "Squalid", "Commercial", { ec: 3, pc: 0, mc: 0, ic: 3 }, "+1 PRO, +1 INF, +1 loyalty."],
  ["Lumber Mill", "Squalid", "Industrial", { ec: 4, pc: 2, mc: 0, ic: 0 }, "Supplies 3 wood."],
  ["Quarry", "Squalid", "Industrial", { ec: 4, pc: 2, mc: 0, ic: 0 }, "Supplies 3 stone."],
  ["Farmland", "Squalid", "Food", { ec: 4, pc: 2, mc: 0, ic: 0 }, "+8 population capacity and food."],
  ["Barracks", "Squalid", "Military", { ec: 5, pc: 2, mc: 5, ic: 0 }, "Enables Spearmen and +1 MIL."],
  ["Watchtower", "Squalid", "Military", { ec: 3, pc: 1, mc: 5, ic: 0 }, "+2 BCR when defending the province."],
  // Poor
  ["Courthouse", "Poor", "Civic", { ec: 15, pc: 10, mc: 0, ic: 5 }, "Province becomes Poor; +2 loyalty."],
  ["Townhouse", "Poor", "Residential", { ec: 10, pc: 6, mc: 0, ic: 0 }, "+10 population capacity and +2 ECO."],
  ["Apartment", "Poor", "Residential", { ec: 8, pc: 4, mc: 0, ic: 0 }, "+18 population capacity."],
  ["Blacksmith", "Poor", "Industrial", { ec: 10, pc: 6, mc: 0, ic: 0 }, "Supplies metal and +2 ECO."],
  ["Brewery", "Poor", "Industrial", { ec: 6, pc: 3, mc: 0, ic: 0 }, "+2 PRO, +1 ECO, +1 loyalty."],
  ["Bakery", "Poor", "Food", { ec: 2, pc: 2, mc: 0, ic: 0 }, "+2 PRO and food."],
  ["Training Field", "Poor", "Military", { ec: 12, pc: 6, mc: 15, ic: 3 }, "Enables Heavy Infantry and +2 MIL."],
  ["Guard Post", "Poor", "Military", { ec: 8, pc: 4, mc: 8, ic: 0 }, "Prevents one enemy scouting attempt each turn."],
  // Modest
  ["Tax Office", "Modest", "Civic", { ec: 25, pc: 15, mc: 0, ic: 10 }, "Province becomes Modest; double Caravan gains on return."],
  ["Temple", "Modest", "Civic", { ec: 15, pc: 10, mc: 0, ic: 5 }, "+2 PRO, +2 INF, +2 loyalty."],
  ["Market", "Modest", "Commercial", { ec: 20, pc: 12, mc: 0, ic: 6 }, "+2 ECO; Commercial buildings gain +1 PRO."],
  ["University", "Modest", "Civic", { ec: 30, pc: 20, mc: 0, ic: 10 }, "+3 INF; research investment gains +20%."],
  ["Bank", "Modest", "Commercial", { ec: 25, pc: 15, mc: 0, ic: 8 }, "+3 ECO; enables loans and trade finance."],
  ["Class Hall", "Modest", "Military", { ec: 15, pc: 8, mc: 12, ic: 4 }, "Enables one class unit."],
  ["Field Hospital", "Modest", "Military", { ec: 18, pc: 10, mc: 12, ic: 6 }, "Heals 10 MP in the province each turn."],
  // Comfortable
  ["Embassy", "Comfortable", "Civic", { ec: 40, pc: 25, mc: 0, ic: 15 }, "Province becomes Comfortable; doubles Accord limit."],
  ["Ley Line Observatory", "Comfortable", "Civic", { ec: 30, pc: 18, mc: 0, ic: 8 }, "+4 ECO; doubles research investment."],
  ["Shrine", "Comfortable", "Civic", { ec: 24, pc: 6, mc: 0, ic: 8 }, "+1 loyalty and heals adjacent units."],
  ["Beast Taming Center", "Comfortable", "Military", { ec: 18, pc: 8, mc: 24, ic: 6 }, "Enables monster units and +4 ECO."],
  ["Knight's Chapterhouse", "Comfortable", "Military", { ec: 25, pc: 12, mc: 20, ic: 7 }, "Enables Heavy Cavalry."],
  ["Mage Tower", "Comfortable", "Military", { ec: 30, pc: 15, mc: 20, ic: 8 }, "Enables Battle Mages or Necromancers; +4 ECO."],
  // Wealthy
  ["Guild Holding", "Wealthy", "Commercial", { ec: 50, pc: 30, mc: 0, ic: 15 }, "+4 to all kingdom stats; one per kingdom."],
  ["Laboratory", "Wealthy", "Civic", { ec: 40, pc: 24, mc: 0, ic: 12 }, "+3 ECO and +3 research capacity."],
  ["Cathedral", "Wealthy", "Civic", { ec: 50, pc: 30, mc: 0, ic: 15 }, "+4 INF, councilors gain +1 on ability checks."],
  ["Fortress", "Wealthy", "Military", { ec: 50, pc: 30, mc: 45, ic: 12 }, "+3 ECO, +4 MIL, +50 province MP."],
  ["Mint", "Wealthy", "Commercial", { ec: 45, pc: 25, mc: 0, ic: 10 }, "+5 ECO; Harvest passes on 4+."],
  ["Spy Academy", "Wealthy", "Military", { ec: 50, pc: 30, mc: 25, ic: 20 }, "Produces a free Spy each Recruitment Phase."],
  // Aristocratic
  ["Supreme Courthouse", "Aristocratic", "Civic", { ec: 120, pc: 80, mc: 0, ic: 50 }, "Province becomes Aristocratic; no rebellions; +3 Towns."],
  ["Grand Cathedral", "Aristocratic", "Civic", { ec: 95, pc: 60, mc: 0, ic: 30 }, "+4 PRO, +6 INF, +5 loyalty; enables Angels."],
  ["Royal Palace", "Aristocratic", "Civic", { ec: 100, pc: 75, mc: 0, ic: 40 }, "+3 all stats, +5 loyalty; one per kingdom."],
  ["Arcane University", "Aristocratic", "Civic", { ec: 130, pc: 90, mc: 0, ic: 45 }, "+6 INF; enables Archmages."],
  ["Trade Consortium", "Aristocratic", "Commercial", { ec: 110, pc: 70, mc: 0, ic: 35 }, "+7 PRO; all trade benefits +50%."],
  ["Grand Arena", "Aristocratic", "Civic", { ec: 85, pc: 50, mc: 0, ic: 25 }, "+5 PRO, +3 MIL, +3 loyalty."],
  ["Royal Guard Barracks", "Aristocratic", "Military", { ec: 150, pc: 50, mc: 140, ic: 40 }, "Produces 10 Heavy Infantry when attacked once per year."],
  ["Grand Siege Works", "Aristocratic", "Military", { ec: 140, pc: 60, mc: 140, ic: 45 }, "Enables advanced siege units and +5 ECO."],
  // Infrastructure, trade and civic works.
  ["Paved Roads", "Poor", "Civic", { ec: 18, pc: 8, mc: 0, ic: 4 }, "+1 ECO, +1 PRO; armies and caravans move faster."],
  ["City Walls", "Poor", "Military", { ec: 20, pc: 10, mc: 18, ic: 0 }, "+3 BCR when defending this province."],
  ["Harbor", "Modest", "Commercial", { ec: 30, pc: 15, mc: 0, ic: 8 }, "+2 ECO and +1 trade route."],
  ["Hospital", "Modest", "Civic", { ec: 22, pc: 14, mc: 4, ic: 4 }, "+2 PRO; heals 5 MP per turn."],
  ["Public Baths", "Modest", "Civic", { ec: 16, pc: 12, mc: 0, ic: 4 }, "+1 PRO, +1 loyalty."],
  ["Guild Bank", "Comfortable", "Commercial", { ec: 40, pc: 22, mc: 0, ic: 12 }, "+3 ECO; trade bluffs and loans gain +1."],
  ["Royal Academy", "Aristocratic", "Civic", { ec: 120, pc: 70, mc: 0, ic: 40 }, "+5 INF; research costs 15% less."],
  ["Grand Harbor", "Aristocratic", "Commercial", { ec: 100, pc: 60, mc: 0, ic: 35 }, "+6 ECO; +2 trade routes."],
  ["War College", "Wealthy", "Military", { ec: 60, pc: 35, mc: 50, ic: 15 }, "+2 BCR to all armies; +2 MIL."],
];

export const KINGDOM_BUILDINGS = BUILDING_TEMPLATES.map(([name, tier, category, cost, benefit], index) => ({
  id: `kb_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
  name,
  tier,
  category,
  cost,
  benefit,
  order: index,
}));

const RESEARCH = [
  { id: "res_resource_extraction", name: "Resource Extraction", tier: "Squalid", category: "Economic", cost: 20, effect: "Enables Lumber Mill, Quarry and Mine; +1 ECO." },
  { id: "res_basic_commerce", name: "Basic Commerce", tier: "Squalid", category: "Economic", cost: 18, effect: "Enables General Store and Market; +1 ECO." },
  { id: "res_basic_training", name: "Basic Training", tier: "Squalid", category: "Military", cost: 20, effect: "Enables Barracks, Archery Range and Stables." },
  { id: "res_infrastructure", name: "Infrastructure", tier: "Squalid", category: "Prosperity", cost: 18, effect: "Enables roads, cottages and +1 population capacity." },
  { id: "res_public_safety", name: "Public Safety", tier: "Squalid", category: "Prosperity", cost: 19, effect: "Enables Guard Posts and +1 loyalty." },
  { id: "res_legality", name: "Legality Studies", tier: "Poor", category: "Cultural", cost: 26, effect: "Enables Courthouse and +1 INF." },
  { id: "res_urban_planning", name: "Urban Planning", tier: "Poor", category: "Prosperity", cost: 32, effect: "Enables Townhouse and Apartment." },
  { id: "res_craft_specialization", name: "Craft Specialization", tier: "Poor", category: "Economic", cost: 30, effect: "Enables Blacksmith, Tannery and Weaver." },
  { id: "res_banking", name: "Banking", tier: "Modest", category: "Economic", cost: 50, effect: "Enables Bank and +2 ECO." },
  { id: "res_higher_education", name: "Higher Education", tier: "Modest", category: "Cultural", cost: 52, effect: "Enables University and +2 INF." },
  { id: "res_divine_channeling", name: "Divine Channeling", tier: "Modest", category: "Magical", cost: 44, effect: "Enables Temple, Shrine and divine units." },
  { id: "res_ley_lines", name: "Ley Line Studies", tier: "Comfortable", category: "Magical", cost: 78, effect: "Enables Ley Line Observatory." },
  { id: "res_diplomatic_corps", name: "Diplomatic Corps", tier: "Comfortable", category: "Cultural", cost: 70, effect: "Enables Embassy and +1 Accord limit." },
  { id: "res_engineering", name: "Engineering Corps", tier: "Comfortable", category: "Military", cost: 82, effect: "Enables Engineer's Guild and siege units." },
  { id: "res_mercantilism", name: "Mercantilism", tier: "Wealthy", category: "Economic", cost: 120, effect: "Enables Palace and +2 all stats." },
  { id: "res_arcane_arts", name: "Arcane Arts", tier: "Wealthy", category: "Magical", cost: 90, effect: "Enables Arcane University and +3 INF." },
  { id: "res_total_war", name: "Total War Doctrine", tier: "Wealthy", category: "Military", cost: 100, effect: "Generals and Wardens gain +2 orders and +2 BCR." },
  { id: "res_justice", name: "Justice System", tier: "Aristocratic", category: "Prosperity", cost: 158, effect: "Enables Supreme Courthouse." },
  { id: "res_realm_magic", name: "Realm Magic", tier: "Aristocratic", category: "Magical", cost: 220, effect: "Enables Domain Magic." },
  { id: "res_eternal_society", name: "Eternal Society", tier: "Aristocratic", category: "Prosperity", cost: 205, effect: "Enables Royal Academy and Royal Palace." },
  // Expanded research tree.
  { id: "res_road_building", name: "Road Building", tier: "Squalid", category: "Prosperity", cost: 24, effect: "Enables Paved Roads and +1 PC." },
  { id: "res_naval_trade", name: "Naval Trade", tier: "Modest", category: "Economic", cost: 48, effect: "Enables Harbor and +2 ECO." },
  { id: "res_fortifications", name: "Fortifications", tier: "Poor", category: "Military", cost: 34, effect: "Enables City Walls and +2 BCR defending." },
  { id: "res_espionage", name: "Espionage Network", tier: "Modest", category: "Cultural", cost: 46, effect: "Espionage missions cost 2 less IC and gain +1." },
  { id: "res_siegecraft", name: "Siegecraft", tier: "Comfortable", category: "Military", cost: 76, effect: "Siege units and +2 BCR when attacking." },
  { id: "res_civic_admin", name: "Civic Administration", tier: "Poor", category: "Prosperity", cost: 30, effect: "Enables Public Baths and +1 loyalty." },
  { id: "res_trade_charters", name: "Trade Charters", tier: "Comfortable", category: "Economic", cost: 72, effect: "Free trade accords give +1 ECO." },
  { id: "res_war_college", name: "War College", tier: "Wealthy", category: "Military", cost: 95, effect: "Enables War College and +2 MIL." },
  { id: "res_monster_lore", name: "Monster Lore", tier: "Modest", category: "Magical", cost: 40, effect: "Beast units gain +1 BCR." },
];

export const KINGDOM_RESEARCH = RESEARCH;

const EVENTS = [
  { min: 1, max: 30, type: "Neutral", name: "All is well", effect: "No special effects this month." },
  { min: 31, max: 33, type: "Bane", name: "Bandit Activity", effect: "-2 EC, -1 PC; caravans move at half speed until patrols clear the roads.", apply: (k) => { k.counts.ec = Math.max(0, k.counts.ec - 2); k.counts.pc = Math.max(0, k.counts.pc - 1); } },
  { min: 34, max: 36, type: "Bane", name: "Minor Plague", effect: "-10 PC, -6 EC, -4 IC.", apply: (k) => { k.counts.pc = Math.max(0, k.counts.pc - 10); k.counts.ec = Math.max(0, k.counts.ec - 6); k.counts.ic = Math.max(0, k.counts.ic - 4); } },
  { min: 37, max: 39, type: "Bane", name: "Tax Evasion", effect: "-3 EC.", apply: (k) => { k.counts.ec = Math.max(0, k.counts.ec - 3); } },
  { min: 40, max: 42, type: "Bane", name: "Supply Drought", effect: "-2 MC; cannot recruit this turn.", apply: (k) => { k.counts.mc = Math.max(0, k.counts.mc - 2); k.flags = { ...(k.flags || {}), noRecruit: true }; } },
  { min: 43, max: 45, type: "Bane", name: "Trade Dispute", effect: "-3 PC, -2 loyalty in the capital.", apply: (k) => { k.counts.pc = Math.max(0, k.counts.pc - 3); if (k.capitalId) k.loyalty[k.capitalId] = Math.max(0, (k.loyalty[k.capitalId] || 10) - 2); } },
  { min: 46, max: 48, type: "Bane", name: "Storms", effect: "-1 to all stats for 1d3 turns; a random building is damaged.", apply: () => {} },
  { min: 49, max: 52, type: "Bane", name: "Unit Desertion", effect: "A random unit loses 1d8 MP and disperses if reduced below 1.", apply: (k) => { const unit = (k.units || [])[0]; if (unit) unit.mp = Math.max(0, (unit.mp || 4) - 4); } },
  { min: 53, max: 56, type: "Bane", name: "Noble Feud", effect: "-2 loyalty and -2 PC.", apply: (k) => { k.counts.pc = Math.max(0, k.counts.pc - 2); Object.keys(k.loyalty).forEach((id) => { k.loyalty[id] = Math.max(0, k.loyalty[id] - 1); }); } },
  { min: 57, max: 60, type: "Bane", name: "Market Crash", effect: "-4 EC; commercial buildings produce half next turn.", apply: (k) => { k.counts.ec = Math.max(0, k.counts.ec - 4); } },
  { min: 61, max: 65, type: "Bane", name: "Bandit Siege", effect: "-3 to all stats until the bandits are destroyed.", apply: () => {} },
  { min: 66, max: 70, type: "Boon", name: "Trade Windfall", effect: "+3 EC; next caravan returns double.", apply: (k) => { k.counts.ec += 3; k.flags = { ...(k.flags || {}), tradeWindfall: true }; } },
  { min: 71, max: 74, type: "Boon", name: "Bumper Crop", effect: "+3 PC; population grows for three months.", apply: (k) => { k.counts.pc += 3; } },
  { min: 75, max: 78, type: "Boon", name: "Successful Festival", effect: "+2 loyalty and +2 IC.", apply: (k) => { k.counts.ic += 2; Object.keys(k.loyalty).forEach((id) => { k.loyalty[id] = Math.min(20, k.loyalty[id] + 2); }); } },
  { min: 79, max: 82, type: "Boon", name: "Scholarly Discovery", effect: "+2 IC; research progress doubles this turn.", apply: (k) => { k.counts.ic += 2; k.flags = { ...(k.flags || {}), researchBoon: true }; } },
  { min: 83, max: 86, type: "Boon", name: "Trade Route Expansion", effect: "+3 EC; caravan capacity +4 for three turns.", apply: (k) => { k.counts.ec += 3; } },
  { min: 87, max: 90, type: "Boon", name: "Mining Growth", effect: "+2 EC, +2 MC; mining production doubled for two turns.", apply: (k) => { k.counts.ec += 2; k.counts.mc += 2; } },
  { min: 91, max: 94, type: "Boon", name: "Strategic Alliance", effect: "+2 MC, +2 IC; next Alliance Accord gains +1 Force.", apply: (k) => { k.counts.mc += 2; k.counts.ic += 2; k.flags = { ...(k.flags || {}), allianceBoon: true }; } },
  { min: 95, max: 97, type: "Boon", name: "Natural Stability", effect: "+2 to all counts and +2 loyalty.", apply: (k) => { k.counts.ec += 2; k.counts.mc += 2; k.counts.ic += 2; k.counts.pc += 2; Object.keys(k.loyalty).forEach((id) => { k.loyalty[id] = Math.min(20, k.loyalty[id] + 2); }); } },
  { min: 98, max: 100, type: "Boon", name: "Golden Age", effect: "+4 to all counts; ignore the next Bane event.", apply: (k) => { k.counts.ec += 4; k.counts.mc += 4; k.counts.ic += 4; k.counts.pc += 4; k.flags = { ...(k.flags || {}), ignoreBane: true }; } },
];

// Which events stay on the board after the month they occur. Events with a
// goal can be bought off with a resource; positive time-based events simply
// remain for their listed number of months. "All is well" never enters Recent
// Events.
const EVENT_META = {
  "Bandit Activity": {
    goal: "Clear the roads",
    resolveWith: "mc",
    ongoing: "Caravans move at half speed until patrols clear the roads.",
    clear: (kingdom) => {
      kingdom.flags = { ...(kingdom.flags || {}) };
      delete kingdom.flags.banditActivity;
    },
  },
  "Bandit Siege": {
    goal: "Break the siege",
    resolveWith: "mc",
    statPenalty: 3,
    ongoing: "All kingdom stats suffer a −3 penalty until the bandits are destroyed.",
  },
  "Minor Plague": {
    goal: "Contain the plague",
    resolveWith: "pc",
    statPenalty: 1,
    ongoing: "The plague continues to sap the realm until it is contained.",
  },
  "Supply Drought": {
    goal: "Restock the granaries",
    resolveWith: "ec",
    ongoing: "No recruiting until supplies are restored.",
    clear: (kingdom) => {
      kingdom.flags = { ...(kingdom.flags || {}) };
      delete kingdom.flags.noRecruit;
    },
  },
  Storms: {
    months: 2,
    statPenalty: 1,
    ongoing: "Storms damage the realm; all stats are reduced until the weather breaks.",
  },
  "Market Crash": {
    months: 1,
    statPenalty: 1,
    ongoing: "Commercial confidence is shaken; the economy suffers until the market recovers.",
  },
  "Bumper Crop": {
    months: 3,
    positive: true,
    ongoing: "Population and loyalty grow while the harvest remains strong.",
  },
  "Trade Route Expansion": {
    months: 3,
    positive: true,
    ongoing: "Caravan capacity stays expanded while the new routes are active.",
  },
  "Mining Growth": {
    months: 2,
    positive: true,
    ongoing: "Mines produce at double output while the seam holds.",
  },
};

export const KINGDOM_RESOURCE_LABELS = {
  ec: "Economy",
  mc: "Military",
  ic: "Influence",
  pc: "Prosperity",
};

const COMFORT_DICE = {
  Wretched: 1,
  Squalid: 2,
  Poor: 3,
  Modest: 4,
  Comfortable: 5,
  Wealthy: 6,
  Aristocratic: 7,
};

export function eventCostDice(kingdom) {
  const capital = (kingdom?.provinces || []).find(
    (province) => province.settlementId === kingdom?.capitalId
  );
  const comfort = capital?.comfort || "Poor";
  return COMFORT_DICE[comfort] || COMFORT_DICE.Poor;
}

function rollEventCost(kingdom, rng) {
  const dice = eventCostDice(kingdom);
  let total = 0;
  for (let index = 0; index < dice; index += 1) total += d6(rng);
  return total;
}

export function eventResolutionCost(event) {
  return Math.max(0, Number(event?.baseCost) || 0) + Math.max(0, Number(event?.weeksUnresolved) || 0);
}

function clearEventEffect(kingdom, event) {
  const meta = EVENT_META[event?.name];
  if (meta?.clear) meta.clear(kingdom);
}

function tickActiveEvents(kingdom, log) {
  const active = Array.isArray(kingdom.activeEvents) ? kingdom.activeEvents : [];
  if (!active.length) {
    kingdom.activeEvents = [];
    return;
  }
  const remaining = [];
  active.forEach((event) => {
    const months =
      event.monthsRemaining == null
        ? null
        : Math.max(0, Number(event.monthsRemaining) - 1);
    // A kingdom turn is one month; the cost rises by 1 per week unresolved.
    const weeks =
      Number(event.weeksUnresolved || 0) +
      (event.resolveWith ? 4 : 0);
    if (months != null && months <= 0) {
      clearEventEffect(kingdom, event);
      log.push(`⌛ ${event.name} has run its course.`);
      kingdom.eventHistory = (kingdom.eventHistory || []).map((entry) =>
        entry.id === event.id ? { ...entry, status: "expired" } : entry
      );
      return;
    }
    remaining.push({
      ...event,
      monthsRemaining: months,
      weeksUnresolved: weeks,
    });
  });
  kingdom.activeEvents = remaining;
}

function createActiveEvent(kingdom, world, rng, event) {
  const meta = EVENT_META[event.name];
  if (!meta) return null;
  const id = `evt_${kingdom.turn}_${Date.now().toString(36)}_${Math.floor(rng.rand() * 1e6).toString(36)}`;
  const active = {
    id,
    name: event.name,
    type: event.type,
    effect: event.effect,
    goal: meta.goal || "",
    ongoing: meta.ongoing || "",
    positive: !!meta.positive,
    resolveWith: meta.resolveWith || "",
    resolveLabel: KINGDOM_RESOURCE_LABELS[meta.resolveWith] || "",
    statPenalty: Number(meta.statPenalty) || 0,
    weeksUnresolved: 0,
    monthsRemaining: meta.months == null ? null : Number(meta.months),
    baseCost: meta.resolveWith ? rollEventCost(kingdom, rng) : 0,
    costDice: meta.resolveWith ? eventCostDice(kingdom) : 0,
    startedTurn: kingdom.turn,
    startedMonth: kingdom.month,
    startedYear: kingdom.year,
    status: "active",
  };
  kingdom.activeEvents = [...(kingdom.activeEvents || []), active];
  return active;
}

export function resolveKingdomEvent(kingdomInput, eventId) {
  const kingdom = JSON.parse(JSON.stringify(kingdomInput));
  const active = (kingdom.activeEvents || []).find((event) => event.id === eventId);
  if (!active) return { kingdom, error: "That event is no longer active." };
  if (!active.resolveWith) {
    return { kingdom, error: "This event does not have a paid resolution." };
  }
  const cost = eventResolutionCost(active);
  const resource = active.resolveWith;
  const label = KINGDOM_RESOURCE_LABELS[resource] || resource.toUpperCase();
  if ((kingdom.counts[resource] || 0) < cost) {
    return {
      kingdom,
      error: `Need ${cost} ${label} to resolve ${active.name} (you have ${kingdom.counts[resource] || 0}).`,
    };
  }
  kingdom.counts[resource] = (kingdom.counts[resource] || 0) - cost;
  kingdom.activeEvents = (kingdom.activeEvents || []).filter(
    (event) => event.id !== eventId
  );
  clearEventEffect(kingdom, active);
  kingdom.eventHistory = (kingdom.eventHistory || []).map((entry) =>
    entry.id === eventId
      ? {
          ...entry,
          status: "resolved",
          resolvedTurn: kingdom.turn,
          resolvedCost: cost,
          resolvedWith: resource,
        }
      : entry
  );
  kingdom.log = [
    ...(kingdom.log || []),
    {
      turn: kingdom.turn,
      month: kingdom.month,
      year: kingdom.year,
      lines: [
        `✅ ${active.name} resolved for ${cost} ${label}.${active.goal ? ` ${active.goal} complete.` : ""}`,
      ],
    },
  ];
  return { kingdom, event: active, cost, resource, resourceLabel: label };
}

export function recentKingdomEvents(world, limit = 12) {
  const rows = [];
  (world?.kingdoms || []).forEach((kingdom) => {
    const active = new Set((kingdom.activeEvents || []).map((event) => event.id));
    (kingdom.eventHistory || []).forEach((entry) => {
      if (!entry?.event || entry.event.name === "All is well") return;
      if (active.has(entry.id)) return;
      rows.push({
        kind: "history",
        kingdomId: kingdom.id,
        kingdomName: kingdom.name,
        turn: entry.turn || 0,
        event: entry.event,
        status: entry.status || "occurred",
      });
    });
  });
  return rows.sort((a, b) => b.turn - a.turn).slice(0, limit);
}

const mod = (score) => Math.floor((Number(score || 10) - 10) / 2);
const d6 = (rng) => 1 + Math.floor(rng.rand() * 6);

function councilMember(kingdom, roleId) {
  const wanted = normalizeCouncilRole(roleId);
  return (
    (kingdom?.council || []).find(
      (npc) => normalizeCouncilRole(npc.role) === wanted
    ) || null
  );
}

export function councilAbility(kingdom, roleId) {
  const wanted = normalizeCouncilRole(roleId);
  const role = COUNCIL_ROLES.find((r) => r.id === wanted);
  const member = councilMember(kingdom, wanted);
  return mod(member?.abilities?.[role?.ability] || 13);
}

function harvest(kingdom, rng, log) {
  const rolls = {};
  const activePenalty = (kingdom.activeEvents || []).reduce(
    (sum, event) => sum + (Number(event.statPenalty) || 0),
    0
  );
  KINGDOM_STATS.forEach((stat) => {
    const value = Math.max(
      0,
      (Number(kingdom.stats[stat.id]) || 0) - activePenalty
    );
    const dice = Array.from({ length: value }, () => d6(rng));
    let successes = dice.filter((d) => d >= 5).length;
    const role = COUNCIL_ROLES.find((r) => r.stat === stat.id);
    const rerolls = role ? Math.max(0, councilAbility(kingdom, role.id)) : 0;
    const failures = dice.filter((d) => d < 5).length;
    let extra = 0;
    for (let i = 0; i < Math.min(rerolls, failures); i += 1) {
      if (d6(rng) >= 5) extra += 1;
    }
    successes += extra;
    rolls[stat.id] = { dice, successes, extra };
    kingdom.counts[stat.count] = (Number(kingdom.counts[stat.count]) || 0) + successes;
    log.push(`${stat.label}: ${dice.join(", ") || "—"} → ${successes} ${stat.count.toUpperCase()}${extra ? ` (${extra} reroll)` : ""}`);
  });
  return rolls;
}

function applyBuildings(kingdom) {
  let eco = 0;
  let mil = 0;
  let inf = 0;
  let pro = 0;
  let food = 0;
  let wood = 0;
  let stone = 0;
  let metal = 0;
  let cloth = 0;
  let herbs = 0;
  (kingdom.buildings || []).forEach((building) => {
    const name = building.name || "";
    if (/Tavern|Inn|Market|Bank|Store|Guild|Trade/.test(name)) eco += 1;
    if (/Barracks|Watchtower|Training|Guard|Knight|War|Siege|Fortress|Mage|Garrison/.test(name)) mil += 1;
    if (/Temple|University|Cathedral|Theater|Library|Embassy|Shrine/.test(name)) inf += 1;
    if (/Farm|Garden|Bakery|Brewery|Butcher|Fishery/.test(name)) { pro += 1; food += 2; }
    if (/Lumber|Sawmill|Trapper/.test(name)) wood += 2;
    if (/Quarry|Mine|Smith|Blacksmith/.test(name)) { stone += 1; metal += 1; }
    if (/Weaver|Tannery|Cloth/.test(name)) cloth += 1;
    if (/Herbal|Apothecary|Garden/.test(name)) herbs += 1;
  });
  if ((kingdom.activeEvents || []).some((event) => event.name === "Market Crash")) {
    eco = Math.floor(eco / 2);
  }
  return { eco, mil, inf, pro, food, wood, stone, metal, cloth, herbs };
}

function loyaltyStep(kingdom, rng, log) {
  (kingdom.provinceIds || []).forEach((settlementId) => {
    const province = (kingdom.provinces || []).find((p) => p.settlementId === settlementId);
    let loyalty = Number(kingdom.loyalty[settlementId] ?? province?.loyalty ?? 10);
    const capital = settlementId === kingdom.capitalId;
    const activeNames = new Set((kingdom.activeEvents || []).map((event) => event.name));
    if (capital) loyalty += 1;
    if (kingdom.temporary?.bumperCrop || activeNames.has("Bumper Crop")) loyalty += 1;
    if (kingdom.temporary?.banditSiege || activeNames.has("Bandit Siege")) loyalty -= 2;
    if (kingdom.wars?.length) loyalty -= 1;
    if (kingdom.accords?.length) loyalty += 1;
    // Comfort and infrastructure.
    const comfort = province?.comfort || "Poor";
    if (comfort === "Wealthy" || comfort === "Aristocratic") loyalty += 1;
    if (comfort === "Wretched") loyalty -= 1;
    if ((kingdom.buildings || []).some((b) => /Courthouse|Town Hall|Public Works|Temple/i.test(b.name))) loyalty += 1;
    loyalty = Math.max(0, Math.min(20, loyalty));
    kingdom.loyalty[settlementId] = loyalty;
    if (province) province.loyalty = loyalty;
    if (loyalty <= 0) {
      log.push(`⚠ ${province?.name || "A province"} has declared independence.`);
      kingdom.provinceIds = kingdom.provinceIds.filter((id) => id !== settlementId);
      kingdom.provinces = (kingdom.provinces || []).filter((p) => p.settlementId !== settlementId);
    } else if (loyalty <= 4) {
      log.push(`⚠ ${province?.name || "A province"} is rebellious (Loyalty ${loyalty}).`);
    }
  });
  // Decrement temporary effects.
  Object.keys(kingdom.temporary || {}).forEach((key) => {
    kingdom.temporary[key] = Math.max(0, kingdom.temporary[key] - 1);
    if (!kingdom.temporary[key]) {
      delete kingdom.temporary[key];
      if (key === "martialLaw") kingdom.stats.military = Math.max(1, (kingdom.stats.military || 1) - 1);
      if (key === "fortified") {
        kingdom.flags = {
          ...(kingdom.flags || {}),
          defenceBonus: Math.max(0, (kingdom.flags?.defenceBonus || 0) - 2),
        };
      }
    }
  });
}

function rollEvent(kingdom, rng, log) {
  const roll = 1 + Math.floor(rng.rand() * 100);
  if (kingdom.flags?.ignoreBane) {
    kingdom.flags.ignoreBane = false;
  }
  const event = EVENTS.find((e) => roll >= e.min && roll <= e.max) || EVENTS[0];
  if (event.type === "Bane" && kingdom.flags?.ignoreBane) {
    log.push(`Event d100 [${roll}] — ${event.name} (ignored by a Golden Age).`);
    return { roll, ...event, ignored: true };
  }
  if (event.apply) event.apply(kingdom);
  log.push(`Event d100 [${roll}] — ${event.name}: ${event.effect}`);
  return { roll, name: event.name, type: event.type, effect: event.effect, ignored: !!event.ignored };
}

export function runKingdomTurn(kingdomInput, world = null, seed = "") {
  const rng = makeRng(`${kingdomInput?.id}:${kingdomInput?.turn}:${seed}`);
  const kingdom = JSON.parse(JSON.stringify(kingdomInput));
  const log = [];
  kingdom.turn = (kingdom.turn || 1) + 1;
  kingdom.month = (kingdom.month || 1) + 1;
  if (kingdom.month > 12) { kingdom.month = 1; kingdom.year = (kingdom.year || 1) + 1; }
  kingdom.flags = { ...(kingdom.flags || {}) };
  kingdom.activeEvents = Array.isArray(kingdom.activeEvents)
    ? kingdom.activeEvents
    : [];
  // Count down ongoing events before this month's harvest so their penalties
  // apply for the whole turn and old events can expire cleanly.
  tickActiveEvents(kingdom, log);
  const rolls = harvest(kingdom, rng, log);
  const production = applyBuildings(kingdom);
  kingdom.stats = {
    economy: Math.max(1, (kingdom.stats.economy || 3) + Math.floor(production.eco / 3)),
    military: Math.max(1, (kingdom.stats.military || 3) + Math.floor(production.mil / 3)),
    influence: Math.max(1, (kingdom.stats.influence || 3) + Math.floor(production.inf / 3)),
    prosperity: Math.max(1, (kingdom.stats.prosperity || 3) + Math.floor(production.pro / 3)),
  };
  kingdom.resources = {
    food: Math.max(0, (kingdom.resources?.food || 0) + production.food),
    wood: Math.max(0, (kingdom.resources?.wood || 0) + production.wood),
    stone: Math.max(0, (kingdom.resources?.stone || 0) + production.stone),
    metal: Math.max(0, (kingdom.resources?.metal || 0) + production.metal),
    cloth: Math.max(0, (kingdom.resources?.cloth || 0) + production.cloth),
    herbs: Math.max(0, (kingdom.resources?.herbs || 0) + production.herbs),
  };

  // Vassals send tribute to their overlord each turn.
  if (kingdom.vassalOf && world) {
    const overlord = (world.kingdoms || []).find((k) => k.id === kingdom.vassalOf);
    if (overlord) {
      const tribute = Math.min(kingdom.counts.ec || 0, 3);
      if (tribute > 0) {
        kingdom.counts.ec -= tribute;
        overlord.counts.ec = (overlord.counts.ec || 0) + tribute;
        log.push(`Paid ${tribute} EC tribute to ${overlord.name}.`);
      }
    }
  }

  // A non-aggression pact keeps the peace until its term expires.
  const canDeclareWar = !(kingdom.flags?.noWarUntil && (kingdom.turn || 1) < kingdom.flags.noWarUntil);

  // Construction projects finish before the month's event, and world-map
  // developments tick down on the same clock.
  if (Array.isArray(kingdom.construction) && kingdom.construction.length) {
    const remaining = [];
    kingdom.construction.forEach((project) => {
      const months = Math.max(0, Number(project.monthsRemaining || 1) - 1);
      if (months <= 0) {
        kingdom.buildings = [
          ...(kingdom.buildings || []),
          {
            id: project.id || `kb_${project.name}`,
            name: project.name,
            tier: project.tier,
            category: project.category,
            benefit: project.benefit,
            completedTurn: kingdom.turn,
          },
        ];
        log.push(`🏗 ${project.name} completed.`);
      } else {
        remaining.push({ ...project, monthsRemaining: months });
        log.push(`🏗 ${project.name} continues (${months} month${months === 1 ? "" : "s"} left).`);
      }
    });
    kingdom.construction = remaining;
  }
  if (world) log.push(...advanceDevelopments(kingdom, world));

  const event = rollEvent(kingdom, rng, log);
  if (event.name !== "All is well") {
    const meta = EVENT_META[event.name];
    const existing = (kingdom.activeEvents || []).find(
      (active) => active.name === event.name
    );
    if (existing) {
      if (meta?.positive && meta.months != null) {
        existing.monthsRemaining = Math.max(
          Number(existing.monthsRemaining) || 0,
          Number(meta.months)
        );
      }
      log.push(
        `${event.name} continues — resolve the existing task to clear it.`
      );
    } else {
      const active = createActiveEvent(kingdom, world, rng, event);
      kingdom.eventHistory = [
        ...(kingdom.eventHistory || []),
        {
          id: active?.id || `evt_${kingdom.turn}_${event.name}`,
          turn: kingdom.turn,
          month: kingdom.month,
          year: kingdom.year,
          event: {
            ...event,
            goal: meta?.goal || "",
            ongoing: meta?.ongoing || "",
            resolveWith: meta?.resolveWith || "",
          },
          status: active ? "active" : "occurred",
        },
      ];
    }
  }

  // AI / world pressure: low relations and high aggression can become war.
  if (world) {
    const otherKingdoms = (world.kingdoms || []).filter((k) => k.id !== kingdom.id);
    otherKingdoms.forEach((other) => {
      const relation = Number(kingdom.relations?.[other.nationId] ?? 0);
      if (canDeclareWar && relation <= -4 && kingdom.ai?.aggression >= 3 && rng.chance(0.22)) {
        kingdom.wars = [...new Set([...(kingdom.wars || []), other.id])];
        other.wars = [...new Set([...(other.wars || []), kingdom.id])];
        kingdom.relations[other.nationId] = -6;
        log.push(`⚔ War declared on ${other.name}.`);
      }
    });
    // At war, resolve a simple monthly skirmish.
    (kingdom.wars || []).forEach((warId) => {
      const enemy = (world.kingdoms || []).find((k) => k.id === warId);
      if (!enemy) return;
      const ourPower = (kingdom.stats.military || 3) + (kingdom.units || []).reduce((n, u) => n + (u.bcr || 0), 0) + rng.int(1, 6);
      const theirPower = (enemy.stats?.military || 3) + (enemy.units || []).reduce((n, u) => n + (u.bcr || 0), 0) + rng.int(1, 6);
      if (ourPower > theirPower) {
        kingdom.counts.ec += 2;
        enemy.counts.ec = Math.max(0, (enemy.counts.ec || 0) - 2);
        log.push(`⚔ Skirmish victory against ${enemy.name}; +2 EC.`);
      } else if (theirPower > ourPower) {
        kingdom.counts.ec = Math.max(0, kingdom.counts.ec - 2);
        log.push(`⚔ Skirmish defeat against ${enemy.name}; -2 EC.`);
      } else {
        log.push(`⚔ Stalemate against ${enemy.name}.`);
      }
    });
  }

  // AI spends a little of its surplus on development.
  const buildingPool = KINGDOM_BUILDINGS.filter((b) => !(kingdom.buildings || []).some((x) => x.name === b.name));
  if (buildingPool.length && rng.chance(0.35)) {
    const affordable = buildingPool.filter((b) =>
      Object.entries(b.cost).every(([key, value]) => (kingdom.counts[key] || 0) >= value)
    );
    if (affordable.length) {
      const choice = rng.pick(affordable);
      Object.entries(choice.cost).forEach(([key, value]) => { kingdom.counts[key] -= value; });
      const months = BUILDING_MONTHS_BY_TIER[choice.tier] || 1;
      kingdom.construction = [
        ...(kingdom.construction || []),
        {
          id: choice.id,
          name: choice.name,
          tier: choice.tier,
          category: choice.category,
          benefit: choice.benefit,
          months,
          monthsRemaining: months,
          startedTurn: kingdom.turn,
        },
      ];
      log.push(`🏗 ${kingdom.name} began ${choice.name} (${months} month${months === 1 ? "" : "s"}).`);
    }
  }

  loyaltyStep(kingdom, rng, log);
  applyLedger(kingdom, world, log);
  normalizeKingdomEconomy(kingdom);
  kingdom.log = [...(kingdom.log || []), { turn: kingdom.turn, month: kingdom.month, year: kingdom.year, rolls, event, lines: log }];
  return { kingdom, log, event, rolls };
}

export const KINGDOM_DECREES = [
  { id: "tax_levy", name: "Tax Levy", cost: {}, detail: "+6 EC now, but every province loses 2 loyalty." },
  { id: "martial_law", name: "Martial Law", cost: { ec: 4 }, detail: "+4 MC now, +1 MIL for three turns, -2 loyalty." },
  { id: "festival_season", name: "Festival Season", cost: { ec: 12 }, detail: "+3 loyalty in every province." },
  { id: "public_works", name: "Public Works", cost: { ec: 15 }, detail: "+2 PC and +1 loyalty in the capital." },
  { id: "amnesty", name: "Amnesty", cost: { ec: 6 }, detail: "+4 loyalty in every province, -2 IC." },
  { id: "conscription", name: "Conscription", cost: { pc: 3 }, detail: "+6 MC and -3 loyalty in every province." },
  { id: "trade_charter", name: "Trade Charter", cost: { ec: 12 }, detail: "+3 EC and a trade route with a willing neighbour." },
  { id: "fortify_borders", name: "Fortify Borders", cost: { ec: 20, mc: 8 }, detail: "+2 BCR when defending for three turns." },
  { id: "scholarship", name: "Scholarship Patronage", cost: { ec: 15 }, detail: "Gain a random inexpensive research for free." },
  { id: "religious_edict", name: "Religious Edict", cost: { ec: 10 }, detail: "+2 INF and +2 loyalty in every province." },
  { id: "spy_purge", name: "Purge the Spies", cost: { ec: 8 }, detail: "+2 IC and counters the next sabotage." },
];

export const ACCORD_TYPES = [
  {
    id: "free_trade",
    name: "Free Trade Agreement",
    cost: { ic: 12 },
    detail: "+1 ECO for both kingdoms and opens a trade route.",
    minRelation: -2,
  },
  {
    id: "non_aggression",
    name: "Non-Aggression Pact",
    cost: { ic: 8 },
    detail: "Neither side may declare war for six turns.",
    minRelation: -4,
  },
  {
    id: "alliance",
    name: "Alliance",
    cost: { ic: 15 },
    detail: "Mutual defence; +1 MIL and +2 MC for both.",
    minRelation: 1,
  },
  {
    id: "military_access",
    name: "Military Access",
    cost: { ic: 10 },
    detail: "+1 BCR when attacking and armies may cross the border.",
    minRelation: 0,
  },
  {
    id: "research_pact",
    name: "Research Pact",
    cost: { ic: 14 },
    detail: "Both kingdoms gain a free inexpensive research.",
    minRelation: 0,
  },
  {
    id: "vassalage",
    name: "Vassalage",
    cost: { ic: 25 },
    detail: "A weaker neighbour becomes a vassal paying 3 EC per turn.",
    minRelation: -2,
    requiresStronger: true,
  },
];

export const ESPIONAGE_MISSIONS = [
  { id: "scout", name: "Scout", cost: { ic: 4 }, detail: "Reveal the target's strength and gain +1 BCR next battle." },
  { id: "steal", name: "Steal Treasury", cost: { ic: 8 }, detail: "Contested check; success moves 4–10 EC to your treasury." },
  { id: "sabotage", name: "Sabotage", cost: { ic: 10 }, detail: "Damage a target unit or building." },
  { id: "incite", name: "Incite Unrest", cost: { ic: 12 }, detail: "Reduce a target province's loyalty by 4." },
  { id: "assassinate", name: "Assassination", cost: { ic: 20 }, detail: "High risk; may kill the target ruler and start a war." },
];

export const battlePower = (kingdom) => {
  const units = (kingdom?.units || []).reduce(
    (sum, unit) => sum + (Number(unit.bcr) || 0) + (Number(unit.mp) || 0) / 10,
    0
  );
  const buildings = (kingdom?.buildings || []).filter((building) =>
    /Barracks|Training|Fortress|Walls|War College|Knight|Siege|Guard/.test(building.name || "")
  ).length;
  return Math.round((kingdom?.stats?.military || 3) * 2 + (kingdom?.counts?.mc || 0) + units + buildings * 0.5);
};

const defenceBonus = (kingdom) =>
  ((kingdom?.buildings || []).some((building) => /Walls|Watchtower|Fortress|Castle/.test(building.name || ""))
    ? 3
    : 0) + (kingdom?.flags?.defenceBonus || 0);

function ensureLevy(kingdom) {
  if ((kingdom.units || []).length) return;
  kingdom.units = [
    {
      id: `levy_${kingdom.id}`,
      name: "Levy",
      bcr: 0,
      mp: Math.max(4, 4 + Math.floor((kingdom.counts?.mc || 0) / 2)),
      damage: "1d4",
      levy: true,
    },
  ];
}

function damageUnit(kingdom, amount, log, name) {
  const units = kingdom.units || [];
  if (!units.length) return;
  const target = [...units].sort((a, b) => (a.mp || 0) - (b.mp || 0))[0];
  target.mp = Math.max(0, (target.mp || 0) - amount);
  if (target.mp <= 0) {
    kingdom.units = units.filter((unit) => unit !== target);
    log.push(`${name}'s ${target.name} is destroyed.`);
  } else {
    log.push(`${name}'s ${target.name} takes ${amount} MP (${target.mp} left).`);
  }
}

// Resolve one field battle with the BCR/MP army model. Returns fresh copies so
// the caller can decide what to write back into the world.
export function resolveBattle(attackerInput, defenderInput, seed = "") {
  const rng = makeRng(`battle:${attackerInput?.id}:${defenderInput?.id}:${seed}`);
  const attacker = JSON.parse(JSON.stringify(attackerInput));
  const defender = JSON.parse(JSON.stringify(defenderInput));
  ensureLevy(attacker);
  ensureLevy(defender);
  const log = [];
  let round = 0;
  let attackerWon = false;
  while (round < 8 && (attacker.units || []).length && (defender.units || []).length) {
    round += 1;
    const aPower =
      battlePower(attacker) + rng.int(1, 6) + (attacker.flags?.militaryAccess ? 1 : 0);
    const dPower = battlePower(defender) + rng.int(1, 6) + defenceBonus(defender);
    const margin = aPower - dPower;
    log.push(
      `Round ${round}: ${attacker.name} ${aPower} vs ${defender.name} ${dPower} — ${
        margin >= 0 ? "the attacker presses" : "the defender holds"
      }.`
    );
    if (margin >= 0) damageUnit(defender, rng.int(3, 8) + Math.floor(margin / 3), log, defender.name);
    else damageUnit(attacker, rng.int(3, 8) + Math.floor(-margin / 3), log, attacker.name);
  }
  if ((defender.units || []).length === 0 && (attacker.units || []).length > 0) {
    attackerWon = true;
  } else if ((attacker.units || []).length === 0 && (defender.units || []).length > 0) {
    attackerWon = false;
  } else {
    attackerWon = battlePower(attacker) >= battlePower(defender);
  }
  if (attackerWon) {
    const spoils = Math.min(defender.counts?.ec || 0, 8 + rng.int(0, 12));
    attacker.counts.ec = (attacker.counts.ec || 0) + spoils;
    defender.counts.ec = Math.max(0, (defender.counts.ec || 0) - spoils);
    attacker.treasury = (attacker.treasury || 0) + spoils * 5;
    defender.treasury = Math.max(0, (defender.treasury || 0) - spoils * 5);
    log.push(`${attacker.name} wins the field and takes ${spoils} EC in spoils.`);
    // Capture one province when the defender has somewhere to lose.
    if ((defender.provinces || []).length > 1) {
      const captured = defender.provinces[defender.provinces.length - 1];
      defender.provinces = defender.provinces.filter((province) => province.id !== captured.id);
      defender.provinceIds = (defender.provinceIds || []).filter((id) => id !== captured.settlementId);
      delete defender.loyalty?.[captured.settlementId];
      attacker.provinces = [
        ...(attacker.provinces || []),
        { ...captured, id: `prov_${attacker.id}_${captured.settlementId}`, loyalty: 5, comfort: "Poor" },
      ];
      attacker.provinceIds = [...(attacker.provinceIds || []), captured.settlementId];
      attacker.loyalty = { ...(attacker.loyalty || {}), [captured.settlementId]: 5 };
      log.push(`${captured.name} is occupied by ${attacker.name}.`);
    }
  } else {
    const spoils = Math.min(attacker.counts?.ec || 0, 5 + rng.int(0, 8));
    defender.counts.ec = (defender.counts.ec || 0) + spoils;
    attacker.counts.ec = Math.max(0, (attacker.counts.ec || 0) - spoils);
    log.push(`${defender.name} holds the field; ${attacker.name} loses ${spoils} EC.`);
  }
  return {
    kingdom: attacker,
    enemy: defender,
    log,
    rounds: round,
    winner: attackerWon ? attacker.id : defender.id,
  };
}

const relationOf = (kingdom, other) => Number(kingdom?.relations?.[other?.nationId] ?? 0);

const setRelation = (kingdom, other, value) => {
  if (!kingdom || !other) return;
  kingdom.relations = { ...(kingdom.relations || {}) };
  kingdom.relations[other.nationId] = Math.max(-10, Math.min(10, value));
};

const bestCouncilMod = (kingdom) => {
  const member = [...(kingdom?.council || [])].sort(
    (a, b) => Math.max(...Object.values(b.abilities || { 0: 10 })) - Math.max(...Object.values(a.abilities || { 0: 10 }))
  )[0];
  return member ? mod(Math.max(...Object.values(member.abilities || { 0: 10 }))) : 0;
};

function randomCheapResearch(kingdom) {
  const known = new Set(kingdom.knownResearch || []);
  const pool = KINGDOM_RESEARCH.filter((research) => !known.has(research.id) && research.cost <= 50);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function councilForBuilding(building) {
  const name = building?.name || "";
  if (/Wall|Watchtower|Fortress|Guard|Hospital|Shrine|Garrison/.test(name)) return "warden";
  if (/Barracks|Training|Knight|Siege|War College|Beast|Mage|Class Hall/.test(name)) return "general";
  if (/Temple|Cathedral|University|Library|Academy|Embassy|Courthouse|Royal Palace|Town Hall|Guild|Palace/.test(name)) {
    return /Temple|Cathedral|Embassy|Guild|Palace/.test(name) ? "chancellor" : "architect";
  }
  if (/Market|Bank|Trade|Store|Harbor|Consortium|Mint/.test(name)) return "steward";
  if (/Road|Bath|Well|Public|Civic|Farm|Garden|Lumber|Quarry|Mill|Infrastructure/.test(name)) return "architect";
  if (/Lumber|Quarry|Smith|Blacksmith|Brewery|Trapper|Industrial/.test(name)) return "steward";
  return building?.category === "Military" ? "general" : building?.category === "Commercial" || building?.category === "Industrial" ? "steward" : "architect";
}

function councilForResearch(research) {
  if (research?.category === "Economic") return "steward";
  if (research?.category === "Military") return "general";
  if (research?.category === "Cultural") return "chancellor";
  if (research?.category === "Magical") return "architect";
  return "architect";
}

const DECREE_COUNCIL = {
  tax_levy: "steward",
  martial_law: "warden",
  festival_season: "chancellor",
  public_works: "architect",
  amnesty: "chancellor",
  conscription: "general",
  trade_charter: "steward",
  fortify_borders: "warden",
  scholarship: "architect",
  religious_edict: "chancellor",
  spy_purge: "counter_intel",
};

export function availableKingdomActions(kingdom, world = null) {
  const counts = kingdom?.counts || {};
  const actions = [];
  const constructionNames = new Set(
    (kingdom?.construction || []).map((project) => project.name)
  );
  const buildingPool = KINGDOM_BUILDINGS.filter(
    (b) =>
      !(kingdom?.buildings || []).some((x) => x.name === b.name) &&
      !constructionNames.has(b.name)
  );
  buildingPool.forEach((building) => {
    const affordable = Object.entries(building.cost).every(([key, value]) => (counts[key] || 0) >= value);
    const months = BUILDING_MONTHS_BY_TIER[building.tier] || 1;
    actions.push({
      id: `build:${building.id}`,
      kind: "build",
      council: councilForBuilding(building),
      label: `Build ${building.name}`,
      detail: `${building.tier} ${building.category} · ${months} month${months === 1 ? "" : "s"} · ${Object.entries(building.cost).map(([k, v]) => `${v} ${k.toUpperCase()}`).join(", ")}`,
      cost: building.cost,
      affordable,
      months,
      building,
    });
  });
  KINGDOM_RESEARCH.filter((r) => !(kingdom?.knownResearch || []).includes(r.id)).forEach((research) => {
    actions.push({
      id: `research:${research.id}`,
      kind: "research",
      council: councilForResearch(research),
      label: `Research ${research.name}`,
      detail: `${research.category} · ${research.cost} EC · ${research.effect}`,
      cost: { ec: research.cost },
      affordable: (counts.ec || 0) >= research.cost,
      research,
    });
  });
  [
    ["recruit:levy", "Recruit Levy", "4 MP, 1d4 damage", { mc: 3 }],
    ["recruit:archers", "Recruit Archers", "Ranged troop", { mc: 4 }],
    ["recruit:heavy_infantry", "Recruit Heavy Infantry", "Elite troop", { mc: 5, pc: 2 }],
    ["recruit:heavy_cavalry", "Recruit Heavy Cavalry", "Mounted elite", { mc: 7, pc: 2 }],
  ].forEach(([id, label, detail, cost]) => {
    actions.push({
      id,
      kind: "recruit",
      council: "general",
      label,
      detail,
      cost,
      affordable: Object.entries(cost).every(([key, value]) => (counts[key] || 0) >= value),
    });
  });
  actions.push({
    id: "expand:province",
    kind: "expand",
    council: "architect",
    label: "Expand province",
    detail: "Spend PC to add territory and population capacity.",
    cost: { pc: 5 },
    affordable: (counts.pc || 0) >= 5,
  });
  actions.push({
    id: "festival",
    kind: "festival",
    council: "chancellor",
    label: "Hold a festival",
    detail: "+3 loyalty in the capital for 20 EC.",
    cost: { ec: 20 },
    affordable: (counts.ec || 0) >= 20,
  });
  KINGDOM_DECREES.filter(
    (decree) => !(kingdom?.decrees || []).some((entry) => (entry.id || entry) === decree.id)
  ).forEach((decree) => {
    actions.push({
      id: `decree:${decree.id}`,
      kind: "decree",
      council: DECREE_COUNCIL[decree.id] || "architect",
      label: `Decree: ${decree.name}`,
      detail: decree.detail,
      cost: decree.cost,
      affordable: Object.entries(decree.cost).every(([key, value]) => (counts[key] || 0) >= value),
      decree,
    });
  });
  (world?.kingdoms || []).filter((k) => k.id !== kingdom?.id).forEach((other) => {
    const atWar = (kingdom?.wars || []).includes(other.id);
    const relation = relationOf(kingdom, other);
    const noWar = (kingdom?.flags?.noWarUntil || 0) > (kingdom?.turn || 1);
    actions.push({
      id: `trade:${other.id}`,
      kind: "trade",
      council: "steward",
      label: `Open trade with ${other.name}`,
      detail: "Requires 10 EC; improves relations and adds a trade route.",
      cost: { ec: 10 },
      affordable: (counts.ec || 0) >= 10,
      targetId: other.id,
    });
    if (!atWar) {
      ACCORD_TYPES.forEach((accord) => {
        const relationOk = relation >= accord.minRelation;
        const strongerOk =
          !accord.requiresStronger || battlePower(kingdom) >= battlePower(other) * 0.8;
        const affordable = Object.entries(accord.cost).every(([key, value]) => (counts[key] || 0) >= value);
        actions.push({
          id: `accord:${other.id}:${accord.id}`,
          kind: "accord",
          council: "chancellor",
          label: `${accord.name} with ${other.name}`,
          detail: `${accord.detail}${relationOk ? "" : ` Requires relation ${accord.minRelation}.`}${
            strongerOk ? "" : " Requires a stronger army."
          }`,
          cost: accord.cost,
          affordable: affordable && relationOk && strongerOk,
          targetId: other.id,
        });
      });
      ESPIONAGE_MISSIONS.forEach((mission) => {
        const discount = (kingdom?.knownResearch || []).includes("res_espionage") ? 2 : 0;
        const cost = { ...mission.cost, ic: Math.max(1, (mission.cost.ic || 0) - discount) };
        actions.push({
          id: `espionage:${other.id}:${mission.id}`,
          kind: "espionage",
          council: "counter_intel",
          label: `${mission.name}: ${other.name}`,
          detail: mission.detail,
          cost,
          affordable: Object.entries(cost).every(([key, value]) => (counts[key] || 0) >= value),
          targetId: other.id,
        });
      });
      actions.push({
        id: `bluff:${other.id}`,
        kind: "bluff",
        council: "chancellor",
        label: `Trade bluff: ${other.name}`,
        detail: "Contested CHA check; success +4 EC and +1 relation, failure -2 relation.",
        cost: { ec: 6 },
        affordable: (counts.ec || 0) >= 6,
        targetId: other.id,
      });
      actions.push({
        id: `war:${other.id}`,
        kind: "war",
        council: "general",
        label: `Declare war on ${other.name}`,
        detail: noWar ? "A non-aggression pact prevents war this turn." : "Break relations and begin raiding.",
        cost: {},
        affordable: !noWar,
        targetId: other.id,
      });
    } else {
      actions.push({
        id: `battle:${other.id}`,
        kind: "battle",
        council: "general",
        label: `Battle ${other.name}`,
        detail: `BCR ${battlePower(kingdom)} vs ${battlePower(other)} · field battle with provinces at stake.`,
        cost: {},
        affordable: true,
        targetId: other.id,
      });
      actions.push({
        id: `peace:${other.id}`,
        kind: "peace",
        council: "chancellor",
        label: `Seek peace with ${other.name}`,
        detail: "End the war for 8 IC; relations stay poor.",
        cost: { ic: 8 },
        affordable: (counts.ic || 0) >= 8,
        targetId: other.id,
      });
    }
  });
  return actions;
}

export function applyKingdomAction(kingdomInput, actionId, world = null) {
  const kingdom = JSON.parse(JSON.stringify(kingdomInput));
  const [kind, value, sub] = String(actionId || "").split(":");
  const log = [];
  const pay = (cost = {}) => {
    Object.entries(cost).forEach(([key, amount]) => {
      kingdom.counts[key] = Math.max(0, (kingdom.counts[key] || 0) - amount);
    });
  };
  const adjustLoyalty = (delta) => {
    kingdom.loyalty = { ...(kingdom.loyalty || {}) };
    Object.keys(kingdom.loyalty).forEach((id) => {
      kingdom.loyalty[id] = Math.max(0, Math.min(20, (kingdom.loyalty[id] || 0) + delta));
    });
    (kingdom.provinces || []).forEach((province) => {
      province.loyalty = kingdom.loyalty[province.settlementId] ?? province.loyalty;
    });
  };
  const targetKingdom = (id) => (world?.kingdoms || []).find((k) => k.id === id) || null;

  if (kind === "build") {
    const building = KINGDOM_BUILDINGS.find((b) => b.id === value);
    if (!building) return { kingdom, log };
    pay(building.cost);
    const months = BUILDING_MONTHS_BY_TIER[building.tier] || 1;
    kingdom.construction = [
      ...(kingdom.construction || []),
      {
        id: building.id,
        name: building.name,
        tier: building.tier,
        category: building.category,
        benefit: building.benefit,
        months,
        monthsRemaining: months,
        startedTurn: kingdom.turn,
      },
    ];
    log.push(`Broke ground on ${building.name} (${months} month${months === 1 ? "" : "s"}).`);
  } else if (kind === "research") {
    const research = KINGDOM_RESEARCH.find((r) => r.id === value);
    if (!research) return { kingdom, log };
    pay({ ec: research.cost });
    kingdom.knownResearch = [...new Set([...(kingdom.knownResearch || []), research.id])];
    log.push(`Completed research: ${research.name}.`);
  } else if (kind === "recruit") {
    const units = {
      "recruit:levy": { name: "Levy", bcr: 0, mp: 4, damage: "1d4", cost: { mc: 3 } },
      "recruit:archers": { name: "Archers", bcr: 2, mp: 4, damage: "1d4", cost: { mc: 4 } },
      "recruit:heavy_infantry": { name: "Heavy Infantry", bcr: 4, mp: 20, damage: "1d10", cost: { mc: 5, pc: 2 } },
      "recruit:heavy_cavalry": { name: "Heavy Cavalry", bcr: 6, mp: 12, damage: "1d10", cost: { mc: 7, pc: 2 } },
    };
    const unit = units[actionId];
    if (!unit) return { kingdom, log };
    pay(unit.cost);
    kingdom.units = [...(kingdom.units || []), { id: `unit_${Date.now()}_${Math.floor(Math.random() * 1e4)}`, ...unit }];
    log.push(`Recruited ${unit.name}.`);
  } else if (kind === "expand") {
    pay({ pc: 5 });
    kingdom.provinceCap = (kingdom.provinceCap || 1) + 1;
    log.push("Expanded the province boundaries (+1 province capacity).");
  } else if (kind === "festival") {
    pay({ ec: 20 });
    if (kingdom.capitalId) kingdom.loyalty[kingdom.capitalId] = Math.min(20, (kingdom.loyalty[kingdom.capitalId] || 10) + 3);
    log.push("Held a festival: +3 capital loyalty.");
  } else if (kind === "decree") {
    const decree = KINGDOM_DECREES.find((entry) => entry.id === value);
    if (!decree) return { kingdom, log };
    pay(decree.cost);
    switch (value) {
      case "tax_levy":
        kingdom.counts.ec += 6;
        adjustLoyalty(-2);
        break;
      case "martial_law":
        kingdom.counts.mc += 4;
        kingdom.stats.military += 1;
        kingdom.temporary = { ...(kingdom.temporary || {}), martialLaw: 3 };
        adjustLoyalty(-2);
        break;
      case "festival_season":
        adjustLoyalty(3);
        break;
      case "public_works":
        kingdom.counts.pc += 2;
        if (kingdom.capitalId) {
          kingdom.loyalty[kingdom.capitalId] = Math.min(20, (kingdom.loyalty[kingdom.capitalId] || 10) + 1);
        }
        break;
      case "amnesty":
        adjustLoyalty(4);
        kingdom.counts.ic = Math.max(0, kingdom.counts.ic - 2);
        break;
      case "conscription":
        kingdom.counts.mc += 6;
        adjustLoyalty(-3);
        break;
      case "trade_charter": {
        kingdom.counts.ec += 3;
        const partner = (world?.kingdoms || []).find(
          (k) => k.id !== kingdom.id && !(kingdom.wars || []).includes(k.id)
        );
        if (partner) {
          kingdom.tradeRoutes = [...new Set([...(kingdom.tradeRoutes || []), partner.id])];
          partner.tradeRoutes = [...new Set([...(partner.tradeRoutes || []), kingdom.id])];
          log.push(`Trade charter signed with ${partner.name}.`);
        }
        break;
      }
      case "fortify_borders":
        kingdom.flags = { ...(kingdom.flags || {}), defenceBonus: (kingdom.flags?.defenceBonus || 0) + 2 };
        kingdom.temporary = { ...(kingdom.temporary || {}), fortified: 3 };
        break;
      case "scholarship": {
        const research = randomCheapResearch(kingdom);
        if (research) {
          kingdom.knownResearch = [...new Set([...(kingdom.knownResearch || []), research.id])];
          log.push(`Scholars completed ${research.name}.`);
        }
        break;
      }
      case "religious_edict":
        kingdom.counts.ic += 2;
        adjustLoyalty(2);
        break;
      case "spy_purge":
        kingdom.counts.ic += 2;
        kingdom.flags = { ...(kingdom.flags || {}), counterIntel: true };
        break;
      default:
        break;
    }
    kingdom.decrees = [...(kingdom.decrees || []), { id: decree.id, name: decree.name, turn: kingdom.turn }];
    log.push(`Issued decree: ${decree.name}.`);
  } else if (kind === "trade") {
    pay({ ec: 10 });
    kingdom.tradeRoutes = [...new Set([...(kingdom.tradeRoutes || []), value])];
    const target = targetKingdom(value);
    if (target) {
      target.tradeRoutes = [...new Set([...(target.tradeRoutes || []), kingdom.id])];
      setRelation(kingdom, target, relationOf(kingdom, target) + 2);
      setRelation(target, kingdom, relationOf(target, kingdom) + 2);
      log.push(`Opened trade with ${target.name}.`);
    }
  } else if (kind === "war") {
    if (kingdom.flags?.noWarUntil && (kingdom.turn || 1) < kingdom.flags.noWarUntil) {
      log.push("A non-aggression pact prevents a declaration of war this turn.");
    } else {
      kingdom.wars = [...new Set([...(kingdom.wars || []), value])];
      const target = targetKingdom(value);
      if (target) {
        target.wars = [...new Set([...(target.wars || []), kingdom.id])];
        setRelation(kingdom, target, -8);
        setRelation(target, kingdom, -8);
        log.push(`Declared war on ${target.name}.`);
      }
    }
  } else if (kind === "peace") {
    pay({ ic: 8 });
    kingdom.wars = (kingdom.wars || []).filter((id) => id !== value);
    const target = targetKingdom(value);
    if (target) {
      target.wars = (target.wars || []).filter((id) => id !== kingdom.id);
      setRelation(kingdom, target, -2);
      setRelation(target, kingdom, -2);
      log.push(`Peace agreed with ${target.name}.`);
    }
  } else if (kind === "accord") {
    const accord = ACCORD_TYPES.find((entry) => entry.id === sub);
    const target = targetKingdom(value);
    if (!accord || !target) return { kingdom, log };
    pay(accord.cost);
    const stamp = new Date().toISOString();
    kingdom.accords = [...(kingdom.accords || []), { type: accord.id, name: accord.name, kingdomId: value, since: stamp }];
    target.accords = [...(target.accords || []), { type: accord.id, name: accord.name, kingdomId: kingdom.id, since: stamp }];
    setRelation(kingdom, target, relationOf(kingdom, target) + 2);
    setRelation(target, kingdom, relationOf(target, kingdom) + 2);
    if (accord.id === "free_trade") {
      kingdom.stats.economy += 1;
      target.stats.economy += 1;
      kingdom.tradeRoutes = [...new Set([...(kingdom.tradeRoutes || []), value])];
      target.tradeRoutes = [...new Set([...(target.tradeRoutes || []), kingdom.id])];
    } else if (accord.id === "alliance") {
      kingdom.counts.mc += 2;
      target.counts.mc += 2;
    } else if (accord.id === "military_access") {
      kingdom.flags = { ...(kingdom.flags || {}), militaryAccess: true };
      target.flags = { ...(target.flags || {}), militaryAccess: true };
    } else if (accord.id === "non_aggression") {
      kingdom.flags = { ...(kingdom.flags || {}), noWarUntil: (kingdom.turn || 1) + 6 };
      target.flags = { ...(target.flags || {}), noWarUntil: (target.turn || 1) + 6 };
    } else if (accord.id === "research_pact") {
      [kingdom, target].forEach((party) => {
        const research = randomCheapResearch(party);
        if (research) {
          party.knownResearch = [...new Set([...(party.knownResearch || []), research.id])];
        }
      });
    } else if (accord.id === "vassalage") {
      kingdom.vassals = [...new Set([...(kingdom.vassals || []), target.id])];
      target.vassalOf = kingdom.id;
    }
    log.push(`Signed ${accord.name} with ${target.name}.`);
  } else if (kind === "espionage") {
    const mission = ESPIONAGE_MISSIONS.find((entry) => entry.id === sub);
    const target = targetKingdom(value);
    if (!mission || !target) return { kingdom, log };
    const discount = (kingdom.knownResearch || []).includes("res_espionage") ? 2 : 0;
    pay({ ...mission.cost, ic: Math.max(1, (mission.cost.ic || 0) - discount) });
    const espionageBonus = (kingdom.knownResearch || []).includes("res_espionage") ? 1 : 0;
    const defence = Math.max(0, bestCouncilMod(target));
    const dc = 12 + defence;
    const roll = 1 + Math.floor(Math.random() * 20);
    const total = roll + (councilAbility(kingdom, "counter_intel") || 0) + espionageBonus;
    const success = roll !== 1 && (roll === 20 || total >= dc);
    log.push(`${mission.name} against ${target.name}: d20 ${roll} → ${total} vs DC ${dc} — ${success ? "success" : "failure"}.`);
    if (success) {
      if (mission.id === "scout") {
        kingdom.flags = { ...(kingdom.flags || {}), scouted: true };
        log.push(`Scouts report ${target.name} has ${battlePower(target)} battle power.`);
      } else if (mission.id === "steal") {
        const loot = Math.min(target.counts.ec || 0, 4 + Math.floor(Math.random() * 7));
        kingdom.counts.ec += loot;
        target.counts.ec = Math.max(0, (target.counts.ec || 0) - loot);
        log.push(`Stole ${loot} EC from ${target.name}.`);
      } else if (mission.id === "sabotage") {
        if (target.flags?.counterIntel) {
          target.flags = { ...target.flags, counterIntel: false };
          log.push("The sabotage was caught by counter-intelligence.");
        } else if ((target.units || []).length) {
          const unit = [...target.units].sort((a, b) => (b.mp || 0) - (a.mp || 0))[0];
          unit.mp = Math.max(0, (unit.mp || 0) - 6);
          log.push(`Sabotaged ${unit.name} (−6 MP).`);
        } else {
          target.counts.mc = Math.max(0, (target.counts.mc || 0) - 2);
          log.push("Sabotaged supply lines (−2 MC).");
        }
      } else if (mission.id === "incite") {
        const province = (target.provinces || [])[0];
        if (province) {
          target.loyalty = { ...(target.loyalty || {}) };
          target.loyalty[province.settlementId] = Math.max(0, (target.loyalty[province.settlementId] || 8) - 4);
          province.loyalty = target.loyalty[province.settlementId];
          log.push(`Unrest spreads in ${province.name} (−4 loyalty).`);
        }
      } else if (mission.id === "assassinate") {
        const victim = target.ruler;
        if (victim) {
          const successor = (target.council || [])[0];
          if (successor) {
            target.ruler = { ...successor, role: "ruler", occupation: "Ruler" };
            log.push(`${victim.name} is assassinated; ${successor.name} takes the throne.`);
          }
        }
        target.wars = [...new Set([...(target.wars || []), kingdom.id])];
        kingdom.wars = [...new Set([...(kingdom.wars || []), target.id])];
      }
    } else {
      setRelation(kingdom, target, relationOf(kingdom, target) - 3);
      setRelation(target, kingdom, relationOf(target, kingdom) - 3);
      if (mission.id === "assassinate") {
        target.wars = [...new Set([...(target.wars || []), kingdom.id])];
        kingdom.wars = [...new Set([...(kingdom.wars || []), target.id])];
        log.push(`${target.name} declares war after the botched assassination.`);
      }
    }
  } else if (kind === "bluff") {
    const target = targetKingdom(value);
    if (!target) return { kingdom, log };
    pay({ ec: 6 });
    const roll = 1 + Math.floor(Math.random() * 20);
    const total = roll + councilAbility(kingdom, "chancellor");
    const dc = 12 + Math.max(0, councilAbility(target, "chancellor"));
    const success = roll !== 1 && (roll === 20 || total >= dc);
    log.push(`Trade bluff against ${target.name}: d20 ${roll} → ${total} vs DC ${dc} — ${success ? "success" : "failure"}.`);
    if (success) {
      kingdom.counts.ec += 4;
      setRelation(kingdom, target, relationOf(kingdom, target) + 1);
      kingdom.tradeRoutes = [...new Set([...(kingdom.tradeRoutes || []), target.id])];
      target.tradeRoutes = [...new Set([...(target.tradeRoutes || []), kingdom.id])];
      log.push(`Favourable terms: +4 EC and a trade route with ${target.name}.`);
    } else {
      setRelation(kingdom, target, relationOf(kingdom, target) - 2);
      log.push(`${target.name} sees through the bluff (−2 relation).`);
    }
  } else if (kind === "battle") {
    const index = (world?.kingdoms || []).findIndex((k) => k.id === value);
    if (index < 0) return { kingdom, log };
    const result = resolveBattle(kingdom, world.kingdoms[index], `${kingdom.id}:${Date.now()}`);
    Object.assign(kingdom, result.kingdom);
    world.kingdoms = world.kingdoms.map((k) => (k.id === value ? result.enemy : k));
    log.push(...result.log);
    if (result.winner === kingdom.id) {
      log.push(`${kingdom.name} wins a decisive battle against ${result.enemy.name}.`);
    } else {
      log.push(`${kingdom.name} is beaten in the field by ${result.enemy.name}.`);
    }
  }
  kingdom.log = [...(kingdom.log || []), { turn: kingdom.turn, month: kingdom.month, year: kingdom.year, lines: log }];
  return { kingdom, log };
}

export const KINGDOM_EVENTS = EVENTS;
