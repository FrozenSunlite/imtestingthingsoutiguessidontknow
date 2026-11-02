// Shared audio engine: one music <audio> element with 1-second crossfades,
// plus a lazily-created Web Audio context for short sound effects.
//
// Everything is module-level because the music element must survive dialog
// mounts and re-renders. React components subscribe through MusicPlayer.

export const DEFAULT_AUDIO_SETTINGS = {
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.3,
  sfxVolume: 0.5,
  musicMuted: false,
  sfxMuted: false,
  shuffle: true,
  customMusic: false,
  nowPlaying: true,
  // File path of the last explicitly chosen track. Empty means "pick one".
  track: "",
  // Bumped when a default changes so existing saves can migrate once.
  defaultsVersion: 2,
};

export const FADE_MS = 1000;
export const NOW_PLAYING_MS = 6000;

const clamp = (n) => Math.max(0, Math.min(1, Number(n) || 0));

const music = {
  el: null,
  volume: DEFAULT_AUDIO_SETTINGS.musicVolume,
  muted: false,
  fadeFrame: 0,
  fadeResolve: null,
  onEnded: null,
  needsGesture: false,
};

let sfxContext = null;
const sfxBuffers = new Map();
let sfxVolume = DEFAULT_AUDIO_SETTINGS.sfxVolume;
let sfxMuted = false;
let sfxEnabled = true;
let soundManifestPromise = null;
let soundIndex = null;

// The track that is currently loaded (not necessarily audible while muted).
let currentTrack = null;
const trackListeners = new Set();

export function setCurrentTrack(track) {
  if ((currentTrack?.file || "") === (track?.file || "")) return;
  currentTrack = track || null;
  trackListeners.forEach((listener) => listener());
}

export function getCurrentTrack() {
  return currentTrack;
}

export function subscribeCurrentTrack(listener) {
  trackListeners.add(listener);
  return () => trackListeners.delete(listener);
}

function ensureMusicElement() {
  if (typeof window === "undefined") return null;
  if (!music.el) {
    const el = new Audio();
    el.preload = "auto";
    el.volume = 0;
    el.setAttribute("data-ttt-music", "");
    el.style.display = "none";
    document.body.appendChild(el);
    el.addEventListener("ended", () => music.onEnded?.());
    music.el = el;
  }
  return music.el;
}

function musicTarget() {
  return music.muted ? 0 : clamp(music.volume);
}

function cancelFade() {
  if (music.fadeFrame) {
    cancelAnimationFrame(music.fadeFrame);
    music.fadeFrame = 0;
  }
  const resolve = music.fadeResolve;
  music.fadeResolve = null;
  if (resolve) resolve();
}

// Fades the music element to `value` over `ms`. Resolves at the end so callers
// can sequence "fade out, swap track, fade in" without overlapping.
export function fadeMusic(value, ms = FADE_MS) {
  const el = ensureMusicElement();
  if (!el) return Promise.resolve();
  cancelFade();
  const target = clamp(value);
  if (!ms) {
    el.volume = target;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const from = el.volume;
    const start = performance.now();
    music.fadeResolve = resolve;
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      el.volume = clamp(from + (target - from) * t);
      if (t < 1) {
        music.fadeFrame = requestAnimationFrame(step);
      } else {
        music.fadeFrame = 0;
        music.fadeResolve = null;
        resolve();
      }
    };
    music.fadeFrame = requestAnimationFrame(step);
  });
}

export function configureAudio(settings) {
  music.volume = clamp(settings?.musicVolume ?? DEFAULT_AUDIO_SETTINGS.musicVolume);
  music.muted = !!settings?.musicMuted;
  sfxVolume = clamp(settings?.sfxVolume ?? DEFAULT_AUDIO_SETTINGS.sfxVolume);
  sfxMuted = !!settings?.sfxMuted;
  sfxEnabled = settings?.sfxEnabled !== false;
  const el = music.el;
  if (el && !el.paused && !music.fadeFrame) el.volume = musicTarget();
}

// Starts a track from silence, fades the current one out first. Throws when
// the browser blocks autoplay; the caller arms a one-time gesture retry.
export async function playMusicTrack(track, { fadeMs = FADE_MS } = {}) {
  const el = ensureMusicElement();
  if (!el || !track?.file) return false;
  // An ended element is already silent; don't make the next song wait for a
  // pointless one-second fade-out.
  if (!el.paused && !el.ended && el.currentSrc) await fadeMusic(0, fadeMs);
  el.pause();
  el.src = track.file;
  el.currentTime = 0;
  el.volume = 0;
  try {
    await el.play();
  } catch {
    music.needsGesture = true;
    return false;
  }
  music.needsGesture = false;
  await fadeMusic(musicTarget(), fadeMs);
  return true;
}

