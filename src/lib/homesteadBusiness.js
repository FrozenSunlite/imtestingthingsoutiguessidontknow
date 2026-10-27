// Chapter 2 — Running a Business: setup data, the harvest flow's comfort
// table, profit/loss event tables, trade route types and their event tables,
// and the specialized per-ability actions.
export const BUSINESS_SKILLS = [
  { skill: "Athletics", ability: "STR", urban: "Construction Company", suburban: "Roadway Repairs", remote: "Mining or Logging" },
  { skill: "Acrobatics", ability: "DEX", urban: "Performance Troubadour", suburban: "Traveling Circus", remote: "Courier Services" },
  { skill: "Sleight of Hand", ability: "DEX", urban: "Magicless Illusion Parlor", suburban: "Gambling Hall", remote: "Smuggler's Cove" },
  { skill: "Stealth", ability: "DEX", urban: "Private Security Company", suburban: "Trapper's Camp", remote: "Assassin's Guild" },
  { skill: "Arcana", ability: "INT", urban: "Enchanter's Workshop", suburban: "Ley Line Observatory", remote: "Magical Creature Sanctuary" },
  { skill: "History", ability: "INT", urban: "Antiquities Dealer", suburban: "Archaeological Dig Site", remote: "Ruin Exploration" },
  { skill: "Investigation", ability: "INT", urban: "Private Detective Agency", suburban: "Bounty Hunter Office", remote: "Lost Goods Recovery" },
  { skill: "Nature", ability: "INT", urban: "Botanical Garden", suburban: "Herbalism Shop", remote: "Exotic Plant Harvesters" },
  { skill: "Religion", ability: "INT", urban: "Temple", suburban: "Monastery", remote: "Shrine" },
  { skill: "Animal Handling", ability: "WIS", urban: "Mount Rental", suburban: "Ranch Farm", remote: "Beast Taming Center" },
  { skill: "Insight", ability: "WIS", urban: "Counseling Service", suburban: "Community Advisory", remote: "Oracle/Fortune Telling" },
  { skill: "Medicine", ability: "WIS", urban: "Apothecary", suburban: "Medicinal Clinic", remote: "Emergency Rescue Services" },
  { skill: "Perception", ability: "WIS", urban: "Inspection Services", suburban: "Guide Services", remote: "Forest/Forewarning Watch" },
  { skill: "Survival", ability: "WIS", urban: "Outdoor Supply", suburban: "Pelt Shop", remote: "Survival Training Center" },
  { skill: "Deception", ability: "CHA", urban: "Forgery Inspection Service", suburban: "Confidence Scheme Operation", remote: "Hidden Port" },
  { skill: "Intimidation", ability: "CHA", urban: "Debt Collection Agency", suburban: "Mercenary Recruitment", remote: "Stronghold-For-Hire" },
  { skill: "Performance", ability: "CHA", urban: "Theater Hall", suburban: "Traveling Bard Troupe", remote: "Sacred Performance Site" },
  { skill: "Persuasion", ability: "CHA", urban: "Brokerage/Negotiation Firm", suburban: "General Store", remote: "Tavern & Inn" },
];

// Business Comfort Level effects: profit roll, loss roll and the check
// modifier from the Chapter 2 table.
export const BUSINESS_COMFORT = {
  wretched: { profitDice: 3, lossDice: 4, checkMod: -2 },
  squalid: { profitDice: 3, lossDice: 4, checkMod: -2 },
  poor: { profitDice: 4, lossDice: 4, checkMod: -1 },
  modest: { profitDice: 5, lossDice: 3, checkMod: 0 },
  comfortable: { profitDice: 6, lossDice: 3, checkMod: 1 },
  wealthy: { profitDice: 7, lossDice: 2, checkMod: 2 },
  aristocratic: { profitDice: 8, lossDice: 2, checkMod: 3 },
};

export const PROFIT_EVENTS = [
  { lo: 1, hi: 5, name: "Nothing", text: "A standard, uneventful week." },
  { lo: 6, hi: 6, name: "Local Festival", text: "Double this week's profits." },
  { lo: 7, hi: 7, name: "Noble Patron", text: "+25 gp.", gold: 25 },
  { lo: 8, hi: 8, name: "Supplier Discount", text: "Next Resupply costs half as much." },
  { lo: 9, hi: 9, name: "Inspired", text: "Gain inspiration." },
  { lo: 10, hi: 10, name: "Favored", text: "DC reduced by 2 for the next 3 weeks." },
  { lo: 11, hi: 11, name: "Expansion Opportunity", text: "Invest 100 gp now for +5 gp weekly profit, permanently." },
  { lo: 12, hi: 12, name: "Trade Windfall", text: "Rare materials found — +50 gp.", gold: 50 },
  { lo: 13, hi: 13, name: "Guild Fame", text: "Permanent +1 to Harvest checks (otherwise roll again)." },
  { lo: 14, hi: 14, name: "State Commission", text: "Large order for the local authority — +100 gp.", gold: 100 },
  { lo: 15, hi: 15, name: "Innovation", text: "New technique: choose one Trade Route to auto-succeed every Business Turn." },
  { lo: 16, hi: 16, name: "Mentorship", text: "Gain proficiency in this business' skill." },
  { lo: 17, hi: 17, name: "Economy Boon", text: "Triple profits this week." },
  { lo: 18, hi: 18, name: "Supply Glut", text: "Next 4 Resupply actions are free." },
  { lo: 19, hi: 19, name: "Celebrity Endorsement", text: "Permanent +2 to Harvest checks (otherwise roll again)." },
  { lo: 20, hi: 20, name: "Legacy Moment", text: "The business becomes a local institution — permanent +5 gp weekly profit." },
];

