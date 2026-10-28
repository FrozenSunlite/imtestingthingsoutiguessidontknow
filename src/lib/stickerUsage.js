// Where are the project's stickers used? This walks the setting and returns one
// entry per unique image URL with every room, floor, map texture and template
// reference. The Stickers page uses it for the "Loaded stickers" library.

export function collectStickerUsage(world) {
  const usages = new Map();
  const add = (url, usage) => {
    if (!url) return;
    if (!usages.has(url)) usages.set(url, []);
    const list = usages.get(url);
    if (
      !list.some(
        (item) =>
          item.kind === usage.kind &&
          item.settlementId === usage.settlementId &&
          item.buildingId === usage.buildingId &&
          item.roomId === usage.roomId &&
          item.roomType === usage.roomType &&
          item.biome === usage.biome
      )
    ) {
      list.push(usage);
    }
  };

  (world?.settlements || []).forEach((settlement) => {
    (settlement.buildings || []).forEach((building) => {
      (building.rooms || []).forEach((room) => {
        (room.stickers || []).forEach((sticker) => {
          add(sticker.url, {
            kind: "sticker",
            label: "Room sticker",
            settlementId: settlement.id,
            settlementName: settlement.name,
            buildingId: building.id,
            buildingName: building.name,
            roomId: room.id,
            roomType: room.type,
          });
        });
        (room.assets || []).forEach((url) => {
          add(url, {
            kind: "asset",
            label: "Legacy room asset",
            settlementId: settlement.id,
            settlementName: settlement.name,
            buildingId: building.id,
            buildingName: building.name,
            roomId: room.id,
            roomType: room.type,
          });
        });
        if (room.floorTextureUrl) {
          add(room.floorTextureUrl, {
            kind: "floor",
            label: "Room floor material",
            settlementId: settlement.id,
            settlementName: settlement.name,
            buildingId: building.id,
            buildingName: building.name,
            roomId: room.id,
            roomType: room.type,
          });
        }
      });
    });
  });

  Object.entries(world?.roomAssetTemplates || {}).forEach(([roomType, template]) => {
    (template?.urls || []).forEach((url) => {
      add(url, {
        kind: "template",
        label: `${roomType} sticker template`,
        roomType,
      });
    });
  });

  Object.entries(world?.mapTextures || {}).forEach(([biome, url]) => {
    add(url, {
      kind: "map",
      label: `World map ${biome} texture`,
      biome,
    });
  });

  return [...usages.entries()]
    .map(([url, list]) => ({ url, usages: list }))
    .sort((a, b) => b.usages.length - a.usages.length || a.url.localeCompare(b.url));
}

export function stickerFileName(url) {
  const text = String(url || "").split("?")[0].split("/").pop() || url || "Sticker";
  return decodeURIComponent(text);
}