// Warm the browser cache for the next track so the hand-off at the end of a
// song starts immediately instead of buffering from the server again.
const prefetched = new Set();
export function prefetchMusic(file) {
  if (!file || typeof fetch === "undefined" || prefetched.has(file)) return;
  prefetched.add(file);
  fetch(file, { cache: "force-cache" }).catch(() => prefetched.delete(file));
}

export async function pauseMusic(fadeMs = FADE_MS) {
  const el = music.el;
  if (!el) return;
  if (!el.paused) await fadeMusic(0, fadeMs);
  el.pause();
}

export async function resumeMusic(fadeMs = FADE_MS) {
  const el = ensureMusicElement();
  if (!el || !el.currentSrc) return false;
  el.volume = 0;
  try {
    await el.play();
  } catch {
    music.needsGesture = true;
    return false;
  }
  await fadeMusic(musicTarget(), fadeMs);
  return true;
}

export function stopMusic() {
  const el = music.el;
  if (!el) return;
  cancelFade();
  el.pause();
  el.removeAttribute("src");
  el.load();
}

export function musicNeedsGesture() {
  return music.needsGesture;
}

export function setMusicEndedHandler(handler) {
  music.onEnded = handler;
}

export function getMusicElement() {
  return music.el;
}

// --- Sound effects -------------------------------------------------------

function loadSoundManifest() {
  if (typeof window === "undefined") return Promise.resolve([]);
  if (soundManifestPromise) return soundManifestPromise;
  soundManifestPromise = fetch("/sounds/manifest.json", { cache: "no-cache" })
    .then((res) => (res.ok ? res.json() : { sounds: [] }))
    .then((data) => {
      const list = Array.isArray(data?.sounds) ? data.sounds : [];
      soundIndex = new Map(
        list.filter((s) => s?.name && s?.file).map((s) => [String(s.name).toLowerCase(), s])
      );
      return list;
    })
    .catch(() => {
      soundIndex = new Map();
      return [];
    });
  return soundManifestPromise;
}

export function listSoundEffects() {
  return loadSoundManifest();
}

function ensureSfxContext() {
  if (typeof window === "undefined") return null;
  if (!sfxContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    sfxContext = new Ctx();
  }
  if (sfxContext.state === "suspended") sfxContext.resume().catch(() => {});
  return sfxContext;
}

export async function playSfx(name, { gain = 1 } = {}) {
  if (!name || !sfxEnabled || sfxMuted || sfxVolume <= 0) return;
  const keys = [String(name).toLowerCase()];
  if (soundIndex) {
    const entry = keys.map((key) => soundIndex.get(key)).find(Boolean);
    if (!entry) return;
    const ctx = ensureSfxContext();
    if (!ctx) return;
    try {
      let buffer = sfxBuffers.get(entry.file);
      if (!buffer) {
        const res = await fetch(entry.file);
        if (!res.ok) return;
        buffer = await ctx.decodeAudioData(await res.arrayBuffer());
        sfxBuffers.set(entry.file, buffer);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const node = ctx.createGain();
      node.gain.value = clamp(sfxVolume * gain);
      source.connect(node).connect(ctx.destination);
      source.start();
    } catch {
      /* a missing or undecodable effect is silent */
    }
    return;
  }
  // First call may arrive before the manifest is loaded.
  await loadSoundManifest();
  if (soundIndex?.size) await playSfx(name, { gain });
}

// A single delegated click sound makes every button/row feel responsive once
// the user drops a "click" effect into public/sounds. Rate-limited so drags
// and rapid clicks don't machine-gun.
let lastClickAt = 0;
export function installClickSounds(enabled) {
  if (typeof document === "undefined" || !enabled) return () => {};
  const handler = (event) => {
    const target = event.target?.closest?.("button, a, [role=button], [role=tab], input[type=checkbox]");
    if (!target || target.disabled) return;
    const now = performance.now();
    if (now - lastClickAt < 55) return;
    lastClickAt = now;
    playSfx("click", { gain: 0.7 });
  };
  document.addEventListener("pointerdown", handler, true);
  return () => document.removeEventListener("pointerdown", handler, true);
}
