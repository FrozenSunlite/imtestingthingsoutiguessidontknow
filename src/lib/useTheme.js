import { useEffect, useState } from "react";

// App theme, shared by every Settings menu instance; the choice persists in
// localStorage. `cyber`/`dark` drive the original cyberpunk/classic look, while
// `template` selects one of the colour/font presets (or Custom, which reads the
// `custom` colours and fonts edited in Settings).

export const DEFAULT_CUSTOM = {
  background: "#12161d",
  surface: "#1a2029",
  text: "#eef2f7",
  muted: "#9aa5b1",
  accent: "#22d3ee",
  border: "#2f3a47",
  font: "ui-sans-serif, system-ui, sans-serif",
  headingFont: "",
};

export const FONT_OPTIONS = [
  "ui-sans-serif, system-ui, sans-serif",
  "Georgia, 'Times New Roman', serif",
  "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
  "'Trebuchet MS', sans-serif",
  "Verdana, Geneva, sans-serif",
  "Tahoma, sans-serif",
  "'Courier New', monospace",
  "ui-monospace, SFMono-Regular, Menlo, monospace",
];

// Commonly appreciated palettes. Each preset defines its own light/dark
// surface set; selecting one overrides the classic/cyberpunk classes.
export const COLOR_TEMPLATES = [
  { id: "default", label: "Default (cyber / classic)" },
  {
    id: "parchment",
    label: "Parchment",
    dark: false,
    colors: {
      background: "#f4ead3",
      surface: "#fffaf0",
      text: "#3a2a1d",
      muted: "#7a6a57",
      accent: "#8b3a2e",
      border: "#d6c3a1",
      font: "Georgia, 'Times New Roman', serif",
    },
  },
  {
    id: "solarized",
    label: "Solarized",
    dark: false,
    colors: {
      background: "#fdf6e3",
      surface: "#eee8d5",
      text: "#073642",
      muted: "#657b83",
      accent: "#268bd2",
      border: "#93a1a1",
      font: "Verdana, Geneva, sans-serif",
    },
  },
  {
    id: "forest",
    label: "Forest",
    dark: true,
    colors: {
      background: "#101d16",
      surface: "#18291f",
      text: "#e8f3ea",
      muted: "#a3b7a7",
      accent: "#63d99b",
      border: "#2d4535",
      font: "'Trebuchet MS', sans-serif",
    },
  },
  {
    id: "ocean",
    label: "Ocean",
    dark: true,
    colors: {
      background: "#0a1d27",
      surface: "#112f3d",
      text: "#e5f3f8",
      muted: "#9ab6c2",
      accent: "#38bdf8",
      border: "#21495b",
      font: "Verdana, Geneva, sans-serif",
    },
  },
  {
    id: "rose",
    label: "Rose Quartz",
    dark: false,
    colors: {
      background: "#fdf1f5",
      surface: "#fff8fb",
      text: "#3d1f2b",
      muted: "#8c6473",
      accent: "#be185d",
      border: "#efc9d7",
      font: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    dark: true,
    colors: {
      background: "#0b1020",
      surface: "#141a2e",
      text: "#e7eaf6",
      muted: "#a0a8c0",
      accent: "#8b5cf6",
      border: "#29334f",
      font: "ui-sans-serif, system-ui, sans-serif",
    },
  },
  {
    id: "highContrast",
    label: "High Contrast",
    dark: true,
    colors: {
      background: "#000000",
      surface: "#111111",
      text: "#ffffff",
      muted: "#cccccc",
      accent: "#ffee00",
      border: "#666666",
      font: "Arial, Helvetica, sans-serif",
    },
  },
  { id: "custom", label: "Custom…" },
];

function parseHex(hex) {
  let h = String(hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function toHex([r, g, b]) {
  return (
    "#" +
    [r, g, b]
      .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function mixHex(a, b, t) {
  const A = parseHex(a);
  const B = parseHex(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
}

export function hexToHsl(hex) {
  const [r255, g255, b255] = parseHex(hex);
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const isDarkColor = (hex) => {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
};

const contrastColor = (hex) => (isDarkColor(hex) ? "#ffffff" : "#111111");

function templateColors(template, custom) {
  if (template === "custom") return { ...DEFAULT_CUSTOM, ...(custom || {}) };
  const preset = COLOR_TEMPLATES.find((t) => t.id === template);
  return preset?.colors || null;
}

// CSS variables (raw HSL triplets) for a non-default template.
export function themeVars(template, custom) {
  const c = templateColors(template, custom);
  if (!c) return {};
  const secondary = mixHex(c.surface, c.text, 0.09);
  const mutedSurface = mixHex(c.surface, c.background, 0.45);
  const accentSurface = mixHex(c.surface, c.accent, 0.16);
  const vars = {
    "--background": hexToHsl(c.background),
    "--foreground": hexToHsl(c.text),
    "--card": hexToHsl(c.surface),
    "--card-foreground": hexToHsl(c.text),
    "--popover": hexToHsl(c.surface),
    "--popover-foreground": hexToHsl(c.text),
    "--primary": hexToHsl(c.accent),
    "--primary-foreground": hexToHsl(contrastColor(c.accent)),
    "--secondary": hexToHsl(secondary),
    "--secondary-foreground": hexToHsl(c.text),
    "--muted": hexToHsl(mutedSurface),
    "--muted-foreground": hexToHsl(c.muted),
    "--accent": hexToHsl(accentSurface),
    "--accent-foreground": hexToHsl(c.text),
    "--destructive": hexToHsl("#dc2626"),
    "--destructive-foreground": hexToHsl("#ffffff"),
    "--border": hexToHsl(c.border),
    "--input": hexToHsl(c.border),
    "--ring": hexToHsl(c.accent),
    "--chart-1": hexToHsl(c.accent),
    "--chart-2": hexToHsl(mixHex(c.accent, c.text, 0.3)),
    "--chart-3": hexToHsl(mixHex(c.accent, c.background, 0.3)),
    "--chart-4": hexToHsl(mixHex(c.accent, "#f59e0b", 0.45)),
    "--chart-5": hexToHsl(mixHex(c.accent, "#ec4899", 0.45)),
    "--sidebar-background": hexToHsl(c.surface),
    "--sidebar-foreground": hexToHsl(c.text),
    "--sidebar-primary": hexToHsl(c.accent),
    "--sidebar-primary-foreground": hexToHsl(contrastColor(c.accent)),
    "--sidebar-accent": hexToHsl(accentSurface),
    "--sidebar-accent-foreground": hexToHsl(c.text),
    "--sidebar-border": hexToHsl(c.border),
    "--sidebar-ring": hexToHsl(c.accent),
  };
  const font = (c.font || "").trim();
  if (font) {
    vars["--font-body"] = font;
    vars["--font-heading"] = (c.headingFont || "").trim() || font;
    vars["--font-display"] = (c.headingFont || "").trim() || font;
  }
  return vars;
}

const APPLIED_VARS = [];
function applyVars(el, vars) {
  APPLIED_VARS.forEach((key) => el.style.removeProperty(key));
  APPLIED_VARS.length = 0;
  Object.entries(vars).forEach(([key, value]) => {
    el.style.setProperty(key, value);
    APPLIED_VARS.push(key);
  });
}

function normalizeTheme(t) {
  const theme = { cyber: true, dark: true, ...(t || {}) };
  if (!theme.template) theme.template = "default";
  theme.custom = { ...DEFAULT_CUSTOM, ...(theme.custom || {}) };
  return theme;
}

function readTheme() {
  try {
    const raw = localStorage.getItem("skilltree:theme");
    if (raw) return normalizeTheme(JSON.parse(raw));
    // Migrate the old toolbar dark-mode flag.
    const old = localStorage.getItem("skilltree:dark");
    if (old) return normalizeTheme({ cyber: true, dark: old === "1" });
  } catch {
    /* ignore */
  }
  return normalizeTheme({ cyber: true, dark: true });
}

export function useTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const el = document.documentElement;
    const template = theme.template || "default";
    const preset = COLOR_TEMPLATES.find((t) => t.id === template);
    const isCustom = template === "custom";
    const isPreset = !!preset && template !== "default";
    const custom = { ...DEFAULT_CUSTOM, ...(theme.custom || {}) };
    const dark = isCustom
      ? isDarkColor(custom.background)
      : isPreset
      ? !!preset.dark
      : !!theme.dark;
    el.classList.toggle("cyberpunk", template === "default" ? !!theme.cyber : false);
    el.classList.toggle("dark", dark);
    applyVars(el, isPreset ? themeVars(template, custom) : {});
    try {
      localStorage.setItem("skilltree:theme", JSON.stringify(theme));
    } catch {
      /* ignore */
    }
  }, [theme]);
  return [theme, setTheme];
}
