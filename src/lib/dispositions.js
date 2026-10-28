// NPC attitudes toward the player's kingdom (or the first kingdom when the
// player has not founded one). These are intentionally coarse so they can drive
// dialogue, prices, quests and travel at a glance.

export const DISPOSITIONS = [
  { id: "allied", label: "Allied", color: "text-emerald-400", bg: "bg-emerald-500/15" },
  { id: "friendly", label: "Friendly", color: "text-green-400", bg: "bg-green-500/15" },
  { id: "trusting", label: "Trusting", color: "text-sky-400", bg: "bg-sky-500/15" },
  { id: "indifferent", label: "Indifferent", color: "text-muted-foreground", bg: "bg-muted" },
  { id: "hostile", label: "Hostile", color: "text-amber-400", bg: "bg-amber-500/15" },
  { id: "hated", label: "Hated", color: "text-red-400", bg: "bg-red-500/15" },
];

export const DISPOSITION_BY_ID = Object.fromEntries(
  DISPOSITIONS.map((disposition) => [disposition.id, disposition])
);

export const referenceKingdom = (world) =>
  (world?.kingdoms || []).find((kingdom) => kingdom.player) ||
  (world?.kingdoms || [])[0] ||
  null;

export function dispositionFor(world, npc, reference = null) {
  if (!npc) return "indifferent";
  const ref = reference || referenceKingdom(world);
  const own = (world?.kingdoms || []).find((kingdom) => kingdom.nationId === npc.nationId);
  if (!own) return "indifferent";
  if (ref && own.id === ref.id) {
    return ["ruler", "court"].includes(npc.role) ||
      /counter.?intel/i.test(npc.role) ||
      npc.isAdventurer
      ? "allied"
      : "friendly";
  }
  if (ref && (own.wars || []).includes(ref.id)) return "hostile";
  const relation = Number(own.relations?.[ref?.nationId] ?? 0);
  if (relation >= 6) return "allied";
  if (relation >= 3) return "friendly";
  if (relation >= 0) return "trusting";
  if (relation >= -3) return "indifferent";
  if (relation >= -6) return "hostile";
  return "hated";
}

export const dispositionLabel = (id) => DISPOSITION_BY_ID[id]?.label || "Indifferent";

export const dispositionRank = (id) =>
  Math.max(0, DISPOSITIONS.findIndex((disposition) => disposition.id === id));
