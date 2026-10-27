// Dice rolling and the Business Turn actions derived from placed rooms.
import { STATIONS, plotKinds } from "./homestead";

// Roll a dice expression like "2d6", "1d4", "3d6x10" or "1d100" → total and
// the individual dice, for showing the detail next to the result.
export function rollDice(expr) {
  const m = String(expr).toLowerCase().match(/^(\d+)d(\d+)(?:\s*[x×]\s*(\d+))?$/);
  if (!m) return { total: Number(expr) || 0, detail: String(expr) };
  const n = Math.min(50, Number(m[1])), faces = Number(m[2]), mult = Number(m[3]) || 1;
  const dice = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * faces));
  const total = dice.reduce((a, b) => a + b, 0) * mult;
  return { total, detail: `${expr} [${dice.join(", ")}]${mult > 1 ? ` × ${mult}` : ""}` };
}

// The weekly business actions the plot's placed rooms unlock. Earning rolls
// add the bonus dice the homebrew assigns each room (Showroom, Counting
// House, Taverny tables, Apiary, Fishing Dock, Brewery, chickens), and a
// stable or Animal Pen covers Garden / Farmland fertilizer upkeep.
export function businessActions(plot) {
  if (!plotKinds(plot).includes("business")) return [];
  const furs = (plot.furnishings || []);
  const count = (type) => furs.filter((f) => f.type === type);
  const has = (type) => count(type).length > 0;
  const income = (STATIONS[plot.comfort] || STATIONS.modest).income;

  // Labor gating: an action can't run until its rooms are staffed — workers
  // are assigned in the Labor panel (plot.labor maps location id → workers).
  const labor = plot.labor || {};
  const asg = (id) => labor[id] || 0;
  const tavernyNeed = (t) => Math.max(2, Math.ceil(Math.floor((t.w * t.h) / 2) / 3) * 2);
  const baseStaffLock = () => {
    const base = [...count("Till Counter"), ...count("Workstation"), ...count("Taverny")];
    const ok = base.some((b) => (b.type === "Taverny" ? asg(b.id) >= tavernyNeed(b) : asg(b.id) >= 1));
    return ok ? null : "Assign a worker to a Till Counter, Workstation or Taverny first (Labor panel).";
  };
  const roomsLock = (type, per, what) => {
    const list = count(type);
    const need = list.length * per;
    const have = list.reduce((n, x) => n + asg(x.id), 0);
    return have >= need
      ? null
      : `Assign ${need - have} more worker${need - have === 1 ? "" : "s"} to the ${what} (Labor panel).`;
  };

  const actions = [];
  if (has("Till Counter") || has("Taverny") || has("Workstation")) {
    let roll = "1d6";
    const notes = [`property income ${income} gp`];
    if (has("Showroom")) { roll = `1d6+1d6`; notes.push(`Showroom +1d6`); }
    if (has("Counting House")) { roll = `${roll}+1d6`; notes.push(`Counting House +1d6`); }
    if (has("Taverny")) {
      const tables = count("Taverny").reduce((n, t) => n + Math.floor((t.w * t.h) / 2), 0);
      if (tables) { roll = `${roll}+${tables}d6`; notes.push(`Taverny ${tables} table${tables > 1 ? "s" : ""} +${tables}d6`); }
    }
    actions.push({
      id: "harvest", name: "Harvest Action", order: "earn",
      desc: `The week's take: base 1d6 gp plus ${income} gp property income. Bonuses: ${notes.join(", ")}.`,
      locked: baseStaffLock(),
      roll,
    });
  }
  if (has("Apiary")) {
    actions.push({
      id: "apiary", name: "Apiary harvest", order: "earn",
      desc: "Honey and wax from every Apiary, regardless of other results.",
      roll: `${count("Apiary").length}d6`,
    });
  }
  if (has("Fishing Dock")) {
    actions.push({
      id: "fishing", name: "Fishing Dock haul", order: "earn",
      desc: "The dock's boats fish for the week (food quality +1 level for two weeks too).",
      locked: roomsLock("Fishing Dock", 3, "Fishing Dock"),
      roll: `${2 * count("Fishing Dock").length}d6`,
    });
  }
  if (has("Brewery")) {
    actions.push({
      id: "brewery", name: "Brewery sales", order: "earn",
      desc: "Barrels ready every 4 weeks of production add to the Harvest take.",
      locked: roomsLock("Brewery", 1, "Brewery"),
      roll: `${3 * count("Brewery").length}d6`,
    });
  }
  if (has("Ledger Room")) {
    const routes = Math.min(10, count("Wagonstation").length * 2 || (has("Wagonstation") ? 1 : 0));
    const ledgerLock = roomsLock("Ledger Room", 1, "Ledger Room");
    actions.push({
      id: "resupply", name: "Resupply", order: "stock",
      desc: "Restock business supplies through the Ledger Room (+2 with Shipping & Receiving). No roll.",
      locked: ledgerLock,
    });
    if (routes > 0) {
      let roll = `${routes}d6`;
      if (has("Counting House")) roll += "+1d6";
      actions.push({
        id: "trade", name: `Trade Routes (${routes})`, order: "earn",
        desc: "Each route runs the week's haul — vehicle bonuses apply (Cart −1d6, Wagon 0, Carriage +1d6).",
        locked: ledgerLock,
        roll,
      });
    }
  }
  return actions;
}