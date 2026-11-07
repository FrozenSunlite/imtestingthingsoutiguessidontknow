// In-app diagnostic log.
//
// The Settings > Diagnostics tab reads this store so a user can copy the exact
// error text after something fails. Entries are kept in memory and mirrored to
// localStorage (a bounded ring buffer) so closing Settings, or reloading after
// a crash, does not lose the message.
//
// Captured:
// - console.error / console.warn
// - uncaught window errors
// - unhandled promise rejections
// - toast.error(...) calls (the app's user-facing error path)
// - failed local /api requests and network failures
//
// Deliberately not captured: console.log and successful requests, which would
// bury the useful lines.

import { toast } from "sonner";

const STORAGE_KEY = "skilltree:diagnostics";
const MAX_ENTRIES = 250;
const MAX_TEXT = 6000;
const EMPTY = [];

let entries = EMPTY;
let loaded = false;
let installed = false;
let persistTimer = 0;
const listeners = new Set();

const truncate = (value) => {
  const text = String(value ?? "");
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n… [truncated]` : text;
};

const safeText = (value, depth = 0) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (typeof value === "object") {
    if (depth > 3) return "[object]";
    try {
      const seen = new WeakSet();
      return JSON.stringify(value, (_key, item) => {
        if (typeof item === "bigint") return `${item}n`;
        if (typeof item === "function") return "[function]";
        if (typeof item === "object" && item !== null) {
          if (seen.has(item)) return "[circular]";
          seen.add(item);
        }
        return item;
      });
    } catch {
      try {
        return String(value);
      } catch {
        return "[object]";
      }
    }
  }
  return String(value);
};

const notify = () => {
  listeners.forEach((listener) => {
    try {
      listener(entries);
    } catch {
      /* a listener must never break logging */
    }
  });
};

const readStored = () => {
  if (loaded) return;
  loaded = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    entries = parsed
      .filter((entry) => entry && typeof entry === "object" && entry.message)
      .slice(-MAX_ENTRIES)
      .map((entry) => ({
        id: String(entry.id || ""),
        at: String(entry.at || ""),
        level: String(entry.level || "error"),
        message: String(entry.message || ""),
        detail: String(entry.detail || ""),
        url: String(entry.url || ""),
      }));
  } catch {
    entries = EMPTY;
  }
};

const flushStored = () => {
  if (typeof window === "undefined") return;
  try {
    if (!entries.length) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage is best-effort */
  }
};

const schedulePersist = () => {
  if (typeof window === "undefined") return;
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(flushStored, 200);
};

export function logDiagnostic(level, message, detail = "") {
  readStored();
  const text = safeText(message);
  if (!text) return null;
  const entry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    level: String(level || "error").toLowerCase(),
    message: truncate(text),
    detail: truncate(safeText(detail)),
    url: typeof location !== "undefined" ? location.href : "",
  };
  entries = [...entries, entry].slice(-MAX_ENTRIES);
  schedulePersist();
  notify();
  return entry;
}

export function getDiagnostics() {
  readStored();
  return entries;
}

export function subscribeDiagnostics(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearDiagnostics() {
  readStored();
  entries = EMPTY;
  if (typeof window !== "undefined") {
    window.clearTimeout(persistTimer);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  notify();
}

export function formatDiagnostics(list = getDiagnostics(), { newestFirst = true } = {}) {
  const ordered = newestFirst ? [...list].reverse() : list;
  const header = [
    "Talent Tree diagnostic log",
    `Exported: ${new Date().toISOString()}`,
    `Page: ${typeof location !== "undefined" ? location.href : ""}`,
    `User agent: ${typeof navigator !== "undefined" ? navigator.userAgent : ""}`,
    `Platform: ${typeof navigator !== "undefined" ? navigator.platform : ""}`,
    `Entries: ${ordered.length}`,
    "",
  ];
  const body = ordered.map((entry) => {
    const lines = [`[${entry.at}] ${String(entry.level || "error").toUpperCase()} ${entry.message}`];
    if (entry.detail) lines.push(entry.detail);
    if (entry.url) lines.push(`at ${entry.url}`);
    return lines.join("\n");
  });
  return [...header, ...body].join("\n\n");
}

export async function copyDiagnostics(list = getDiagnostics()) {
  const text = formatDiagnostics(list);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadDiagnostics(list = getDiagnostics()) {
  const text = formatDiagnostics(list);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  try {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `talent-tree-diagnostics-${stamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

const shouldLogRequest = (rawUrl) => {
  if (typeof location === "undefined") return false;
  try {
    const url = new URL(String(rawUrl || ""), location.href);
    if (url.origin !== location.origin) return false;
    if (!url.pathname.startsWith("/api/")) return false;
    // Artwork lookups return expected 404s for books without every picture;
    // they are noise rather than an application failure.
    return !/^\/api\/(5etools\/)?(image|brew-image|image-proxy)/.test(url.pathname);
  } catch {
    return false;
  }
};

export function installDiagnostics() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  readStored();

  const originalError = console.error;
  console.error = (...args) => {
    logDiagnostic("error", args.map((arg) => safeText(arg)).join(" "));
    originalError.apply(console, args);
  };

  const originalWarn = console.warn;
  console.warn = (...args) => {
    logDiagnostic("warn", args.map((arg) => safeText(arg)).join(" "));
    originalWarn.apply(console, args);
  };

  window.addEventListener("error", (event) => {
    const source = event.filename
      ? `${event.filename}:${event.lineno || 0}:${event.colno || 0}`
      : "";
    logDiagnostic("error", event.message || "Uncaught error", event.error?.stack || source);
  });

  window.addEventListener("unhandledrejection", (event) => {
    logDiagnostic("error", "Unhandled promise rejection", safeText(event.reason));
  });

  if (typeof toast?.error === "function") {
    const originalToastError = toast.error;
    toast.error = (...args) => {
      const data = args[1];
      const detail =
        typeof data === "string"
          ? data
          : data?.description
            ? safeText(data.description)
            : "";
      logDiagnostic("error", args[0], detail);
      return originalToastError(...args);
    };
  }

  if (typeof window.fetch === "function") {
    const originalFetch = window.fetch;
    window.fetch = function diagnosticFetch(...args) {
      const input = args[0];
      const url = typeof input === "string" ? input : input?.url || "";
      return originalFetch
        .apply(this, args)
        .then((response) => {
          if (!response.ok && shouldLogRequest(url)) {
            logDiagnostic(
              "warn",
              `HTTP ${response.status} ${url}`,
              response.statusText || ""
            );
          }
          return response;
        })
        .catch((error) => {
          if (shouldLogRequest(url)) {
            logDiagnostic("error", `Network request failed: ${url}`, safeText(error));
          }
          throw error;
        });
    };
  }

  window.addEventListener("pagehide", flushStored);
  window.addEventListener("beforeunload", flushStored);
}
