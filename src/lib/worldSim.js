// Lightweight living-world clock and NPC schedule helpers.

const DAYS_PER_MONTH = 30;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];

const EVENTS = [
  { text: "A caravan arrives with news from the capital.", effect: (w) => w },
  { text: "A minor border dispute flares between two kingdoms.", effect: (w) => w },
  { text: "A monster migration is reported in the wilds.", effect: (w) => w },
  { text: "A local festival draws travellers to the nearest town.", effect: (w) => w },
  { text: "Trade prices shift after a poor harvest.", effect: (w) => w },
  { text: "A strange light is seen over the old ruins.", effect: (w) => w },
  { text: "A prominent merchant begins hiring guards.", effect: (w) => w },
  { text: "A sickness spreads through the poorer district.", effect: (w) => w },
];

export const timeLabel = (world) => {
  const cal = world?.calendar || { year: 1, month: 1, day: 1, hour: 8 };
  const month = MONTHS[(cal.month - 1) % 12] || "January";
  const hour = String(cal.hour).padStart(2, "0");
  return `${month} ${cal.day}, Year ${cal.year} · ${hour}:00`;
};

export function npcLocationFor(npc, hour) {
  const schedule = npc?.schedule || [];
  const block =
    schedule.find((entry) => hour >= entry.start && hour < entry.end) ||
    schedule[schedule.length - 1] ||
    null;
  if (!block) return { place: "home", buildingId: npc?.homeBuildingId || "", label: "Home" };
  return {
    place: block.place,
    buildingId: block.buildingId || "",
    label: block.label || block.place,
  };
}

export function advanceWorldTime(world, hours = 1) {
  const next = JSON.parse(JSON.stringify(world));
  const cal = { ...(next.calendar || { year: 1, month: 1, day: 1, hour: 8 }) };
  const step = Math.max(0, Math.round(Number(hours) || 0));
  const beforeDay = cal.day;
  cal.hour += step;
  while (cal.hour >= 24) {
    cal.hour -= 24;
    cal.day += 1;
  }
  while (cal.day > DAYS_PER_MONTH) {
    cal.day -= DAYS_PER_MONTH;
    cal.month += 1;
  }
  while (cal.month > 12) {
    cal.month -= 12;
    cal.year += 1;
  }
  cal.season = SEASONS[Math.floor(((cal.month - 1) % 12) / 3)] || "Spring";
  next.calendar = cal;
  next.npcs = (next.npcs || []).map((npc) => ({
    ...npc,
    currentLocation: npcLocationFor(npc, cal.hour),
  }));

  // Caravans move with the clock, and a new day can bring a world event.
  // An unresolved Bandit Activity halves every caravan's speed.
  const banditActivity = (next.kingdoms || []).some((kingdom) =>
    (kingdom.activeEvents || []).some(
      (event) => event.name === "Bandit Activity" && event.status !== "resolved"
    )
  );
  const caravanSpeed = banditActivity ? 0.5 : 1;
  next.caravans = (next.caravans || []).map((caravan) => {
    if (caravan.status !== "travelling") return caravan;
    const progress = Math.min(
      1,
      (caravan.progress || 0) + (step / 72) * caravanSpeed
    );
    return { ...caravan, progress, status: progress >= 1 ? "arrived" : "travelling" };
  });

  const crossedDay = cal.day !== beforeDay || step >= 24;
  if (crossedDay) {
    const arrivals = (next.caravans || []).filter(
      (caravan) => caravan.status === "arrived" && !caravan.announced
    );
    arrivals.forEach((caravan) => {
      caravan.announced = true;
      const from = next.settlements?.find((s) => s.id === caravan.fromSettlementId);
      const to = next.settlements?.find((s) => s.id === caravan.toSettlementId);
      next.logs = [
        ...(next.logs || []),
        {
          at: new Date().toISOString(),
          text: `A caravan from ${from?.name || "foreign parts"} reaches ${to?.name || "the capital"} with ${caravan.cargo}.`,
        },
      ];
    });
    if (Math.random() < 0.35) {
      const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      next.events = [...(next.events || []), { at: new Date().toISOString(), ...event }];
      next.logs = [...(next.logs || []), { at: new Date().toISOString(), text: event.text }];
    }
  }
  return next;
}

export function setWorldTime(world, { year, month, day, hour }) {
  const next = JSON.parse(JSON.stringify(world));
  next.calendar = {
    year: Number(year) || 1,
    month: Math.max(1, Math.min(12, Number(month) || 1)),
    day: Math.max(1, Math.min(DAYS_PER_MONTH, Number(day) || 1)),
    hour: Math.max(0, Math.min(23, Number(hour) || 0)),
  };
  next.calendar.season = SEASONS[Math.floor((next.calendar.month - 1) / 3)] || "Spring";
  next.npcs = (next.npcs || []).map((npc) => ({
    ...npc,
    currentLocation: npcLocationFor(npc, next.calendar.hour),
  }));
  return next;
}

export function currentLocationText(world, npc) {
  const settlement = (world?.settlements || []).find((s) => s.id === npc.settlementId);
  const building = settlement?.buildings?.find((b) => b.id === npc.currentLocation?.buildingId);
  return `${npc.currentLocation?.label || "Home"}${building ? ` — ${building.name}` : ""}`;
}

export function addCaravan(world, { fromKingdomId, toKingdomId, cargo = "mixed goods" }) {
  const next = JSON.parse(JSON.stringify(world));
  const from = (next.kingdoms || []).find((k) => k.id === fromKingdomId);
  const to = (next.kingdoms || []).find((k) => k.id === toKingdomId);
  if (!from || !to) return next;
  const fromSettlement = next.settlements.find((s) => s.id === from.capitalId);
  const toSettlement = next.settlements.find((s) => s.id === to.capitalId);
  if (!fromSettlement || !toSettlement) return next;
  next.caravans = [
    ...(next.caravans || []),
    {
      id: `caravan_${Date.now().toString(36)}`,
      fromKingdomId,
      toKingdomId,
      fromSettlementId: fromSettlement.id,
      toSettlementId: toSettlement.id,
      cargo,
      progress: 0,
      status: "travelling",
      createdAt: new Date().toISOString(),
    },
  ];
  return next;
}

export function advanceCaravans(world, hours = 24) {
  const next = JSON.parse(JSON.stringify(world));
  next.caravans = (next.caravans || []).map((caravan) => {
    if (caravan.status !== "travelling") return caravan;
    const progress = Math.min(1, (caravan.progress || 0) + Math.max(1, hours) / 72);
    return { ...caravan, progress, status: progress >= 1 ? "arrived" : "travelling" };
  });
  return next;
}

export function worldEventAt(world, index) {
  return (world?.events || [])[index] || null;
}
