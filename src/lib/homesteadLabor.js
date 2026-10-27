// Labor assignment: which placed locations need workers and how many. Workers
// come from the plot's hired staff (set in Property settings) and are spread
// across locations in the Labor panel; plot.labor maps location id → assigned
// workers. A business, Bastion or home action — and the room's benefits —
// only work once its location is fully staffed.
import { bastionFacilityByName } from "./homestead";

// Furnishings whose rules require a hireling to work them, with the staff
// each one needs (Taverny and Animal Pens scale or pool separately below).
const FURNISH_NEEDS = {
  Workstation: { need: 1, kind: "business" },
  "Till Counter": { need: 1, kind: "business" },
  "Ledger Room": { need: 1, kind: "business" },
  "Counting House": { need: 1, kind: "business" },
  Wagonstation: { need: 1, kind: "business" },
  "Fishing Dock": { need: 3, kind: "business" },
  "Airship Dock": { need: 5, kind: "business" },
  Brewery: { need: 1, kind: "business" },
  "Guard Post": { need: 1, kind: "home" },
  Infirmary: { need: 1, kind: "home" },
};

// Non-bastion facilities that take workers.
const FACILITY_NEEDS = {
  Porch: { need: 1, kind: "business" },
};

// Every placed location that can take workers: { id, label, type, need, kind }.
export function laborNeeds(plot) {
  const needs = [];
  for (const f of plot.facilities || []) {
    const need = f.bastion
      ? (bastionFacilityByName(f.bastion)?.hirelings || 0)
      : (FACILITY_NEEDS[f.type]?.need || 0);
    if (need > 0)
      needs.push({
        id: f.id, label: f.name || f.bastion || f.type, type: f.bastion || f.type,
        need, kind: f.bastion ? "bastion" : FACILITY_NEEDS[f.type].kind,
      });
  }
  for (const fu of plot.furnishings || []) {
    if (fu.type === "Taverny") {
      const tables = Math.floor((fu.w * fu.h) / 2);
      needs.push({
        id: fu.id, label: fu.label || "Taverny", type: "Taverny",
        need: Math.max(2, Math.ceil(tables / 3) * 2), kind: "business",
      });
    } else if (FURNISH_NEEDS[fu.type]) {
      needs.push({
        id: fu.id, label: fu.label || fu.type, type: fu.type,
        need: FURNISH_NEEDS[fu.type].need, kind: FURNISH_NEEDS[fu.type].kind,
      });
    }
  }
  // Animal Pens share their hirelings: 2 across all pens on the plot.
  const pens = (plot.furnishings || []).filter((fu) => fu.type === "Animal Pen");
  if (pens.length)
    needs.push({ id: "__animal-pens", label: `Animal Pens (×${pens.length})`, type: "Animal Pen", need: 2, kind: "home" });
  return needs;
}

export const laborAssigned = (plot, id) => (plot.labor || {})[id] || 0;

export const laborAssignedTotal = (plot) =>
  laborNeeds(plot).reduce((n, l) => n + laborAssigned(plot, l.id), 0);