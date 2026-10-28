// One-time upgrades for settings created before the city-grid, council rename
// and world-development layers. The function returns the same object when
// nothing needs changing, so it is safe to call from an effect.

import { normalizeCouncilRole, normalizeKingdomEconomy } from "@/lib/kingdom";
import { applyCityLayout } from "@/lib/cityLayout";
import { ensureInterior } from "@/lib/interiorGen";
import { generateWorldDevelopments } from "@/lib/worldDevelopments";

const renameRole = (value) => {
  const key = String(value || "").toLowerCase();
  if (key === "spymaster" || key === "counter-intel" || key === "counter intel") {
    return "Counter-Intel";
  }
  return value;
};

// Old maps used different row/column counts and stretched each cell into a
// rectangle. Resample them into a square grid so one cell is one square on the
// 1000×1000 world map without moving settlements.
function squareRealmMap(map) {
  if (!map || !Array.isArray(map.cells) || !map.width || !map.height) return map;
  if (map.width === map.height) return map;
  const side = Math.max(map.width, map.height);
  const fallbackBiome = map.cells[0]?.biome || "grassland";
  const byKey = new Map(map.cells.map((cell) => [`${cell.x}:${cell.y}`, cell]));
  const cells = [];
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const sx = Math.min(map.width - 1, Math.floor((x / side) * map.width));
      const sy = Math.min(map.height - 1, Math.floor((y / side) * map.height));
      const source = byKey.get(`${sx}:${sy}`);
      cells.push(
        source
          ? { ...source, x, y }
          : { x, y, biome: fallbackBiome, nationId: "" }
      );
    }
  }
  return { ...map, width: side, height: side, cells };
}

