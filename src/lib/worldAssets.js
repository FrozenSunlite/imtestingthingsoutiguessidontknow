// Client helpers for the sticker-library index served by Serve.ps1.

export const FLOOR_TEXTURES = [
  { id: "grass", label: "Grass", query: "grass texture", color: "#6f8f4a" },
  { id: "moss", label: "Moss", query: "moss texture", color: "#5d7a43" },
  { id: "wood", label: "Wooden planks", query: "wood floor plank", color: "#8a6844" },
  { id: "stone", label: "Stone", query: "stone floor texture", color: "#77746e" },
  { id: "marble", label: "Marble", query: "marble texture", color: "#b9b4a8" },
  { id: "tile", label: "Tile", query: "tile floor texture", color: "#9a8f7d" },
  { id: "dirt", label: "Dirt", query: "dirt ground texture", color: "#7a5c3e" },
  { id: "sand", label: "Sand", query: "sand texture", color: "#c6a76a" },
  { id: "snow", label: "Snow", query: "snow texture", color: "#d7e2e4" },
  { id: "carpet", label: "Carpet", query: "carpet texture", color: "#8d3f46" },
  { id: "water", label: "Water", query: "water texture", color: "#3f7f96" },
  { id: "lava", label: "Lava", query: "lava texture", color: "#9c3a24" },
];

export const ROOM_ASSET_BUNDLES = {
  Bedroom: { query: "bed bedroom furniture", types: ["Furnishing", "Object"] },
  Kitchen: { query: "kitchen hearth cooking furniture", types: ["Furnishing", "Object"] },
  "Common Room": { query: "table chair tavern furniture", types: ["Furnishing", "Object"] },
  Cellar: { query: "barrel crate cellar", types: ["Furnishing", "Object"] },
  Smithy: { query: "anvil forge smithy", types: ["Furnishing", "Object"] },
  Workshop: { query: "workbench tools workshop", types: ["Furnishing", "Object"] },
  Storage: { query: "crate barrel shelf", types: ["Furnishing", "Object"] },
  Office: { query: "desk chair books", types: ["Furnishing", "Object"] },
  Hall: { query: "table chair hall", types: ["Furnishing", "Object"] },
  Sanctuary: { query: "altar temple shrine", types: ["Furnishing", "Object"] },
  Shrine: { query: "altar shrine", types: ["Furnishing", "Object"] },
  Vestry: { query: "cabinet robe chest", types: ["Furnishing", "Object"] },
  Garden: { query: "garden plant tree", types: ["Furnishing", "Object"] },
  "Great Hall": { query: "throne table chair", types: ["Furnishing", "Object"] },
  Library: { query: "bookshelf book library", types: ["Furnishing", "Object"] },
  Study: { query: "desk books chair", types: ["Furnishing", "Object"] },
  Bath: { query: "bath tub", types: ["Furnishing", "Object"] },
  "Living Room": { query: "chair table hearth", types: ["Furnishing", "Object"] },
  Privy: { query: "privy", types: ["Object"] },
  "Bunk Room": { query: "bunk bed", types: ["Furnishing", "Object"] },
  Armory: { query: "weapon rack armor", types: ["Furnishing", "Object"] },
  "Mess Hall": { query: "table bench", types: ["Furnishing", "Object"] },
  "Drill Hall": { query: "training dummy weapon rack", types: ["Furnishing", "Object"] },
  "Meeting Hall": { query: "table chair council", types: ["Furnishing", "Object"] },
  Archive: { query: "shelf scroll book", types: ["Furnishing", "Object"] },
  Treasury: { query: "chest coins gold", types: ["Furnishing", "Object"] },
  "Reading Room": { query: "chair table book", types: ["Furnishing", "Object"] },
  Laboratory: { query: "alembic laboratory table", types: ["Furnishing", "Object"] },
  Shop: { query: "counter shelf shop", types: ["Furnishing", "Object"] },
  Stalls: { query: "market stall", types: ["Furnishing", "Object"] },
};

export async function listImportedImages() {
  try {
    // no-store matters: an old SPA fallback response must never be reused as
    // the imported-image list after the local server gains this endpoint.
    const res = await fetch("/api/images/list", { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.images) ? data.images : [];
  } catch {
    return [];
  }
}

export async function fetchAssetStatus() {
  try {
    const res = await fetch("/api/assets/status", { cache: "no-store" });
    if (!res.ok) throw new Error("asset server unavailable");
    return await res.json();
  } catch {
    return { available: false, files: 0, root: "" };
  }
}

// Change the folder the sticker browser reads from. The server rewrites
// userdata/paths.json, clears the old index and rebuilds it in place. Files are
// still copied into userdata/images when they are placed in a room.
export async function setStickerRoot(root) {
  const res = await fetch("/api/assets/root", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ root }),
  });
  if (!res.ok) throw new Error("could not change the sticker folder");
  return res.json();
}

// Open a native folder picker on the machine running the local server.
export async function pickStickerFolder() {
  const res = await fetch("/api/assets/pick-folder", { method: "POST" });
  if (!res.ok) throw new Error("could not open the folder picker");
  return res.json();
}

export async function fetchAssetCategories() {
  try {
    const res = await fetch("/api/assets/categories");
    if (!res.ok) throw new Error("no asset categories");
    const data = await res.json();
    return data.categories || {};
  } catch {
    return {};
  }
}

export async function fetchAssets({ q = "", category = "", limit = 60, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  try {
    const res = await fetch(`/api/assets/list?${params.toString()}`);
    if (!res.ok) throw new Error("asset search failed");
    return await res.json();
  } catch {
    return { total: 0, offset, limit, items: [] };
  }
}

export async function importAsset(path) {
  if (!path) return "";
  try {
    const res = await fetch(`/api/assets/import?path=${encodeURIComponent(path)}`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("asset import failed");
    const data = await res.json();
    return data?.url || "";
  } catch {
    return "";
  }
}

// The asset index treats multi-word queries as an AND search, so a bundle like
// "chair table hearth" can legitimately match nothing. Fall back to the most
// specific single term before giving up, which keeps room templates useful.
export async function fetchAssetsSmart({ q = "", category = "", limit = 60, offset = 0 } = {}) {
  const result = await fetchAssets({ q, category, limit, offset });
  if (result.items?.length || !String(q).trim()) return result;
  const tokens = String(q)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
  for (const token of tokens) {
    const fallback = await fetchAssets({ q: token, category, limit, offset });
    if (fallback.items?.length) return { ...fallback, query: token };
  }
  return result;
}

export const floorTexture = (id) =>
  FLOOR_TEXTURES.find((texture) => texture.id === id) || FLOOR_TEXTURES[0];

export const roomBundle = (roomType) =>
  ROOM_ASSET_BUNDLES[roomType] || {
    query: String(roomType || "furniture"),
    types: ["Furnishing", "Object"],
  };
