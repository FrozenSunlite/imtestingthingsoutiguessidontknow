// Free SRD reference content. The seed is generated from 5eTools' `srd` and
// `srd52` flags by scripts/generate-srd-seed.mjs and shipped as a static file,
// so the app never needs the 5eTools data folder at runtime.
//
// Both SRD editions are licensed CC-BY 4.0 and require attribution. The
// wording below is the attribution published with the SRD documents.

export const SRD_SEED_VERSION = 1;
export const SRD_SEED_URL = "/srd/srd-seed.json";

export const SRD_ATTRIBUTION = {
  srd51:
    'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.',
  srd52:
    'This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.',
};

let seedPromise = null;

export function loadSrdSeed() {
  if (!seedPromise) {
    seedPromise = fetch(SRD_SEED_URL, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load the SRD reference data.");
        return response.json();
      })
      .catch((error) => {
        seedPromise = null;
        throw error;
      });
  }
  return seedPromise;
}

const nameOf = (entry) =>
  String(typeof entry === "string" ? entry : entry?.name || "")
    .trim()
    .toLowerCase();

// Add anything the project does not already have. Existing entries always win,
// so a user's edits and imports are never overwritten by the seed.
export function mergeSrdSeed(library, seed) {
  if (!library || !seed?.library) return { library, added: 0 };
  const next = { ...library };
  let added = 0;

  const mergeList = (key, incoming) => {
    if (!Array.isArray(incoming)) return;
    const existing = Array.isArray(next[key]) ? [...next[key]] : [];
    const seen = new Set(existing.map(nameOf));
    for (const entry of incoming) {
      const name = nameOf(entry);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      existing.push(entry);
      added += 1;
    }
    next[key] = existing;
  };

  for (const [key, value] of Object.entries(seed.library)) {
    if (key === "lists" || key === "fiveETools") continue;
    mergeList(key, value);
  }

  const lists = { ...(next.lists || {}) };
  for (const [key, value] of Object.entries(seed.library.lists || {})) {
    if (!Array.isArray(value)) continue;
    const existing = Array.isArray(lists[key]) ? [...lists[key]] : [];
    const seen = new Set(existing.map(nameOf));
    for (const entry of value) {
      const name = nameOf(entry);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      existing.push(entry);
      added += 1;
    }
    lists[key] = existing;
  }
  next.lists = lists;

  const raw = { ...(next.fiveETools || {}) };
  for (const [category, value] of Object.entries(seed.library.fiveETools || {})) {
    if (!Array.isArray(value)) continue;
    const existing = Array.isArray(raw[category]) ? [...raw[category]] : [];
    const seen = new Set(
      existing.map(
        (entry) => `${nameOf(entry)}|${String(entry?.source || "").toLowerCase()}`
      )
    );
    for (const entry of value) {
      const name = nameOf(entry);
      if (!name) continue;
      const key = `${name}|${String(entry?.source || "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      existing.push(entry);
      added += 1;
    }
    raw[category] = existing;
  }
  next.fiveETools = raw;

  return { library: next, added };
}

export async function fetchAndMergeSrdSeed(library) {
  const seed = await loadSrdSeed();
  return mergeSrdSeed(library, seed);
}
