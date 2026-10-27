import { feetToSpacesText } from "@/lib/resources";

const TYPE_ALIASES = {
  walk: "Standard",
  land: "Standard",
  standard: "Standard",
  fly: "Flying",
  flying: "Flying",
  swim: "Swimming",
  swimming: "Swimming",
  climb: "Climbing",
  climbing: "Climbing",
  burrow: "Burrowing",
  burrowing: "Burrowing",
};

const title = (s) => String(s || "").trim().replace(/\b\w/g, (c) => c.toUpperCase());

export function speedTypeName(type) {
  const key = String(type || "").trim().toLowerCase();
  return TYPE_ALIASES[key] || title(type);
}

const toSpaces = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n / 5) * 10) / 10;
};

// Turn any monster speed shape into [{ type, spaces }]:
//   { walk: 30, fly: 60 } / "30 ft., fly 60 ft." / "6 spaces, fly 12 spaces"
//   / [{ type: "Flying", spaces: 12 }] / 30
export function speedEntries(speed) {
  if (speed == null || speed === "") return [];
  if (Array.isArray(speed)) {
    return speed
      .map((e) => {
        if (typeof e === "object" && e) {
          const name = e.type || e.name || "Standard";
          const spaces = e.spaces ?? e.value ?? e.number;
          return { type: speedTypeName(name), spaces: Number(spaces) || 0 };
        }
        return null;
      })
      .filter(Boolean);
  }
  if (typeof speed === "number") {
    return [{ type: "Standard", spaces: toSpaces(speed) }];
  }
  if (typeof speed === "string") {
    const text = feetToSpacesText(speed);
    return text
      .split(",")
      .map((part) => {
        const m = part
          .trim()
          .match(/^(?:([a-z][a-z ]*?)\s*)?(\d+(?:\.\d+)?)\s*(?:spaces?|ft\.?|feet|foot)?$/i);
        if (!m) return null;
        return {
          type: speedTypeName(m[1] || "Standard"),
          spaces: Number(m[2]) || 0,
        };
      })
      .filter(Boolean);
  }
  if (typeof speed === "object") {
    return Object.entries(speed)
      .filter(([, v]) => typeof v === "number" || (v && typeof v === "object" && Number.isFinite(Number(v.number ?? v.value))))
      .map(([type, v]) => ({
        type: speedTypeName(type),
        spaces: toSpaces(typeof v === "object" ? v.number ?? v.value : v),
      }));
  }
  return [];
}

// Human-readable fallback used by the familiar statblock and legacy fields.
export function speedTextFromEntries(entries) {
  return (entries || [])
    .filter((e) => e && e.type && Number.isFinite(Number(e.spaces)))
    .map((e) => (e.type === "Standard" ? `${e.spaces} spaces` : `${e.type} ${e.spaces} spaces`))
    .join(", ");
}
