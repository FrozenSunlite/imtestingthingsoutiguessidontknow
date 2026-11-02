// Whether the first-run tutorial overlay is currently open. The update prompt
// is a modal dialog, so it must wait until the tutorial is closed: otherwise
// Radix blocks pointer events on the tutorial even though the dialog is drawn
// underneath it.

let tutorialOpen = false;
const listeners = new Set();

export function setTutorialOpen(value) {
  const next = !!value;
  if (next === tutorialOpen) return;
  tutorialOpen = next;
  listeners.forEach((listener) => listener());
}

export function isTutorialOpen() {
  return tutorialOpen;
}

export function subscribeTutorialOpen(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