export const LOSS_EVENTS = [
  { lo: 1, hi: 5, name: "Nothing", text: "A standard, uneventful week." },
  { lo: 6, hi: 6, name: "Supply Shortage", text: "Resupply immediately at double cost, losing all other supplies.", clear: "supplies" },
  { lo: 7, hi: 7, name: "Theft", text: "DC 15 Perception check or lose 2d20 gp (each Guard Hireling may roll too).", gold: "-2d20" },
  { lo: 8, hi: 8, name: "Accident", text: "Pay 25 gp in repairs or close for 1 week.", gold: -25 },
  { lo: 9, hi: 9, name: "Surprise Fees", text: "Lose 1d4×10 gp.", gold: "-1d4x10" },
  { lo: 10, hi: 10, name: "Competition", text: "DC increases by 2 for 1d4 weeks." },
  { lo: 11, hi: 11, name: "Price War", text: "Profits halved for 2 weeks." },
  { lo: 12, hi: 12, name: "Spoilage", text: "Lose all stockpiled resources.", clear: "stockpile" },
  { lo: 13, hi: 13, name: "Employee Theft", text: "Lose 3d20 gp and one hireling.", gold: "-3d20" },
  { lo: 14, hi: 14, name: "Regulations Trouble", text: "Pay a 50 gp fine or close for 2 weeks.", gold: -50 },
  { lo: 15, hi: 15, name: "Natural Damage", text: "Property damage costs 100 gp to repair.", gold: -100 },
  { lo: 16, hi: 16, name: "Supplier Bankruptcy", text: "No Resupply until you pass a DC 20 Invest." },
  { lo: 17, hi: 17, name: "Economic Crash", text: "Lose all stockpiled resources.", clear: "stockpile" },
  { lo: 18, hi: 18, name: "Guild Issues", text: "Business closed for 1d4 weeks." },
  { lo: 19, hi: 19, name: "Arson", text: "One facility is destroyed — it must be rebuilt." },
  { lo: 20, hi: 20, name: "Total Collapse", text: "The business fails here — pay 2,000 gp to relocate; no profit from Non-Trade Routes.", gold: -2000 },
];

export const ROUTE_PROFIT_EVENTS = [
  { lo: 1, hi: 5, name: "Nothing", text: "A standard, uneventful week." },
  { lo: 6, hi: 6, name: "Steady Demand", text: "An additional +1d6 gp." },
  { lo: 7, hi: 7, name: "Windfall", text: "The next route check has advantage." },
  { lo: 8, hi: 8, name: "New Contracts", text: "This route's profit permanently rises by +2 gp." },
  { lo: 9, hi: 9, name: "Backup Supplies", text: "The next loss or failure loses only half the gp." },
  { lo: 10, hi: 10, name: "Trade Festival", text: "Double this week's route profits." },
  { lo: 11, hi: 11, name: "Diplomatic Immunity", text: "This route removes the business' Taxes and Utilities for 1 month." },
  { lo: 12, hi: 12, name: "Trade Monopoly", text: "Profit bonus rises a category (Local → Regional, etc.)." },
  { lo: 13, hi: 13, name: "Favored Exchange", text: "Gain +25 gp this week.", gold: 25 },
  { lo: 14, hi: 14, name: "New Shortcut", text: "This route's DC permanently lowers by 1." },
  { lo: 15, hi: 15, name: "Loyal Customers", text: "Advantage on this route's checks for the next month." },
  { lo: 16, hi: 16, name: "Premium Goods", text: "+2d6 gp to this week's profits.", gold: "2d6" },
  { lo: 17, hi: 17, name: "Trade Alliance", text: "Your routes generate +1d6 gp once." },
  { lo: 18, hi: 18, name: "Commission", text: "Triple this week's profits." },
  { lo: 19, hi: 19, name: "Market Expansion", text: "This route's profit permanently rises by +5 gp." },
  { lo: 20, hi: 20, name: "Trade Mastery", text: "This route uses d8s instead of d6s for profit." },
];

