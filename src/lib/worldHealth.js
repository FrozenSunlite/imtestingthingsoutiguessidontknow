// Structural checks for a world. The Health tab uses this to point at broken
// rooms, stretched maps, stale event tasks and old source-library image links.
// repairWorld() performs the safe automatic repairs in one pass.

import { ensureInterior } from "@/lib/interiorGen";
import { upgradeWorld } from "@/lib/worldUpgrade";
import { ensurePlayer } from "@/lib/player";

const RESOURCE_KEYS = new Set(["ec", "mc", "ic", "pc"]);

const overlaps = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const isLegacySource = (url) =>
  String(url || "").startsWith("/api/assets/file?path=");

export function validateWorld(world) {
  const issues = [];
  const add = (severity, area, message, extra = {}) => {
    issues.push({ severity, area, message, ...extra });
  };
  if (!world) {
    add("error", "world", "No world is loaded.");
    return { issues, summary: { errors: 1, warnings: 0, info: 0 } };
  }

  if (!world.player) {
    add("info", "player", "No player state yet; the Play tab will create one.");
  }

  (world.realms || []).forEach((realm) => {
    const map = realm.map;
    if (!map?.cells?.length) {
      add("warning", "map", `${realm.name} has no terrain cells.`, {
        realmId: realm.id,
      });
      return;
    }
    if (map.width !== map.height) {
      add(
        "error",
        "map",
        `${realm.name} uses a ${map.width}x${map.height} grid; cells will render as rectangles.`,
        { realmId: realm.id }
      );
    }
    if (map.cells.length !== map.width * map.height) {
      add(
        "warning",
        "map",
        `${realm.name} has ${map.cells.length} terrain cells for a ${map.width}x${map.height} grid.`,
        { realmId: realm.id }
      );
    }
  });

  (world.kingdoms || []).forEach((kingdom) => {
    if (!Number(kingdom.ruler?.level)) {
      add("warning", "kingdom", `${kingdom.name}'s ruler has no level.`, {
        kingdomId: kingdom.id,
      });
    }
    if (!Array.isArray(kingdom.activeEvents)) {
      add("warning", "events", `${kingdom.name} has no active-event list.`, {
        kingdomId: kingdom.id,
      });
    }
    (kingdom.activeEvents || []).forEach((event) => {
      if (event.resolveWith && !RESOURCE_KEYS.has(event.resolveWith)) {
        add(
          "error",
          "events",
          `${kingdom.name}: ${event.name} resolves with an unknown resource "${event.resolveWith}".`,
          { kingdomId: kingdom.id, eventId: event.id }
        );
      }
      if (Number(event.baseCost) < 0 || Number(event.weeksUnresolved) < 0) {
        add(
          "error",
          "events",
          `${kingdom.name}: ${event.name} has a negative resolution cost.`,
          { kingdomId: kingdom.id, eventId: event.id }
        );
      }
    });
    ["ec", "mc", "ic", "pc"].forEach((key) => {
      if (Number(kingdom.counts?.[key]) < 0) {
        add("error", "kingdom", `${kingdom.name}: count ${key.toUpperCase()} is negative.`, {
          kingdomId: kingdom.id,
        });
      }
    });
    ["economy", "military", "influence", "prosperity"].forEach((key) => {
      if (Number(kingdom.stats?.[key]) < 0) {
        add("error", "kingdom", `${kingdom.name}: ${key} is negative.`, {
          kingdomId: kingdom.id,
        });
      }
    });
  });

  (world.npcs || []).forEach((npc) => {
    if (!npc.disposition) {
      add("warning", "people", `${npc.name} has no disposition.`, {
        npcId: npc.id,
      });
    }
  });

  (world.settlements || []).forEach((settlement) => {
    const buildings = settlement.buildings || [];
    if (settlement.kind === "capital" && buildings.length) {
      if (!buildings.some((building) => building.capitalSeat)) {
        add(
          "warning",
          "settlements",
          `${settlement.name} is a capital but has no seat of government.`,
          { settlementId: settlement.id }
        );
      }
    }
    buildings.forEach((building) => {
      const rooms = building.rooms || building.interior?.rooms || [];
      if (!rooms.length) {
        add(
          "warning",
          "interiors",
          `${building.name} in ${settlement.name} has no rooms.`,
          { settlementId: settlement.id, buildingId: building.id }
        );
        return;
      }
      if (building.interior?.version !== 6) {
        add(
          "warning",
          "interiors",
          `${building.name} uses interior version ${building.interior?.version || "?"} (current is 6).`,
          { settlementId: settlement.id, buildingId: building.id }
        );
      }
      const width = building.interior?.width || 0;
      const height = building.interior?.height || 0;
      const byFloor = new Map();
      rooms.forEach((room) => {
        if (!room.category || !room.focus) {
          add(
            "info",
            "interiors",
            `${room.type} in ${building.name} has no category/focus metadata.`,
            { settlementId: settlement.id, buildingId: building.id, roomId: room.id }
          );
        }
        if (
          width &&
          height &&
          (room.x < 1 ||
            room.y < 1 ||
            room.x + room.w > width - 1 ||
            room.y + room.h > height - 1)
        ) {
          add(
            "error",
            "interiors",
            `${room.type} in ${building.name} is outside the room grid.`,
            { settlementId: settlement.id, buildingId: building.id, roomId: room.id }
          );
        }
        if (!room.door) {
          add(
            "error",
            "interiors",
            `${room.type} in ${building.name} has no door.`,
            { settlementId: settlement.id, buildingId: building.id, roomId: room.id }
          );
        }
        const floor = Number(room.floor) || 1;
        if (!byFloor.has(floor)) byFloor.set(floor, []);
        byFloor.get(floor).push(room);
      });
      byFloor.forEach((floorRooms, floor) => {
        for (let a = 0; a < floorRooms.length; a += 1) {
          for (let b = a + 1; b < floorRooms.length; b += 1) {
            if (overlaps(floorRooms[a], floorRooms[b])) {
              add(
                "error",
                "interiors",
                `${floorRooms[a].type} and ${floorRooms[b].type} overlap in ${building.name} (floor ${floor}).`,
                { settlementId: settlement.id, buildingId: building.id }
              );
            }
          }
        }
      });
      const floorCount = Number(building.floors) || 1;
      if (floorCount > 1) {
        (building.interior?.floors || []).forEach((floorData) => {
          if ((floorData.stairs || []).length !== 1) {
            add(
              "error",
              "interiors",
              `${building.name} floor ${floorData.floor} has ${(floorData.stairs || []).length} stairs instead of 1.`,
              { settlementId: settlement.id, buildingId: building.id }
            );
          }
        });
      }
      if (!building.interior?.floors?.[0]?.exteriorDoor) {
        add(
          "warning",
          "interiors",
          `${building.name} has no ground-floor exterior door.`,
          { settlementId: settlement.id, buildingId: building.id }
        );
      }
    });
  });

  const legacyLinks = [];
  Object.entries(world.mapTextures || {}).forEach(([biome, url]) => {
    if (isLegacySource(url)) legacyLinks.push(`map:${biome}`);
  });
  (world.settlements || []).forEach((settlement) => {
    (settlement.buildings || []).forEach((building) => {
      (building.rooms || []).forEach((room) => {
        if (isLegacySource(room.floorTextureUrl)) {
          legacyLinks.push(`floor:${settlement.name}/${building.name}/${room.type}`);
        }
        (room.stickers || []).forEach((sticker) => {
          if (isLegacySource(sticker.url)) {
            legacyLinks.push(`sticker:${settlement.name}/${building.name}/${room.type}`);
          }
        });
      });
    });
  });
  Object.entries(world.roomAssetTemplates || {}).forEach(([roomType, template]) => {
    (template?.urls || []).forEach((url) => {
      if (isLegacySource(url)) legacyLinks.push(`template:${roomType}`);
    });
  });
  if (legacyLinks.length) {
    add(
      "warning",
      "images",
      `${legacyLinks.length} image reference${legacyLinks.length === 1 ? "" : "s"} still point at a source library instead of a local project copy.`,
      { legacyLinks }
    );
  }

  const summary = issues.reduce(
    (acc, issue) => {
      if (issue.severity === "error") acc.errors += 1;
      else if (issue.severity === "warning") acc.warnings += 1;
      else acc.info += 1;
      return acc;
    },
    { errors: 0, warnings: 0, info: 0 }
  );
  return { issues, summary };
}

export function repairWorld(worldInput, character = null) {
  if (!worldInput) return worldInput;
  let next = upgradeWorld(worldInput) || worldInput;
  next = ensurePlayer(next, character);
  const report = validateWorld(next);
  const broken = new Set(
    report.issues
      .filter(
        (issue) =>
          issue.severity === "error" &&
          issue.buildingId &&
          (issue.area === "interiors" || issue.area === "events")
      )
      .map((issue) => issue.buildingId)
  );
  if (broken.size) {
    next = {
      ...next,
      settlements: (next.settlements || []).map((settlement) => ({
        ...settlement,
        buildings: (settlement.buildings || []).map((building) =>
          broken.has(building.id)
            ? ensureInterior(building, settlement, { force: true })
            : building
        ),
      })),
    };
  }
  // A second upgrade pass normalises anything the forced rebuild changed.
  return upgradeWorld(next) || next;
}
