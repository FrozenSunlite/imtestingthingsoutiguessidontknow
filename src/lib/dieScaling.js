// Die scaling ladder shared by resources, unarmed strikes and any node that
// nudges a die up or down a step. The default progression is the usual
// homebrew ladder: 1, 1d4, 1d6, 1d8, 1d10, 1d12, 2d6, 2d8, 2d10, 2d12, 3d6…
// The Reference Library can override it with a custom ladder (Die Scaling).

function buildLadder(maxCount = 10) {
  const out = ["1"];
  for (let count = 1; count <= maxCount; count += 1) {
    // A single die opens at d4; once you roll several dice the ladder starts
    // at d6 (1d12 → 2d6), which is what makes the progression feel smooth.
    const sizes = count === 1 ? [4, 6, 8, 10, 12] : [6, 8, 10, 12];
    for (const size of sizes) out.push(`${count}d${size}`);
  }
  return out;
}

export const DEFAULT_DIE_SCALING = buildLadder();

// Entries are stored as { name } objects so they share the library list
// helpers, but plain strings (older saves) are accepted too.
export const dieText = (entry) =>
  (typeof entry === "string" ? entry : String(entry?.name || "")).trim();

export function dieLadder(lib) {
  const custom = (lib?.dieScaling || []).map(dieText).filter(Boolean);
  return custom.length ? custom : DEFAULT_DIE_SCALING;
}

// Accept "6", "d6", "1d6", "2d6" and normalise the dice form.
export function normalizeDieText(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return raw;
  const m = raw.match(/^(\d*)d(\d+)$/);
  if (!m) return raw;
  const count = Number(m[1] || 1);
  return `${count}d${m[2]}`;
}

// min/max/average of a die expression, or null when it isn't a die.
export function dieStats(value) {
  const text = normalizeDieText(value);
  if (!text) return null;
  if (/^\d+$/.test(text)) {
    const flat = Number(text);
    return { text, count: 0, size: 0, min: flat, max: flat, avg: flat };
  }
  const m = text.match(/^(\d+)d(\d+)$/);
  if (!m) return null;
  const count = Number(m[1]);
  const size = Number(m[2]);
  return {
    text,
    count,
    size,
    min: count,
    max: count * size,
    avg: (count * (size + 1)) / 2,
  };
}

export function dieIndex(value, ladder) {
  const norm = normalizeDieText(value);
  if (!norm) return -1;
  return ladder.findIndex((d) => normalizeDieText(d) === norm);
}

// Move a die up (+1) or down (−1) the ladder, clamped to its ends.
export function stepDie(value, delta, ladder) {
  const norm = normalizeDieText(value);
  const idx = dieIndex(norm, ladder);
  if (idx < 0) return norm;
  const next = Math.max(0, Math.min(ladder.length - 1, idx + (Number(delta) || 0)));
  return normalizeDieText(ladder[next]);
}

function withStats(text, meta) {
  const stats = dieStats(text);
  if (!stats) return null;
  return { ...stats, ...meta };
}

const asDie = (size, count) => {
  const s = String(size || "").trim().toLowerCase();
  if (!s) return "";
  const n = Number(count) || 1;
  if (/^\d+$/.test(s)) return s;
  const die = s.startsWith("d") ? s : `d${s}`;
  return n > 1 ? `${n}${die}` : `1${die}`;
};

// Resolve the die a resource rolls, combining its Reference Library
// definition with node overrides (dieOverride) and step nudges (dieAdjust).
// Returns null when the resource has no die at all.
export function resolveResourceDie(entry, lib = null) {
  if (!entry) return null;
  const ladder = dieLadder(lib);
  const name = String(entry.name || "").trim().toLowerCase();
  const libEntry = name
    ? (lib?.resources || []).find(
        (r) => String(r?.name || "").trim().toLowerCase() === name
      )
    : null;

  const override = normalizeDieText(entry.dieOverride);
  if (override) return withStats(override, { override: true, adjust: 0, mode: "override" });

  // A value of type "flat + dice" (or the legacy dice type) owns its dice as
  // part of the value, not as a resource die — don't report those here.
  const ownsDie = entry.type !== "dice" && entry.valueType !== "flatDice";
  const entrySize = ownsDie ? String(entry.dieSize || "").trim() : "";

  const libMode =
    libEntry?.dieMode ||
    (libEntry?.dieSize ? "static" : libEntry?.dieScale ? "scale" : "");
  const mode = entry.dieMode || (entrySize ? "static" : "") || libMode || "";
  if (!mode || mode === "none") return null;

  let base = "";
  if (mode === "scale") {
    base = normalizeDieText(
      entry.dieScale || libEntry?.dieScale || libEntry?.dieSize || entrySize || "1"
    );
  } else {
    const size = entrySize || libEntry?.dieSize || "";
    if (!size) return null;
    const count = entry.dieCount ?? libEntry?.dieCount ?? 1;
    base = asDie(size, count);
  }
  if (!base) return null;

  const adjust = Number(entry.dieAdjust) || 0;
  const finalText = adjust ? stepDie(base, adjust, ladder) : base;
  return withStats(finalText, { override: false, adjust, mode });
}

// A die is worth showing when it actually rolls dice; a scaling resource
// sitting at the flat "1" step shows only its numeric value.
export const isDieShown = (resolved) => !!resolved && /\d*d\d/.test(resolved.text);