export function upgradeWorld(world) {
  if (!world) return world;
  const needsBuildingNames = (world.kingdoms || []).some((kingdom) =>
    (kingdom.buildings || []).some((building) => typeof building === "string")
  );
  const needsRelations = (world.kingdoms || []).some(
    (kingdom) =>
      kingdom.relations &&
      Object.prototype.hasOwnProperty.call(kingdom.relations, "undefined")
  );
  const needsEconomy = (world.kingdoms || []).some(
    (kingdom) =>
      ["ec", "mc", "ic", "pc"].some(
        (key) => !Number.isFinite(Number(kingdom.counts?.[key])) || Number(kingdom.counts?.[key]) < 0
      ) ||
      ["economy", "military", "influence", "prosperity"].some(
        (key) => !Number.isFinite(Number(kingdom.stats?.[key])) || Number(kingdom.stats?.[key]) < 0
      )
  );
  const needsGrid = (world.settlements || []).some(
    (settlement) =>
      settlement.mapLayout?.version !== 2 ||
      (settlement.buildings || []).some(
        (building) =>
          building.interior?.version !== 6 ||
          (building.rooms || []).some((room) => !Number.isFinite(room.x))
      )
  );
  const invalidWaterDevelopment = (development) =>
    (development.terrain === "Water" || development.terrain === "River") &&
    !["coast", "ocean", "swamp", "river"].includes(development.biome);
  const needsDevelopmentCleanup = (world.developments || []).some(invalidWaterDevelopment);
  const needsDispositions = (world.npcs || []).some((npc) => !npc.disposition);
  const needsSquareMap = (world.realms || []).some(
    (realm) => realm.map && realm.map.width !== realm.map.height
  );
  const needsRulerLevels =
    (world.settlements || []).some(
      (settlement) => settlement.kind === "capital" && !Number(settlement.rulerLevel)
    ) ||
    (world.kingdoms || []).some(
      (kingdom) => kingdom.ruler && !Number(kingdom.ruler.level)
    );
  const needsActiveEvents = (world.kingdoms || []).some(
    (kingdom) => !Array.isArray(kingdom.activeEvents)
  );
  if (
    world.layoutVersion === 2 &&
    Array.isArray(world.developments) &&
    !needsBuildingNames &&
    !needsRelations &&
    !needsEconomy &&
    !needsGrid &&
    !needsDevelopmentCleanup &&
    !needsDispositions &&
    !needsSquareMap &&
    !needsRulerLevels &&
    !needsActiveEvents
  ) {
    return world;
  }
  const next = JSON.parse(JSON.stringify(world));
  let changed = false;

  next.calendar = next.calendar || { year: 1, month: 1, day: 1, hour: 8, season: "Spring" };
  next.events = Array.isArray(next.events) ? next.events : [];
  next.mapTextures = next.mapTextures || {};
  next.roomAssetTemplates = next.roomAssetTemplates || {};
  next.quests = Array.isArray(next.quests) ? next.quests : [];
  next.caravans = Array.isArray(next.caravans) ? next.caravans : [];
  next.npcs = next.npcs || [];
  next.kingdoms = next.kingdoms || [];
  next.settlements = next.settlements || [];
  next.realms = next.realms || [];
  next.nations = next.nations || [];

  if (needsSquareMap) {
    next.realms = next.realms.map((realm) => ({
      ...realm,
      map: squareRealmMap(realm.map),
    }));
    changed = true;
  }

  // Bastion facilities are level-gated. Give every capital a ruler level before
  // interiors are regenerated, and keep the ruler NPC in sync.
  next.settlements = next.settlements.map((settlement) => {
    const kingdom = next.kingdoms.find(
      (item) => item.nationId === settlement.nationId
    );
    const level =
      settlement.kind === "capital"
        ? Number(settlement.rulerLevel) || Number(kingdom?.ruler?.level) || 5
        : Number(settlement.rulerLevel) || 0;
    if (Number(settlement.rulerLevel) === level) return settlement;
    changed = true;
    return { ...settlement, rulerLevel: level };
  });
  next.kingdoms = next.kingdoms.map((kingdom) => {
    if (!kingdom.ruler) return kingdom;
    const capital = next.settlements.find(
      (settlement) => settlement.id === kingdom.capitalId
    );
    const level =
      Number(kingdom.ruler.level) || Number(capital?.rulerLevel) || 5;
    if (Number(kingdom.ruler.level) === level) return kingdom;
    changed = true;
    return { ...kingdom, ruler: { ...kingdom.ruler, level } };
  });

  // One capital building carries the ruler's Bastion facilities. Older worlds
  // have no seat flag, so promote the castle/palace/manor/town hall once.
  next.settlements = next.settlements.map((settlement) => {
    if (settlement.kind !== "capital") return settlement;
    const buildings = settlement.buildings || [];
    if (!buildings.length) return settlement;
    const already = buildings.find((building) => building.capitalSeat);
    const order = ["Castle", "Palace", "Manor", "Town Hall"];
    const seat =
      already ||
      order
        .map((type) => buildings.find((building) => building.type === type))
        .find(Boolean) ||
      buildings[0];
    if (already?.id === seat.id && buildings.filter((b) => b.capitalSeat).length === 1) {
      return settlement;
    }
    changed = true;
    return {
      ...settlement,
      buildings: buildings.map((building) => ({
        ...building,
        capitalSeat: building.id === seat.id,
      })),
    };
  });

  next.npcs = next.npcs.map((npc) => {
    const role = renameRole(npc.role);
    const occupation = renameRole(npc.occupation);
    if (role !== npc.role || occupation !== npc.occupation) changed = true;
    let disposition = npc.disposition;
    if (!disposition) {
      disposition = ["ruler", "court"].includes(role) ? "allied" : "indifferent";
      changed = true;
    }
    let level = npc.level;
    if (role === "ruler" && !Number(level)) {
      level = 5;
      changed = true;
    }
    return { ...npc, role, occupation, disposition, level };
  });

  next.kingdoms = next.kingdoms.map((kingdom) => {
    const council = (kingdom.council || []).map((member) => {
      const roleId = normalizeCouncilRole(member.role);
      const roleLabel =
        roleId === "counter_intel"
          ? "Counter-Intel"
          : member.role || "Councillor";
      if (roleLabel !== member.role) changed = true;
      return { ...member, role: roleLabel, occupation: roleLabel };
    });
    const construction = Array.isArray(kingdom.construction) ? kingdom.construction : [];
    if (!Array.isArray(kingdom.construction)) changed = true;
    const cityById = new Map(
      next.settlements.flatMap((settlement) =>
        (settlement.buildings || []).map((building) => [
          building.id,
          {
            id: building.id,
            name: building.name,
            tier: building.comfort || "",
            category: building.category,
            benefit: "",
            settlementId: settlement.id,
            cityBuilding: true,
          },
        ])
      )
    );
    const buildings = (Array.isArray(kingdom.buildings) ? kingdom.buildings : []).map(
      (building) => {
        if (typeof building === "string") {
          changed = true;
          return cityById.get(building) || { id: building, name: building, tier: "", category: "", benefit: "" };
        }
        return building;
      }
    );
    const relations = { ...(kingdom.relations || {}) };
    if (Object.prototype.hasOwnProperty.call(relations, "undefined")) {
      delete relations.undefined;
      changed = true;
    }
    (next.nations || []).forEach((nation) => {
      if (nation.id !== kingdom.nationId && relations[nation.id] == null) relations[nation.id] = 0;
    });
    if (!Array.isArray(kingdom.activeEvents)) changed = true;
    return normalizeKingdomEconomy({
      ...kingdom,
      council,
      construction,
      buildings,
      relations,
      activeEvents: Array.isArray(kingdom.activeEvents)
        ? kingdom.activeEvents
        : [],
    });
  });

  // Regenerate city streets and room grids for pre-grid settlements, while
  // preserving every room's id, texture and imported assets.
  next.settlements = next.settlements.map((settlement) => {
    const needsGrid =
      settlement.mapLayout?.version !== 2 ||
      (settlement.buildings || []).some(
        (building) =>
          building.interior?.version !== 6 ||
          (building.rooms || []).some((room) => !Number.isFinite(room.x))
      );
    if (!needsGrid) return settlement;
    changed = true;
    const buildings = (settlement.buildings || []).map((building) =>
      ensureInterior(building, settlement)
    );
    const copy = { ...settlement, buildings };
    applyCityLayout(copy);
    return copy;
  });

  if (!Array.isArray(next.developments)) {
    next.developments = generateWorldDevelopments(next);
    changed = true;
  } else if (next.developments.length === 0) {
    next.developments = generateWorldDevelopments(next);
    if (next.developments.length) changed = true;
  } else if (next.developments.some(invalidWaterDevelopment)) {
    next.developments = next.developments.filter(
      (development) => !invalidWaterDevelopment(development)
    );
    changed = true;
  }

  next.layoutVersion = 2;
  return changed ? next : world;
}

