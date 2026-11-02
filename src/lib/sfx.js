import { listSoundEffects, playSfx } from "./audio";

// Names match public/sounds/manifest.json. Keeping the mapping in one place
// makes it obvious which imported effect belongs to which action.
export const SFX = {
  tap: [
    "Tap Variant 1",
    "Tap Variant 2",
    "Tap Variant 3",
    "Tap Variant 4",
    "Tap Variant 5",
  ],
  newProject: "Clicking New",
  connector: "Creating a Connector",
  error: "Error",
  placeNode: "Placing a Node",
  popup: "Pop-Up noise",
  unlockNode: "Unlocking a Node",
  importFinished: "5e Import Finished",
  mainMenu: "Return to Main Menu",
};

export function playTapSfx() {
  const variants = SFX.tap;
  return playSfx(variants[Math.floor(Math.random() * variants.length)], {
    gain: 0.55,
  });
}

// Delegated UI sounds: a tap on controls, a pop when a dialog opens, and the
// error sting for uncaught failures. Rate limits keep drags and error cascades
// from machine-gunning.
export function installUiSounds(enabled) {
  if (typeof document === "undefined" || !enabled) return () => {};
  listSoundEffects();

  let lastTap = 0;
  let lastPopup = 0;
  let lastError = 0;

  const onPointerDown = (event) => {
    const target = event.target?.closest?.(
      'button, a, [role=button], [role=tab], [role=menuitem], [role=option], input[type=checkbox], input[type=radio]'
    );
    if (!target || target.disabled || target.getAttribute("aria-disabled") === "true") {
      return;
    }
    const now = performance.now();
    if (now - lastTap < 55) return;
    lastTap = now;
    playTapSfx();
  };
  document.addEventListener("pointerdown", onPointerDown, true);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (
          node.matches?.('[role="dialog"]') ||
          node.querySelector?.('[role="dialog"]')
        ) {
          const now = performance.now();
          if (now - lastPopup < 180) return;
          lastPopup = now;
          playSfx(SFX.popup, { gain: 0.55 });
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const onError = () => {
    const now = performance.now();
    if (now - lastError < 400) return;
    lastError = now;
    playSfx(SFX.error, { gain: 0.7 });
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onError);

  return () => {
    document.removeEventListener("pointerdown", onPointerDown, true);
    observer.disconnect();
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onError);
  };
}
