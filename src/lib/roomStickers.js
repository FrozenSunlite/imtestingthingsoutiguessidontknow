// Cosmetic room stickers. A sticker is a purely visual image placed inside a
// room: normalised position/size (0..1 of the room) plus a rotation in degrees.
// New generated rooms fall back to the world's per-room-type sticker template,
// so every interior of the same type uses the same set of assets.

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const CORNERS = [
  { x: 0.08, y: 0.08, w: 0.24, h: 0.24 },
  { x: 0.68, y: 0.08, w: 0.24, h: 0.24 },
  { x: 0.08, y: 0.68, w: 0.24, h: 0.24 },
  { x: 0.68, y: 0.68, w: 0.24, h: 0.24 },
];

const FALLBACK = [
  { x: 0.36, y: 0.34, w: 0.28, h: 0.28 },
  { x: 0.1, y: 0.1, w: 0.24, h: 0.24 },
  { x: 0.66, y: 0.1, w: 0.24, h: 0.24 },
  { x: 0.1, y: 0.66, w: 0.24, h: 0.24 },
  { x: 0.66, y: 0.66, w: 0.24, h: 0.24 },
  { x: 0.4, y: 0.08, w: 0.2, h: 0.22 },
  { x: 0.4, y: 0.7, w: 0.2, h: 0.22 },
];

const stickerKind = (url, roomType) => {
  const text = `${url || ""} ${roomType || ""}`.toLowerCase();
  if (/rug|carpet/.test(text)) return "rug";
  if (/bed|bunk|cot/.test(text)) return "bed";
  if (/table|desk|counter|bench/.test(text)) return "table";
  if (/chair|stool/.test(text)) return "chair";
  if (/barrel|crate|chest|box|sack/.test(text)) return "crate";
  if (/shelf|book|scroll|archive/.test(text)) return "shelf";
  if (/plant|tree|bush|flower|herb|garden/.test(text)) return "plant";
  if (/bar|tap|keg/.test(text)) return "bar";
  if (/bath|tub|basin/.test(text)) return "bath";
  if (/forge|anvil|furnace/.test(text)) return "forge";
  if (/altar|shrine|statue/.test(text)) return "altar";
  return "generic";
};

export function logicalStickerPlacement(room, index = 0, url = "") {
  const kind = stickerKind(url, room?.type);
  const position = (x, y, w, h, rotation = 0) => ({
    x: clamp01(x),
    y: clamp01(y),
    w: Math.min(0.9, Math.max(0.08, w)),
    h: Math.min(0.9, Math.max(0.08, h)),
    rotation,
  });

  if (kind === "rug") {
    return position(0.18, 0.5, 0.64, 0.3);
  }
  if (kind === "bed") {
    return position(0.06, 0.16, 0.4, 0.54);
  }
  if (kind === "table") {
    return position(index % 2 === 0 ? 0.3 : 0.42, 0.36, 0.34, 0.3);
  }
  if (kind === "chair") {
    return CORNERS[index % CORNERS.length];
  }
  if (kind === "crate") {
    return CORNERS[index % CORNERS.length];
  }
  if (kind === "shelf") {
    return position(0.06, 0.06, 0.55, 0.2);
  }
  if (kind === "plant") {
    return CORNERS[index % CORNERS.length];
  }
  if (kind === "bar") {
    return position(0.06, 0.06, 0.66, 0.22);
  }
  if (kind === "bath") {
    return position(0.55, 0.55, 0.35, 0.3);
  }
  if (kind === "forge") {
    return position(0.08, 0.5, 0.32, 0.34);
  }
  if (kind === "altar") {
    return position(0.32, 0.08, 0.36, 0.26);
  }
  return FALLBACK[index % FALLBACK.length];
}

export function buildStickerLayout(room, urls = []) {
  return (urls || []).map((url, index) => {
    const placement = logicalStickerPlacement(room, index, url);
    return {
      id: `sticker_${room?.id || "room"}_${index}`,
      url,
      x: placement.x,
      y: placement.y,
      w: placement.w,
      h: placement.h,
      rotation: placement.rotation || 0,
      template: false,
    };
  });
}

export function normalizeSticker(sticker, room, index = 0) {
  const placement = logicalStickerPlacement(room, index, sticker?.url || "");
  return {
    id: sticker?.id || `sticker_${room?.id || "room"}_${index}`,
    url: sticker?.url || "",
    x: sticker?.x != null ? clamp01(sticker.x) : placement.x,
    y: sticker?.y != null ? clamp01(sticker.y) : placement.y,
    w: sticker?.w != null ? Math.min(0.95, Math.max(0.05, Number(sticker.w) || placement.w)) : placement.w,
    h: sticker?.h != null ? Math.min(0.95, Math.max(0.05, Number(sticker.h) || placement.h)) : placement.h,
    rotation: [0, 90, 180, 270].includes(Number(sticker?.rotation)) ? Number(sticker.rotation) : 0,
    template: !!sticker?.template,
  };
}

// The list a room should actually show: explicit stickers first, then per-room
// assets from older saves, then the world-level sticker template for this room
// type. This is what makes every generated interior of a type share the same
// sticker set.
export function roomStickerList(room, templateUrls = []) {
  // A room that was explicitly edited (even down to zero stickers) keeps its
  // own list. Otherwise the shared room-type template is used.
  if (Array.isArray(room?.stickers) && (room.stickers.length || room?.stickersCustom)) {
    return room.stickers.map((sticker, index) => normalizeSticker(sticker, room, index));
  }
  const urls = Array.isArray(room?.assets) && room.assets.length
    ? room.assets
    : templateUrls;
  return buildStickerLayout(room, urls);
}
