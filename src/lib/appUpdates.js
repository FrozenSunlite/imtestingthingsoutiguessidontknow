// App update plumbing:
// - PWA: a new service worker installs in the background, waits for consent,
//   then activates and reloads the page.
// - Native APK: compares the bundled build time with a published update.json
//   and offers the new APK for download.
import { useSyncExternalStore } from "react";
import { CapacitorHttp } from "@capacitor/core";

const listeners = new Set();
let state = { waiting: null, update: null, checking: false, hidden: false };
let registration = null;
let registered = false;
let reloading = false;
let buildInfoPromise = null;

const emit = () => listeners.forEach((listener) => listener());

export function subscribeUpdates(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUpdateState() {
  return state;
}

export function useAppUpdates() {
  return useSyncExternalStore(subscribeUpdates, getUpdateState, getUpdateState);
}

export function isNativeApp() {
  if (typeof window === "undefined" || !window.Capacitor) return false;
  if (typeof window.Capacitor.isNativePlatform === "function") {
    return !!window.Capacitor.isNativePlatform();
  }
  const platform = window.Capacitor.getPlatform?.();
  return platform === "android" || platform === "ios";
}

export function loadBuildInfo() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!buildInfoPromise) {
    buildInfoPromise = fetch("/app-version.json", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  return buildInfoPromise;
}

function setWaiting(worker) {
  if (!worker) return;
  state = { ...state, waiting: worker, hidden: false };
  emit();
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || registered) return;
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  if (isNativeApp()) return;
  registered = true;

  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      registration = reg;
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.update().catch(() => {});
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setWaiting(worker);
          }
        });
      });
    })
    .catch(() => {});

  // Only reload for an update we explicitly applied; the first install also
  // fires controllerchange when the worker claims the page.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloading) return;
    window.location.reload();
  });
}

export function applyServiceWorkerUpdate() {
  const worker = state.waiting;
  if (!worker) {
    window.location.reload();
    return;
  }
  reloading = true;
  worker.postMessage({ type: "SKIP_WAITING" });
  // Safety net if the browser never reports controllerchange.
  setTimeout(() => window.location.reload(), 1500);
}

export function dismissUpdate() {
  state = { ...state, update: null, hidden: true };
  emit();
  // A dismissed SW stays installed and waiting, so it can be offered again from
  // Settings → Check for updates or on the next launch.
}

function resolveApkUrl(base, path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const root = String(base || "").replace(/\/+$/, "");
  return `${root}${path.startsWith("/") ? path : `/${path}`}`;
}

// Native WebViews are served from https://localhost, so a plain fetch to the
// update host is a cross-origin request and is blocked when the host has no
// CORS headers. CapacitorHttp performs the request natively instead.
async function fetchRemoteUpdate(url) {
  if (isNativeApp()) {
    try {
      const response = await CapacitorHttp.get({
        url,
        headers: { Accept: "application/json" },
        responseType: "json",
      });
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`update host returned ${response.status}`);
      }
      return typeof response.data === "string" ? JSON.parse(response.data) : response.data;
    } catch {
      /* fall through to fetch; useful in a browser preview of the APK */
    }
  }
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`update host returned ${response.status}`);
  return response.json();
}

// Web checks are handled by the waiting service worker. Native installs compare
// their bundled build time with a user-configured update host.
export async function checkForUpdates({ baseUrl = "" } = {}) {
  if (state.checking) return { status: "busy" };
  state = { ...state, checking: true };
  emit();
  try {
    if (!isNativeApp()) {
      if (state.waiting) {
        state = { ...state, update: { kind: "sw" }, hidden: false };
        emit();
        return { status: "available", kind: "sw" };
      }
      return { status: "current" };
    }

    const base = String(baseUrl || "").trim().replace(/\/+$/, "");
    const local = await loadBuildInfo();
    if (!base || !local?.builtAt) return { status: "unconfigured" };

    const remote = await fetchRemoteUpdate(`${base}/update.json`);
    if (!remote?.builtAt) return { status: "error" };

    if (new Date(remote.builtAt).getTime() > new Date(local.builtAt).getTime()) {
      state = {
        ...state,
        hidden: false,
        update: {
          kind: "apk",
          remote,
          apkUrl: resolveApkUrl(base, remote.apk || "/downloads/TalentTree.apk"),
        },
      };
      emit();
      return { status: "available", kind: "apk", update: state.update };
    }
    return { status: "current" };
  } catch {
    return { status: "error" };
  } finally {
    state = { ...state, checking: false };
    emit();
  }
}

// Browser/PWA download fallback. Native builds use downloadAndInstallApk()
// below, so the phone's default browser is never involved.
export async function openUpdateDownload(url) {
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.download = "TalentTree.apk";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Native Android update path: download the APK inside the app, then hand it to
// Android's package installer. No browser, no CORS, no default-browser prompt.
export async function downloadAndInstallApk(url, { onProgress } = {}) {
  if (!url) return { ok: false, reason: "missing" };
  if (!isNativeApp()) return { ok: false, reason: "web" };
  try {
    const [{ FileTransfer }, { Filesystem, Directory }, { FileOpener }] = await Promise.all([
      import("@capacitor/file-transfer"),
      import("@capacitor/filesystem"),
      import("@capacitor-community/file-opener"),
    ]);
    const path = "TalentTree-update.apk";
    const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path });
    let listener = null;
    if (onProgress && typeof FileTransfer.addListener === "function") {
      listener = await FileTransfer.addListener("progress", (progress) => {
        if (progress?.type === "download") onProgress(progress);
      });
    }
    try {
      await FileTransfer.downloadFile({ url, path: uri, progress: !!onProgress });
    } finally {
      try {
        await listener?.remove?.();
      } catch {
        /* the download already finished; cleanup must not hide that */
      }
    }
    await FileOpener.open({
      filePath: uri,
      contentType: "application/vnd.android.package-archive",
      openWithDefault: true,
    });
    return { ok: true, path: uri };
  } catch (error) {
    return { ok: false, reason: "error", error };
  }
}
