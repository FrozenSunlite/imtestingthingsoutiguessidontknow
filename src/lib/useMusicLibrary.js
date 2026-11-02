// Cached access to /music/manifest.json, shared by the player and Settings.
import { useEffect, useState } from "react";

const EMPTY = { default: [], custom: [] };
let cached = null;
let pending = null;

function load() {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = fetch("/music/manifest.json", { cache: "no-cache" })
      .then((res) => (res.ok ? res.json() : EMPTY))
      .then((data) => {
        cached = {
          default: Array.isArray(data?.default) ? data.default : [],
          custom: Array.isArray(data?.custom) ? data.custom : [],
        };
        return cached;
      })
      .catch(() => {
        cached = EMPTY;
        return cached;
      });
  }
  return pending;
}

export function useMusicLibrary() {
  const [library, setLibrary] = useState(cached || EMPTY);
  useEffect(() => {
    let alive = true;
    load().then((data) => {
      if (alive) setLibrary(data);
    });
    return () => {
      alive = false;
    };
  }, []);
  return library;
}
