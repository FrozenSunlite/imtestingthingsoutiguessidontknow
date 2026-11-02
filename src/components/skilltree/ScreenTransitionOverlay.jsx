import { useSyncExternalStore } from "react";
import { getScreenTransition, subscribeScreenTransition } from "@/lib/screenTransition";

// Sits above every screen, dialog and toast. Black during the hand-off.
export function ScreenTransitionOverlay() {
  const state = useSyncExternalStore(
    subscribeScreenTransition,
    getScreenTransition,
    () => ({ active: false, phase: "idle" })
  );

  const dark = state.active && state.phase === "out";
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[300] bg-black transition-opacity duration-1000 ease-in-out ${
        state.active ? "pointer-events-auto" : "pointer-events-none"
      } ${dark ? "opacity-100" : "opacity-0"}`}
    />
  );
}
