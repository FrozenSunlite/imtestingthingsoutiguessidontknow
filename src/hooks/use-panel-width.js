import { useEffect, useState } from "react";

const KEY = "skilltree:editorWidth";
const EVT = "skilltree:panel-width";

// Shared side-panel width: the Edit Node panel, its empty state and the
// Character Sheet (View) all follow the same dragged boundary. Pass a `key`
// for an independent width (e.g. one per side-tree panel) — independent
// widths ignore the shared sync event.
export function usePanelWidth(defaultWidth = 340, min = 260, max = 720, key = KEY) {
  const [width, setWidth] = useState(defaultWidth);

  useEffect(() => {
    const w = Number(localStorage.getItem(key));
    if (w >= min && w <= max) setWidth(w);
    const sync = (e) => {
      if (key !== KEY) return;
      if (e.detail >= min && e.detail <= max) setWidth(e.detail);
    };
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, [key, min, max]);

  const set = (w) => {
    setWidth(w);
    localStorage.setItem(key, String(w));
    if (key === KEY) window.dispatchEvent(new CustomEvent(EVT, { detail: w }));
  };

  return [width, set];
}