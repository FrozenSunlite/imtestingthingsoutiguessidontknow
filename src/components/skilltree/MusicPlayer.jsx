import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTree } from "@/lib/treeStore";
import {
  DEFAULT_AUDIO_SETTINGS,
  NOW_PLAYING_MS,
  configureAudio,
  getCurrentTrack,
  getMusicElement,
  installClickSounds,
  pauseMusic,
  playMusicTrack,
  prefetchMusic,
  resumeMusic,
  setCurrentTrack,
  setMusicEndedHandler,
} from "@/lib/audio";
import { useMusicLibrary } from "@/lib/useMusicLibrary";

// A small vinyl record: grooves, a coloured label and a centre hole.
function SpinningRecord() {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="h-9 w-9 shrink-0 animate-[spin_3.5s_linear_infinite] drop-shadow"
    >
      <circle cx="20" cy="20" r="19" fill="#111318" />
      <circle cx="20" cy="20" r="18.2" fill="none" stroke="#2b2f3a" strokeWidth="0.8" />
      {[15.5, 13, 10.5, 8.2].map((r) => (
        <circle key={r} cx="20" cy="20" r={r} fill="none" stroke="#383d4a" strokeWidth="0.45" />
      ))}
      <circle cx="20" cy="20" r="6" fill="#00e5ff" />
      <circle cx="20" cy="20" r="6" fill="none" stroke="#0e7490" strokeWidth="0.6" />
      <circle cx="20" cy="20" r="1.4" fill="#0b1020" />
      <circle cx="17" cy="17" r="1.6" fill="#e0fbff" opacity="0.55" />
    </svg>
  );
}

// Owns playback only. Settings persist through the shared tree store; the
// element itself lives in lib/audio so it survives every screen.
export function MusicPlayer() {
  const { settings } = useTree();
  const library = useMusicLibrary();
  const audio = useMemo(
    () => ({ ...DEFAULT_AUDIO_SETTINGS, ...(settings.audio || {}) }),
    [settings.audio]
  );
  const audioRef = useRef(audio);
  audioRef.current = audio;

  const playlist = useMemo(
    () => (audio.customMusic ? library.custom : library.default),
    [audio.customMusic, library]
  );
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;

  const [toastTrack, setToastTrack] = useState(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const toastTimer = useRef(null);
  const pendingTrack = useRef(null);
  const nextUp = useRef(null);
  const lastHandledTrack = useRef("");
  const advancing = useRef(false);

  const startTrack = useCallback(async (track) => {
    if (!track?.file) return false;
    pendingTrack.current = track;
    const ok = await playMusicTrack(track);
    if (ok) {
      pendingTrack.current = null;
      setCurrentTrack(track);
      // Decide and cache the next song now, so the end-of-song hand-off does
      // not wait on the network.
      const upcoming = pickNextRef.current(track.file);
      nextUp.current = upcoming;
      if (upcoming) prefetchMusic(upcoming.file);
      if (audioRef.current.nowPlaying) {
        setToastTrack(track);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToastTrack(null), NOW_PLAYING_MS);
      }
    } else {
      setNeedsGesture(true);
    }
    return ok;
  }, []);
  const startTrackRef = useRef(startTrack);
  startTrackRef.current = startTrack;

  const pickNext = useCallback((exclude) => {
    const list = playlistRef.current;
    if (!list.length) return null;
    if (audioRef.current.shuffle) {
      const pool = list.length > 1 ? list.filter((t) => t.file !== exclude) : list;
      return pool[Math.floor(Math.random() * pool.length)];
    }
    const index = list.findIndex((t) => t.file === exclude);
    return list[(index + 1) % list.length];
  }, []);
  const pickNextRef = useRef(pickNext);
  pickNextRef.current = pickNext;

  // Volume, mute and effect settings apply immediately.
  useEffect(() => {
    configureAudio(audio);
  }, [audio]);

  useEffect(() => {
    if (!audio.sfxEnabled) return undefined;
    return installClickSounds(true);
  }, [audio.sfxEnabled]);

  // Play the right thing whenever the selection, playlist or power changes.
  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!audio.musicEnabled) {
        await pauseMusic();
        return;
      }
      const list = audio.customMusic ? library.custom : library.default;
      if (!list.length) {
        await pauseMusic();
        setCurrentTrack(null);
        return;
      }
      const currentFile = getCurrentTrack()?.file;
      const requested =
        audio.track && audio.track !== lastHandledTrack.current
          ? list.find((t) => t.file === audio.track)
          : null;
      if (requested) {
        lastHandledTrack.current = audio.track;
        if (requested.file !== currentFile) await startTrack(requested);
        return;
      }
      if (currentFile && list.some((t) => t.file === currentFile)) {
        if (getMusicElement()?.paused) {
          const ok = await resumeMusic();
          if (!ok && alive) setNeedsGesture(true);
        }
        return;
      }
      const next = pickNext(currentFile);
      if (next) await startTrack(next);
    };
    run();
    return () => {
      alive = false;
    };
  }, [audio.musicEnabled, audio.customMusic, audio.track, library, startTrack, pickNext]);

  // Browsers block autoplay until the first gesture. Arm a one-shot retry so
  // music starts on the first click or key press without a separate prompt.
  useEffect(() => {
    if (!needsGesture) return undefined;
    const retry = () => {
      setNeedsGesture(false);
      const track =
        pendingTrack.current ||
        (playlistRef.current.length ? pickNext(getCurrentTrack()?.file) : null);
      if (track) startTrackRef.current(track);
    };
    window.addEventListener("pointerdown", retry, { once: true });
    window.addEventListener("keydown", retry, { once: true });
    return () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
    };
  }, [needsGesture, pickNext]);

  // Advance at the end of a track, honouring shuffle. The next song is chosen
  // and prefetched when the current one starts, so this begins immediately.
  useEffect(() => {
    setMusicEndedHandler(() => {
      if (advancing.current) return;
      const list = playlistRef.current;
      let next = nextUp.current;
      if (!next || !list.some((t) => t.file === next.file)) {
        next = pickNextRef.current(getCurrentTrack()?.file);
      }
      nextUp.current = null;
      if (!next) return;
      advancing.current = true;
      startTrackRef.current(next).finally(() => {
        advancing.current = false;
      });
    });
    return () => setMusicEndedHandler(null);
  }, [pickNext]);

  // Selecting a specific song writes it into settings.audio.track; the sync
  // effect above notices the change and starts it.

  useEffect(() => {
    if (!audio.nowPlaying) setToastTrack(null);
  }, [audio.nowPlaying]);

  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
    },
    []
  );

  // Selecting a specific song writes it into settings.audio.track; the sync
  // effect above notices the change and starts it.

  if (!toastTrack) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[120] max-w-[calc(100vw-2rem)]">
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border bg-card/95 py-2.5 pl-3 pr-2 shadow-2xl backdrop-blur">
        <SpinningRecord />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            Now Playing - {toastTrack.title}
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss now playing"
          onClick={() => setToastTrack(null)}
          className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
