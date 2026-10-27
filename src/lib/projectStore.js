// The working project (tree, character, settings) and the named save slots
// live in IndexedDB. localStorage capped out around 5 MB as soon as a project
// carried more than one tree snapshot, which made saves fail with "Local
// storage is full"; IndexedDB stores whole objects without that ceiling.
//
// Older builds wrote the same data to localStorage. `migrateLegacyStorage`
// copies it across once, then removes the copies so the quota is released.
// Small preferences (theme, panel widths, rulebook) stay in localStorage.

const DB_NAME = "talent-tree";
const DB_VERSION = 1;
const KV_STORE = "kv";
const SAVES_STORE = "saves";

export const LEGACY_KEYS = {
  tree: "skilltree:tree",
  character: "skilltree:character",
  settings: "skilltree:settings",
  saves: "skilltree:characterSaves",
};

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
      if (!db.objectStoreNames.contains(SAVES_STORE))
        db.createObjectStore(SAVES_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Could not open the project database."));
    req.onblocked = () =>
      reject(new Error("The project database is open in another tab — close it and try again."));
  });
  return dbPromise;
}

// Resolve when a transaction commits, reject when it fails or aborts.
function settled(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Project write failed."));
    tx.onabort = () => reject(tx.error || new Error("Project write was cancelled."));
  });
}

function asked(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function kvGet(key) {
  const db = await openDb();
  const tx = db.transaction(KV_STORE, "readonly");
  return asked(tx.objectStore(KV_STORE).get(key));
}

async function kvPut(key, value) {
  const db = await openDb();
  const tx = db.transaction(KV_STORE, "readwrite");
  tx.objectStore(KV_STORE).put(value, key);
  await settled(tx);
  return value;
}

// Read one working-project document. Missing keys (first run) return the
// fallback; a broken database falls back to any leftover localStorage copy.
export async function readProjectValue(key, fallback = null) {
  try {
    const value = await kvGet(key);
    if (value !== undefined) return value;
  } catch {
    /* fall through to the legacy copy */
  }
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// Store one working-project document. Throws so the caller can report a real
// failure instead of silently dropping an edit.
export async function writeProjectValue(key, value) {
  return kvPut(key, value);
}

// Save slots, newest first.
export async function listSaves() {
  try {
    const db = await openDb();
    const tx = db.transaction(SAVES_STORE, "readonly");
    const rows = await asked(tx.objectStore(SAVES_STORE).getAll());
    return (Array.isArray(rows) ? rows : []).sort((a, b) =>
      String(b?.date || "").localeCompare(String(a?.date || ""))
    );
  } catch {
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEYS.saves) || "[]");
      return Array.isArray(legacy) ? legacy : [];
    } catch {
      return [];
    }
  }
}

export async function putSave(entry) {
  const db = await openDb();
  const tx = db.transaction(SAVES_STORE, "readwrite");
  tx.objectStore(SAVES_STORE).put(entry);
  await settled(tx);
  return entry;
}

export async function removeSave(id) {
  const db = await openDb();
  const tx = db.transaction(SAVES_STORE, "readwrite");
  tx.objectStore(SAVES_STORE).delete(id);
  await settled(tx);
}

// One-time move of the old localStorage documents into IndexedDB. Each key is
// removed only after it is safely stored, so an interrupted migration can run
// again on the next launch.
export async function migrateLegacyStorage() {
  const moved = [];
  for (const key of [LEGACY_KEYS.tree, LEGACY_KEYS.character, LEGACY_KEYS.settings]) {
    let raw = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      /* storage disabled */
    }
    if (raw == null) continue;
    try {
      const value = JSON.parse(raw);
      await kvPut(key, value);
      localStorage.removeItem(key);
      moved.push(key);
    } catch {
      /* keep the legacy copy for the next attempt */
    }
  }

  try {
    const raw = localStorage.getItem(LEGACY_KEYS.saves);
    if (raw != null) {
      const rows = JSON.parse(raw);
      if (Array.isArray(rows)) {
        for (const row of rows) if (row && row.id) await putSave(row);
      }
      localStorage.removeItem(LEGACY_KEYS.saves);
      moved.push(LEGACY_KEYS.saves);
    }
  } catch {
    /* keep the legacy copy for the next attempt */
  }

  return moved;
}