export const ROUTE_LOSS_EVENTS = [
  { lo: 1, hi: 5, name: "Nothing", text: "A standard, uneventful week." },
  { lo: 6, hi: 6, name: "Price Collapse", text: "Halve this week's route earnings." },
  { lo: 7, hi: 7, name: "Route Damage", text: "The route cannot Harvest next week." },
  { lo: 8, hi: 8, name: "Tariffs", text: "Permanent −1d6 gp to this route's failures." },
  { lo: 9, hi: 9, name: "Competition", text: "Disadvantage on the next route check." },
  { lo: 10, hi: 10, name: "Supply Shortage", text: "The route generates no profit this week." },
  { lo: 11, hi: 11, name: "Banditry", text: "Lose all route profits this week and 2d6 gp.", gold: "-2d6" },
  { lo: 12, hi: 12, name: "Route Collapse", text: "The route is lost — once per harvest, form a new route on a DC 15 Investigation." },
  { lo: 13, hi: 13, name: "Spoiled", text: "Lose 4d10 gp in inventory.", gold: "-4d10" },
  { lo: 14, hi: 14, name: "Labor Dispute", text: "The route generates no profit for 2 weeks." },
  { lo: 15, hi: 15, name: "Natural Disaster", text: "The route is inactive for 1d4 weeks." },
  { lo: 16, hi: 16, name: "Currency Crash", text: "Halve route income for 1 month." },
  { lo: 17, hi: 17, name: "Regulations", text: "Permanent −3 gp to this route's failures." },
  { lo: 18, hi: 18, name: "Caravan Accident", text: "Lose the vehicle and 5d6 gp in goods.", gold: "-5d6" },
  { lo: 19, hi: 19, name: "Embargo", text: "The route is inactive for 2d4 weeks." },
  { lo: 20, hi: 20, name: "Total Loss", text: "The route is lost — once per harvest, form a new route on a DC 25 Investigation." },
];

export const ROUTE_TYPES = [
  { id: "local", label: "Local Route", dc: 10, bonus: 0, desc: "Short-distance trade within the same region." },
  { id: "regional", label: "Regional Route", dc: 15, bonus: 1, desc: "Cross-country trade — +1d6 gp profit bonus." },
  { id: "distant", label: "Distant Route", dc: 20, bonus: 3, desc: "Long-distance trade — +3d6 gp profit bonus." },
  { id: "maritime", label: "Maritime Route", dc: 25, bonus: 10, desc: "Across large waters — +10d6 gp; takes a month between harvests." },
];

// One Specialized Application per ability, once per week across businesses.
export const SPECIALS = {
  STR: { name: "Labor Push", text: "Advantage on next week's Harvest, double the profits and keep the highest." },
  DEX: { name: "Fine Crafting", text: "Create one item worth 75 gp." },
  CON: { name: "Mass Production", text: "+1d6 gp to your next Harvest success; losses reduced by 1d6." },
  INT: { name: "Research/Planning", text: "+5 to next week's Harvest skill check." },
  WIS: { name: "Non-profit mission", text: "No Taxes or Utilities on this property for 1 month." },
  CHA: { name: "Marketing Push", text: "Comfort counts 1 higher next week; a failed Harvest loses an extra 2d6." },
};

// Calendar seasons and their weekly modifiers to the business turn.
export const SEASONS = {
  spring: { label: "Spring", harvestDC: -1, routeMod: 0, note: "Renewal — −1 to Harvest DCs." },
  summer: { label: "Summer", harvestDC: 0, routeMod: 0, note: "Normal conditions." },
  fall: { label: "Fall", harvestDC: 0, routeMod: 1, profitBonusDice: "1d6", note: "Bounty — +1d6 Harvest profits and +1 to route checks." },
  winter: { label: "Winter", harvestDC: 2, routeMod: -2, note: "Hardship — +2 to Harvest DCs, −2 to route checks; Gardens, Farmland and Apiaries yield nothing." },
};

export const newBusiness = () => ({
  established: false,
  type: "",
  skill: "",
  ability: "STR",
  abilityMod: 0,
  funds: 0,
  stockpile: 0,
  supplies: 0,
  debt: 0,
  morale: 11,
  routes: [],
  buffs: {},
});

// Find the table row a d20 roll lands in.
export const eventAt = (table, roll) =>
  table.find((e) => roll >= e.lo && roll <= e.hi) || table[table.length - 1];

// Resolve an event's gold effect — a number, or a signed dice expression.
export const eventGold = (gold) => {
  if (typeof gold === "number") return gold;
  const neg = String(gold).startsWith("-");
  const amt = evalGold(neg ? String(gold).slice(1) : String(gold));
  return neg ? -amt : amt;
};

const evalGold = (expr) => {
  const m = expr.toLowerCase().match(/^(\d+)d(\d+)(?:\s*[x×]\s*(\d+))?$/);
  if (!m) return Number(expr) || 0;
  let total = 0;
  for (let i = 0; i < Math.min(50, Number(m[1])); i++) total += 1 + Math.floor(Math.random() * Number(m[2]));
  return total * (Number(m[3]) || 1);
};